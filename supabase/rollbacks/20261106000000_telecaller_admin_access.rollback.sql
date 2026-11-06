-- Rollback for 20261106000000_telecaller_admin_access.sql.
-- Restores the admin-only policies and role trigger exactly as they were in production
-- before that migration (checked against pg_policies on 06 Nov 2026), and removes the
-- migration record. Changes no data. Run as one transaction.
begin;
set local role postgres;
set local lock_timeout = '15s';
set local statement_timeout = '120s';

alter policy "customers_delete" on public.customers using (public.is_admin());
alter policy "equipment_units_delete" on public.equipment_units using (public.is_admin());
alter policy "rentals_delete" on public.rentals using (public.is_admin());
alter policy "rental_items_delete" on public.rental_items using (public.is_admin());
alter policy "sales_delete" on public.sales using (public.is_admin());
alter policy "sale_items_delete" on public.sale_items using (public.is_admin());
alter policy "invoices_delete" on public.invoices using (public.is_admin());
alter policy "invoice_items_delete" on public.invoice_items using (public.is_admin());
alter policy "payments_delete" on public.payments using (public.is_admin());

alter policy "equipment_types_insert" on public.equipment_types with check (public.is_admin());
alter policy "equipment_types_update" on public.equipment_types using (public.is_admin());
alter policy "equipment_types_delete" on public.equipment_types using (public.is_admin());

alter policy "company_settings_update" on public.company_settings
  using (public.is_admin()) with check (public.is_admin());

alter policy "activity_log_select" on public.activity_log using (
  public.is_admin() or (public.is_office() and entity_type <> 'profile')
);

alter policy "delivery_photos_delete" on public.delivery_photos using (
  public.is_admin() or (public.can_record_delivery(rental_id) and uploaded_by = auth.uid())
);

alter policy "delivery_photos_delete" on storage.objects using (
  bucket_id = 'delivery-photos'
  and (
    public.is_admin()
    or exists (
      select 1 from public.delivery_photos p
      where p.storage_path = objects.name
        and p.uploaded_by = auth.uid()
        and public.can_record_delivery(p.rental_id)
    )
  )
);

alter policy "business_assets_admin_insert" on storage.objects
  with check (bucket_id = 'business-assets' and public.is_admin() and name like 'payment-qr/%');
alter policy "business_assets_admin_update" on storage.objects
  using (bucket_id = 'business-assets' and public.is_admin())
  with check (bucket_id = 'business-assets' and public.is_admin() and name like 'payment-qr/%');
alter policy "business_assets_admin_delete" on storage.objects
  using (bucket_id = 'business-assets' and public.is_admin());

alter policy "profiles_insert_admin" on public.profiles with check (public.is_admin());
-- Recreated rather than altered: it had no WITH CHECK before, and ALTER can't remove one.
drop policy "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin" on public.profiles for update using (public.is_admin());
alter policy "profiles_delete_admin" on public.profiles using (public.is_admin());

create or replace function public.prevent_unauthorized_role_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if (new.role is distinct from old.role
      or new.is_active is distinct from old.is_active
      or new.email is distinct from old.email)
     and auth.uid() is not null
     and not public.is_admin() then
    raise exception 'Only admins can change user roles or access'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

delete from supabase_migrations.schema_migrations where version = '20261106000000';

commit;
