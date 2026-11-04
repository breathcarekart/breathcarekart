-- WhatsApp invoice sending, Stage 1: message log, duplicate-send protection and
-- private storage for the invoice PDFs that are attached to the messages.
--
-- Writer: only the `send-invoice-whatsapp` Edge Function, using the server-side
-- service role. Browser (API) users can only READ the log, and only office roles
-- (admin, telecaller). Supervisors, inactive and signed-out users see nothing.
--
-- Depends on: invoices, customers, profiles, public.is_office(), public.set_updated_at()
-- and the storage schema (migrations up to 20261008000500). It does not depend on
-- 20261014000000_keep_one_active_admin.
--
-- Safe to re-run: every object is created with IF NOT EXISTS / OR REPLACE or dropped first.
-- No existing data is changed. The delivery-photos bucket is not touched.

-- ============================================================
-- 1. Message log
-- ============================================================
create table if not exists public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  -- No ON DELETE action: an invoice that has WhatsApp history can't be deleted,
  -- so the audit trail is kept.
  invoice_id uuid not null references public.invoices (id),
  customer_id uuid not null references public.customers (id),
  campaign_name text not null check (campaign_name in ('invoice_send')),
  -- dry_run: everything is prepared and checked, nothing is sent (development default)
  -- test:    sent to the internal test number, never to the customer
  -- live:    sent to the customer
  mode text not null check (mode in ('dry_run', 'test', 'live')),
  status text not null default 'sending',
  -- The number actually used (in test mode, the internal test number), E.164 format.
  destination text not null check (destination ~ '^\+[1-9][0-9]{7,14}$'),
  -- The template parameters exactly as sent, in order ({{1}}..{{n}}).
  template_params jsonb not null default '[]'::jsonb check (jsonb_typeof(template_params) = 'array'),
  media_path text,
  media_filename text,
  provider_http_status integer,
  -- Trimmed provider reply. Never contains the API key.
  provider_response jsonb,
  error_message text,
  -- Set only after the user explicitly confirmed "Send again".
  is_resend boolean not null default false,
  requested_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  -- Dry runs never reach AiSensy, so they can only end as dry_run or failed.
  constraint whatsapp_messages_status_matches_mode check (
    (mode = 'dry_run' and status in ('dry_run', 'failed'))
    or (mode <> 'dry_run' and status in ('sending', 'sent', 'failed'))
  )
);

create index if not exists whatsapp_messages_invoice_idx
  on public.whatsapp_messages (invoice_id, created_at desc);

drop trigger if exists set_updated_at on public.whatsapp_messages;
create trigger set_updated_at
  before update on public.whatsapp_messages
  for each row execute function public.set_updated_at();

-- ============================================================
-- 2. Duplicate-send protection
-- ============================================================
-- a) Only one send in progress per invoice and campaign. Stops double clicks and two
--    people pressing Send at the same moment: the second insert fails.
create unique index if not exists whatsapp_messages_one_in_flight
  on public.whatsapp_messages (invoice_id, campaign_name)
  where status = 'sending';

-- b) Once a message was sent successfully, a new send for the same invoice, campaign
--    and mode needs an explicit resend confirmation (is_resend = true). Dry runs
--    never count and are never blocked. A test-mode send (to the internal number)
--    does not count as the customer having received it.
create or replace function public.whatsapp_guard_resend()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.mode <> 'dry_run' and not new.is_resend and exists (
    select 1
    from public.whatsapp_messages m
    where m.invoice_id = new.invoice_id
      and m.campaign_name = new.campaign_name
      and m.mode = new.mode
      and m.status = 'sent'
  ) then
    raise exception 'This invoice was already sent on WhatsApp. Confirm "Send again" to send it once more.'
      using hint = 'already_sent';
  end if;
  return new;
end;
$$;

revoke execute on function public.whatsapp_guard_resend() from public, anon, authenticated;

drop trigger if exists whatsapp_guard_resend on public.whatsapp_messages;
create trigger whatsapp_guard_resend
  before insert on public.whatsapp_messages
  for each row execute function public.whatsapp_guard_resend();

-- ============================================================
-- 3. Who can see and change the log
-- ============================================================
alter table public.whatsapp_messages enable row level security;

drop policy if exists "whatsapp_messages_select" on public.whatsapp_messages;
create policy "whatsapp_messages_select" on public.whatsapp_messages
  for select to authenticated
  using (public.is_office());

-- No insert/update/delete policies: API users can't write. Remove the table
-- privileges too, so this doesn't rely on RLS alone (TRUNCATE ignores RLS):
-- signed-in users keep SELECT only (still filtered by the policy above), anon
-- gets nothing. The service role (Edge Function) keeps its access.
revoke all on public.whatsapp_messages from anon, authenticated;
grant select on public.whatsapp_messages to authenticated;

-- ============================================================
-- 4. Private storage for the generated invoice PDFs
-- ============================================================
-- Files are written only by the Edge Function (service role) at
-- invoice-pdfs/{invoice_id}/{random}.pdf and shared with AiSensy through a
-- short-lived signed URL. The bucket itself is never public.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('invoice-pdfs', 'invoice-pdfs', false, 5242880, array['application/pdf'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Office roles may read (for example to open a previously sent PDF from the history).
-- There are deliberately no insert, update or delete policies for this bucket.
drop policy if exists "invoice_pdfs_read" on storage.objects;
create policy "invoice_pdfs_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'invoice-pdfs' and public.is_office());
