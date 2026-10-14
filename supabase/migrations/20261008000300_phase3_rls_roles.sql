-- Phase 3 · 3/5 — role-based Row Level Security.
--
--   admin       everything
--   telecaller  operational: customers, inventory, rentals, sales, invoices, payments
--   supervisor  only rentals assigned to them (+ those customers' contact details),
--               delivery status and delivery photos
--
-- Inactive users get nothing. Anonymous users get nothing.
-- Business writes (rentals, sales, invoices, payments, delivery steps) go through
-- SECURITY DEFINER functions in the next migration, which check these same roles,
-- so there are deliberately no direct INSERT/UPDATE policies on those tables.

-- ============================================================
-- Role helpers
-- ============================================================
create or replace function public.current_app_role()
returns text
language sql
security definer set search_path = public
stable
as $$
  select role from public.profiles where id = auth.uid() and is_active;
$$;

create or replace function public.is_staff()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select public.current_app_role() is not null;
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select coalesce(public.current_app_role() = 'admin', false);
$$;

create or replace function public.is_office()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select coalesce(public.current_app_role() in ('admin', 'telecaller'), false);
$$;

create or replace function public.is_supervisor()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select coalesce(public.current_app_role() = 'supervisor', false);
$$;

-- Office staff see every rental; a supervisor sees the ones assigned to them.
create or replace function public.can_see_rental(p_rental_id uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select public.is_office()
      or (public.is_supervisor()
          and exists (select 1 from public.rentals r where r.id = p_rental_id and r.supervisor_id = auth.uid()));
$$;

-- ============================================================
-- Drop the Phase 1 "any staff can do anything" policies
-- ============================================================
drop policy if exists "profiles_select_staff" on public.profiles;
drop policy if exists "profiles_update_self" on public.profiles;
drop policy if exists "profiles_update_admin" on public.profiles;
drop policy if exists "profiles_insert_admin" on public.profiles;
drop policy if exists "profiles_delete_admin" on public.profiles;
drop policy if exists "customers_select" on public.customers;
drop policy if exists "customers_insert" on public.customers;
drop policy if exists "customers_update" on public.customers;
drop policy if exists "customers_delete" on public.customers;
drop policy if exists "equipment_types_select" on public.equipment_types;
drop policy if exists "equipment_types_insert" on public.equipment_types;
drop policy if exists "equipment_types_update" on public.equipment_types;
drop policy if exists "equipment_types_delete" on public.equipment_types;
drop policy if exists "equipment_units_select" on public.equipment_units;
drop policy if exists "equipment_units_insert" on public.equipment_units;
drop policy if exists "equipment_units_update" on public.equipment_units;
drop policy if exists "equipment_units_delete" on public.equipment_units;
drop policy if exists "rentals_select" on public.rentals;
drop policy if exists "rentals_insert" on public.rentals;
drop policy if exists "rentals_update" on public.rentals;
drop policy if exists "rentals_delete" on public.rentals;
drop policy if exists "rental_items_select" on public.rental_items;
drop policy if exists "rental_items_insert" on public.rental_items;
drop policy if exists "rental_items_update" on public.rental_items;
drop policy if exists "rental_items_delete" on public.rental_items;
drop policy if exists "invoices_select" on public.invoices;
drop policy if exists "invoices_insert" on public.invoices;
drop policy if exists "invoices_update" on public.invoices;
drop policy if exists "invoices_delete" on public.invoices;
drop policy if exists "invoice_items_select" on public.invoice_items;
drop policy if exists "invoice_items_insert" on public.invoice_items;
drop policy if exists "invoice_items_update" on public.invoice_items;
drop policy if exists "invoice_items_delete" on public.invoice_items;
drop policy if exists "payments_select" on public.payments;
drop policy if exists "payments_insert" on public.payments;
drop policy if exists "payments_delete" on public.payments;
drop policy if exists "activity_log_select" on public.activity_log;
drop policy if exists "activity_log_insert" on public.activity_log;

alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.delivery_photos enable row level security;
alter table public.company_settings enable row level security;
alter table public.invoice_counters enable row level security; -- no policies: functions only

-- ============================================================
-- profiles
-- ============================================================
create policy "profiles_select" on public.profiles for select
  using (id = auth.uid() or public.is_office());
-- Own name/phone only; role, is_active and email are blocked by trigger.
create policy "profiles_update_self" on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles_update_admin" on public.profiles for update using (public.is_admin());
create policy "profiles_insert_admin" on public.profiles for insert with check (public.is_admin());
create policy "profiles_delete_admin" on public.profiles for delete using (public.is_admin());

-- ============================================================
-- customers
-- ============================================================
create policy "customers_select" on public.customers for select using (
  public.is_office()
  or (public.is_supervisor() and exists (
    select 1 from public.rentals r where r.customer_id = customers.id and r.supervisor_id = auth.uid()
  ))
);
create policy "customers_insert" on public.customers for insert with check (public.is_office());
create policy "customers_update" on public.customers for update using (public.is_office()) with check (public.is_office());
create policy "customers_delete" on public.customers for delete using (public.is_admin());

-- ============================================================
-- equipment
-- ============================================================
create policy "equipment_types_select" on public.equipment_types for select using (public.is_staff());
create policy "equipment_types_insert" on public.equipment_types for insert with check (public.is_admin());
create policy "equipment_types_update" on public.equipment_types for update using (public.is_admin());
create policy "equipment_types_delete" on public.equipment_types for delete using (public.is_admin());

create policy "equipment_units_select" on public.equipment_units for select using (public.is_staff());
create policy "equipment_units_insert" on public.equipment_units for insert with check (public.is_office());
create policy "equipment_units_update" on public.equipment_units for update using (public.is_office()) with check (public.is_office());
create policy "equipment_units_delete" on public.equipment_units for delete using (public.is_admin());

-- ============================================================
-- rentals (writes via workflow functions only)
-- ============================================================
create policy "rentals_select" on public.rentals for select using (public.can_see_rental(id));
create policy "rentals_delete" on public.rentals for delete using (public.is_admin());

create policy "rental_items_select" on public.rental_items for select using (public.can_see_rental(rental_id));
create policy "rental_items_delete" on public.rental_items for delete using (public.is_admin());

-- ============================================================
-- sales (writes via workflow functions only)
-- ============================================================
create policy "sales_select" on public.sales for select using (public.is_office());
create policy "sales_delete" on public.sales for delete using (public.is_admin());
create policy "sale_items_select" on public.sale_items for select using (public.is_office());
create policy "sale_items_delete" on public.sale_items for delete using (public.is_admin());

-- ============================================================
-- invoices & payments (writes via workflow functions only)
-- ============================================================
create policy "invoices_select" on public.invoices for select using (public.is_office());
create policy "invoices_delete" on public.invoices for delete using (public.is_admin());
create policy "invoice_items_select" on public.invoice_items for select using (public.is_office());
create policy "invoice_items_delete" on public.invoice_items for delete using (public.is_admin());

create policy "payments_select" on public.payments for select using (public.is_office());
-- Deleting a payment recalculates the invoice (trigger).
create policy "payments_delete" on public.payments for delete using (public.is_admin());

-- ============================================================
-- delivery photos
-- ============================================================
create policy "delivery_photos_select" on public.delivery_photos for select using (public.can_see_rental(rental_id));
create policy "delivery_photos_insert" on public.delivery_photos for insert with check (public.can_see_rental(rental_id));
create policy "delivery_photos_delete" on public.delivery_photos for delete using (public.is_admin());

-- ============================================================
-- activity log (append-only; rows are written by triggers/functions)
-- ============================================================
create policy "activity_log_select" on public.activity_log for select using (
  public.is_admin() or (public.is_office() and entity_type <> 'profile')
);

-- ============================================================
-- company settings
-- ============================================================
create policy "company_settings_select" on public.company_settings for select using (public.is_staff());
create policy "company_settings_update" on public.company_settings for update
  using (public.is_admin()) with check (public.is_admin());

-- Helpers are for policies and functions; no need to call them over the API.
revoke execute on function public.log_activity(text, uuid, text, text, jsonb) from public, anon, authenticated;
