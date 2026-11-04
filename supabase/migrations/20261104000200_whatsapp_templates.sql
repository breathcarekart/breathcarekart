-- WhatsApp: all four approved AiSensy templates, and the payment details they need.
--
-- 1. whatsapp_messages can log every template: invoice_send and payment_request (about
--    an invoice) and rental_booking_confirmation and return_or_renew_reminder (about a
--    rental). A message is about exactly one invoice or one rental. Duplicate-send
--    protection covers rentals the same way it covers invoices.
-- 2. Settings gain the UPI ID printed in payment requests and the payment QR image that
--    is attached to them. Both are managed by an admin in Settings.
-- 3. A private "business-assets" bucket holds that QR image. Admins upload it; office
--    roles may read it; the Edge Function shares it with AiSensy through a short-lived
--    signed link. The bucket is never public.
-- 4. The UPI ID provided by the client is filled in if none is set yet.
--
-- Depends on: 20261103000000_whatsapp_invoice_messages, 20261104000000_business_gst_settings.
-- No existing log rows, invoices, rentals or customers are changed. Safe to re-run.

-- ============================================================
-- 1. Message log for all templates
-- ============================================================
alter table public.whatsapp_messages
  add column if not exists rental_id uuid references public.rentals (id);

alter table public.whatsapp_messages alter column invoice_id drop not null;

alter table public.whatsapp_messages
  drop constraint if exists whatsapp_messages_campaign_name_check,
  drop constraint if exists whatsapp_messages_campaign_known,
  drop constraint if exists whatsapp_messages_one_subject;

alter table public.whatsapp_messages
  add constraint whatsapp_messages_campaign_known check (
    campaign_name in (
      'invoice_send', 'payment_request', 'rental_booking_confirmation', 'return_or_renew_reminder'
    )
  ),
  -- Invoice templates point at an invoice; rental templates at a rental. Never both, never neither.
  add constraint whatsapp_messages_one_subject check (
    (campaign_name in ('invoice_send', 'payment_request') and invoice_id is not null and rental_id is null)
    or (campaign_name in ('rental_booking_confirmation', 'return_or_renew_reminder')
        and rental_id is not null and invoice_id is null)
  );

create index if not exists whatsapp_messages_rental_idx
  on public.whatsapp_messages (rental_id, created_at desc)
  where rental_id is not null;

-- One send in progress per rental and template (the invoice index already exists).
create unique index if not exists whatsapp_messages_one_in_flight_rental
  on public.whatsapp_messages (rental_id, campaign_name)
  where status = 'sending' and rental_id is not null;

-- After a successful send, the same template to the same invoice or rental in the same
-- mode needs an explicit "Send again" confirmation (now covering rentals too).
create or replace function public.whatsapp_guard_resend()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.mode <> 'dry_run' and not new.is_resend and exists (
    select 1
    from public.whatsapp_messages m
    where m.invoice_id is not distinct from new.invoice_id
      and m.rental_id is not distinct from new.rental_id
      and m.campaign_name = new.campaign_name
      and m.mode = new.mode
      and m.status = 'sent'
  ) then
    raise exception 'This message was already sent on WhatsApp. Confirm "Send again" to send it once more.'
      using hint = 'already_sent';
  end if;
  return new;
end;
$$;

revoke execute on function public.whatsapp_guard_resend() from public, anon, authenticated;

-- ============================================================
-- 2. Payment details in Settings
-- ============================================================
alter table public.company_settings
  add column if not exists upi_id text,
  add column if not exists payment_qr_path text;

alter table public.company_settings
  drop constraint if exists company_settings_upi_id_format,
  drop constraint if exists company_settings_payment_qr_path;

alter table public.company_settings
  add constraint company_settings_upi_id_format check (
    upi_id is null or upi_id ~ '^[A-Za-z0-9._-]{2,200}@[A-Za-z][A-Za-z0-9.-]{1,63}$'
  ),
  -- A path inside the business-assets bucket, e.g. payment-qr/<random>.jpg
  add constraint company_settings_payment_qr_path check (
    payment_qr_path is null or payment_qr_path ~ '^payment-qr/[A-Za-z0-9._-]{1,120}\.(png|jpe?g|webp)$'
  );

-- ============================================================
-- 3. Private storage for the payment QR image
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('business-assets', 'business-assets', false, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "business_assets_read" on storage.objects;
create policy "business_assets_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'business-assets' and public.is_office());

drop policy if exists "business_assets_admin_insert" on storage.objects;
create policy "business_assets_admin_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'business-assets' and public.is_admin() and name like 'payment-qr/%');

drop policy if exists "business_assets_admin_update" on storage.objects;
create policy "business_assets_admin_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'business-assets' and public.is_admin())
  with check (bucket_id = 'business-assets' and public.is_admin() and name like 'payment-qr/%');

drop policy if exists "business_assets_admin_delete" on storage.objects;
create policy "business_assets_admin_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'business-assets' and public.is_admin());

-- ============================================================
-- 4. The client's UPI ID (only if none is set)
-- ============================================================
update public.company_settings
set upi_id = coalesce(upi_id, 'nharinath1993-2@okhdfcbank')
where id;
