-- Row Level Security: internal single-tenant app.
-- Any authenticated staff (row in profiles) can read/write company data.
-- Only role = 'admin' can delete. Anonymous / unauthenticated: no access at all.

create function public.is_staff()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (select 1 from public.profiles where id = auth.uid());
$$;

create function public.is_admin()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

alter table public.profiles enable row level security;
alter table public.customers enable row level security;
alter table public.equipment_types enable row level security;
alter table public.equipment_units enable row level security;
alter table public.rentals enable row level security;
alter table public.rental_items enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.payments enable row level security;
alter table public.activity_log enable row level security;

-- profiles: staff can see all profiles, only admin can edit roles, users can update own basic info
create policy "profiles_select_staff" on public.profiles for select using (public.is_staff());
create policy "profiles_update_self" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles_update_admin" on public.profiles for update using (public.is_admin());
create policy "profiles_insert_admin" on public.profiles for insert with check (public.is_admin());
create policy "profiles_delete_admin" on public.profiles for delete using (public.is_admin());

-- customers
create policy "customers_select" on public.customers for select using (public.is_staff());
create policy "customers_insert" on public.customers for insert with check (public.is_staff());
create policy "customers_update" on public.customers for update using (public.is_staff());
create policy "customers_delete" on public.customers for delete using (public.is_admin());

-- equipment_types (master catalogue — staff read, admin manage)
create policy "equipment_types_select" on public.equipment_types for select using (public.is_staff());
create policy "equipment_types_insert" on public.equipment_types for insert with check (public.is_admin());
create policy "equipment_types_update" on public.equipment_types for update using (public.is_admin());
create policy "equipment_types_delete" on public.equipment_types for delete using (public.is_admin());

-- equipment_units
create policy "equipment_units_select" on public.equipment_units for select using (public.is_staff());
create policy "equipment_units_insert" on public.equipment_units for insert with check (public.is_staff());
create policy "equipment_units_update" on public.equipment_units for update using (public.is_staff());
create policy "equipment_units_delete" on public.equipment_units for delete using (public.is_admin());

-- rentals
create policy "rentals_select" on public.rentals for select using (public.is_staff());
create policy "rentals_insert" on public.rentals for insert with check (public.is_staff());
create policy "rentals_update" on public.rentals for update using (public.is_staff());
create policy "rentals_delete" on public.rentals for delete using (public.is_admin());

-- rental_items
create policy "rental_items_select" on public.rental_items for select using (public.is_staff());
create policy "rental_items_insert" on public.rental_items for insert with check (public.is_staff());
create policy "rental_items_update" on public.rental_items for update using (public.is_staff());
create policy "rental_items_delete" on public.rental_items for delete using (public.is_admin());

-- invoices
create policy "invoices_select" on public.invoices for select using (public.is_staff());
create policy "invoices_insert" on public.invoices for insert with check (public.is_staff());
create policy "invoices_update" on public.invoices for update using (public.is_staff());
create policy "invoices_delete" on public.invoices for delete using (public.is_admin());

-- invoice_items
create policy "invoice_items_select" on public.invoice_items for select using (public.is_staff());
create policy "invoice_items_insert" on public.invoice_items for insert with check (public.is_staff());
create policy "invoice_items_update" on public.invoice_items for update using (public.is_staff());
create policy "invoice_items_delete" on public.invoice_items for delete using (public.is_admin());

-- payments (no update — corrections go through new entries; admin can delete mistaken entries)
create policy "payments_select" on public.payments for select using (public.is_staff());
create policy "payments_insert" on public.payments for insert with check (public.is_staff());
create policy "payments_delete" on public.payments for delete using (public.is_admin());

-- activity_log (append-only audit trail)
create policy "activity_log_select" on public.activity_log for select using (public.is_staff());
create policy "activity_log_insert" on public.activity_log for insert with check (public.is_staff());
