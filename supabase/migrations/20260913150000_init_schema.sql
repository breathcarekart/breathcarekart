-- Breath Care Kart production schema
-- Core entities: profiles (staff), customers, equipment master + inventory units,
-- rentals, invoices, payments, activity log.

create extension if not exists "pgcrypto";

-- ============================================================
-- 1. profiles (authorized users, extends auth.users)
-- ============================================================
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  phone text,
  role text not null default 'staff' check (role in ('admin', 'staff')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, new.raw_user_meta_data ->> 'full_name', 'staff');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- 2. customers
-- ============================================================
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  age int,
  gender text,
  attender_name text,
  attender_relation text,
  phone text not null,
  whatsapp text,
  emergency_contact text,
  city text,
  address text,
  customer_since date not null default current_date,
  notes text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- 3. equipment_types (master catalogue — business-provided names only)
-- ============================================================
create table public.equipment_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  notes text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 4. equipment_units (physical inventory)
-- ============================================================
create type public.equipment_status as enum ('available', 'reserved', 'on_rent', 'maintenance', 'repair');

create table public.equipment_units (
  id uuid primary key default gen_random_uuid(),
  equipment_type_id uuid not null references public.equipment_types (id) on delete restrict,
  unit_code text unique,
  serial_number text,
  brand text,
  model text,
  purchase_date date,
  status public.equipment_status not null default 'available',
  notes text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- 5. rentals
-- ============================================================
create type public.rental_status as enum ('active', 'due_soon', 'overdue', 'completed', 'cancelled');

create table public.rentals (
  id uuid primary key default gen_random_uuid(),
  rental_number text not null unique,
  customer_id uuid not null references public.customers (id) on delete restrict,
  start_date date not null,
  due_date date not null,
  returned_date date,
  status public.rental_status not null default 'active',
  notes text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- 6. rental_items (equipment units on a rental)
-- ============================================================
create table public.rental_items (
  id uuid primary key default gen_random_uuid(),
  rental_id uuid not null references public.rentals (id) on delete cascade,
  equipment_unit_id uuid not null references public.equipment_units (id) on delete restrict,
  quantity int not null default 1 check (quantity > 0),
  rate numeric(12, 2) not null,
  rate_type text not null default 'monthly' check (rate_type in ('daily', 'monthly')),
  returned_at timestamptz,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 7. invoices
-- ============================================================
create type public.invoice_status as enum ('draft', 'pending', 'paid', 'overdue', 'cancelled');

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  customer_id uuid not null references public.customers (id) on delete restrict,
  rental_id uuid references public.rentals (id) on delete set null,
  invoice_date date not null default current_date,
  due_date date not null,
  period_start date,
  period_end date,
  subtotal numeric(12, 2) not null default 0,
  discount numeric(12, 2) not null default 0,
  tax_rate numeric(5, 2) not null default 0,
  tax_amount numeric(12, 2) not null default 0,
  grand_total numeric(12, 2) not null default 0,
  amount_paid numeric(12, 2) not null default 0,
  status public.invoice_status not null default 'draft',
  notes text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- 8. invoice_items
-- ============================================================
create table public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  equipment_unit_id uuid references public.equipment_units (id) on delete set null,
  description text not null,
  rental_period text,
  quantity int not null default 1 check (quantity > 0),
  rate numeric(12, 2) not null,
  amount numeric(12, 2) not null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- 9. payments
-- ============================================================
create type public.payment_method as enum ('cash', 'upi', 'card', 'bank_transfer', 'cheque', 'other');

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  payment_date date not null default current_date,
  method public.payment_method not null default 'cash',
  reference_no text,
  notes text,
  recorded_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

-- ============================================================
-- 10. activity_log (reports / audit trail feed)
-- ============================================================
create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  description text,
  actor_id uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

-- ============================================================
-- updated_at maintenance trigger
-- ============================================================
create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at before update on public.customers
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.equipment_units
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.rentals
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.invoices
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- ============================================================
-- indexes
-- ============================================================
create index idx_customers_phone on public.customers (phone);
create index idx_equipment_units_type on public.equipment_units (equipment_type_id);
create index idx_equipment_units_status on public.equipment_units (status);
create index idx_rentals_customer on public.rentals (customer_id);
create index idx_rentals_status on public.rentals (status);
create index idx_rental_items_rental on public.rental_items (rental_id);
create index idx_rental_items_unit on public.rental_items (equipment_unit_id);
create index idx_invoices_customer on public.invoices (customer_id);
create index idx_invoices_rental on public.invoices (rental_id);
create index idx_invoices_status on public.invoices (status);
create index idx_invoices_number on public.invoices (invoice_number);
create index idx_invoice_items_invoice on public.invoice_items (invoice_id);
create index idx_payments_invoice on public.payments (invoice_id);
create index idx_activity_entity on public.activity_log (entity_type, entity_id);
