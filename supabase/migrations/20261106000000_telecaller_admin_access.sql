-- Telecallers get the same access as admins, except Reports.
--
--   admin       everything (unchanged)
--   telecaller  everything an admin can do: deletes, equipment types, company settings
--               and payment QR, the full activity log, and managing staff accounts.
--               Reports are hidden in the app; see the note at the end.
--   supervisor  unchanged
--
-- Every admin-only check below becomes public.is_office() (active admin or telecaller),
-- the helper the rest of the policies already use. public.is_admin() keeps its meaning
-- ("an active admin") and is still used for one thing: admin accounts themselves.
-- A telecaller can manage telecaller and supervisor accounts but can't create, edit,
-- activate, deactivate or delete an admin, can't make anyone an admin, and can't change
-- their own role or access. Otherwise a telecaller could promote themselves to admin
-- and open Reports.
--
-- No data is changed by this migration. Rollback:
-- supabase/rollbacks/20261106000000_telecaller_admin_access.rollback.sql

-- ============================================================
-- 1. Deletes and admin-only tables: admin -> office
-- ============================================================
alter policy "customers_delete" on public.customers using (public.is_office());
alter policy "equipment_units_delete" on public.equipment_units using (public.is_office());
alter policy "rentals_delete" on public.rentals using (public.is_office());
alter policy "rental_items_delete" on public.rental_items using (public.is_office());
alter policy "sales_delete" on public.sales using (public.is_office());
alter policy "sale_items_delete" on public.sale_items using (public.is_office());
alter policy "invoices_delete" on public.invoices using (public.is_office());
alter policy "invoice_items_delete" on public.invoice_items using (public.is_office());
alter policy "payments_delete" on public.payments using (public.is_office());

alter policy "equipment_types_insert" on public.equipment_types with check (public.is_office());
alter policy "equipment_types_update" on public.equipment_types using (public.is_office());
alter policy "equipment_types_delete" on public.equipment_types using (public.is_office());

-- Settings: business details, GST, UPI ID.
alter policy "company_settings_update" on public.company_settings
  using (public.is_office()) with check (public.is_office());

-- Activity log: the whole log, including staff-account entries.
alter policy "activity_log_select" on public.activity_log using (public.is_office());

-- Delivery photos: office staff can remove any photo; the supervisor rule is unchanged.
alter policy "delivery_photos_delete" on public.delivery_photos using (
  public.is_office() or (public.can_record_delivery(rental_id) and uploaded_by = auth.uid())
);

-- ============================================================
-- 2. Storage
-- ============================================================
alter policy "delivery_photos_delete" on storage.objects using (
  bucket_id = 'delivery-photos'
  and (
    public.is_office()
    or exists (
      select 1 from public.delivery_photos p
      where p.storage_path = objects.name
        and p.uploaded_by = auth.uid()
        and public.can_record_delivery(p.rental_id)
    )
  )
);

-- Payment QR image (Settings).
alter policy "business_assets_admin_insert" on storage.objects
  with check (bucket_id = 'business-assets' and public.is_office() and name like 'payment-qr/%');
alter policy "business_assets_admin_update" on storage.objects
  using (bucket_id = 'business-assets' and public.is_office())
  with check (bucket_id = 'business-assets' and public.is_office() and name like 'payment-qr/%');
alter policy "business_assets_admin_delete" on storage.objects
  using (bucket_id = 'business-assets' and public.is_office());

-- ============================================================
-- 3. Staff accounts: office staff, but admin accounts stay admin-only
-- ============================================================
alter policy "profiles_insert_admin" on public.profiles
  with check (public.is_admin() or (public.is_office() and role <> 'admin'));
alter policy "profiles_update_admin" on public.profiles
  using (public.is_admin() or (public.is_office() and role <> 'admin'))
  with check (public.is_admin() or (public.is_office() and role <> 'admin'));
alter policy "profiles_delete_admin" on public.profiles
  using (public.is_admin() or (public.is_office() and role <> 'admin'));

-- RLS can't tell which columns changed, and profiles_update_self lets everyone edit
-- their own row, so the role/access rule lives in this trigger (as before).
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
     and not public.is_admin()
     and not (public.is_office()
              and old.id <> auth.uid()
              and old.role <> 'admin'
              and new.role <> 'admin') then
    raise exception 'Only admins can change admin accounts, their own role or access'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

-- ============================================================
-- Reports
-- ============================================================
-- Reports have no tables, functions or endpoints of their own: the Reports page
-- builds its figures and CSV downloads in the browser from the same customers,
-- rentals, sales, invoices and payments that telecallers already work with on
-- their own pages. The app blocks the Reports page, its menu entries and its
-- downloads for telecallers (src/lib/roles.ts).
