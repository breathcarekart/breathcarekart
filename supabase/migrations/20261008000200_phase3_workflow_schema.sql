-- Phase 3 · 2/5 — schema for roles, sales, deliveries, invoice numbering,
-- company settings and tamper-proof attribution.
--
-- Nothing here deletes data. Existing rows are backfilled where a new NOT NULL
-- column needs a value.

-- ============================================================
-- 1. Roles: admin / telecaller / supervisor
-- ============================================================
-- Existing 'staff' accounts had full operational access, which is what a
-- telecaller has now.
alter table public.profiles drop constraint if exists profiles_role_check;
update public.profiles set role = 'telecaller' where role = 'staff';
alter table public.profiles
  add constraint profiles_role_check check (role in ('admin', 'telecaller', 'supervisor'));

-- New sign-ins start with the least access until an admin sets their role.
alter table public.profiles alter column role set default 'supervisor';

-- Email shown on Users & Roles (auth.users isn't readable from the browser).
alter table public.profiles add column if not exists email text;
update public.profiles p set email = u.email from auth.users u where u.id = p.id and p.email is null;

-- Deactivated users keep their history but get no data access (see RLS helpers).
-- Existing accounts stay active; new accounts start inactive until an admin activates them.
alter table public.profiles add column if not exists is_active boolean not null default true;
alter table public.profiles alter column is_active set default false;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role, is_active)
  values (new.id, new.raw_user_meta_data ->> 'full_name', new.email, 'supervisor', false);
  return new;
end;
$$;

-- Extends the Phase 1 guard: role, activation and email are admin-only fields.
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

-- ============================================================
-- 2. Equipment units: listing type and default rates
-- ============================================================
-- Rates are defaults offered on new invoices; the invoice stores the actual rate.
alter table public.equipment_units
  add column if not exists available_for text not null default 'rental'
    check (available_for in ('rental', 'sale')),
  add column if not exists daily_rate numeric(12, 2) check (daily_rate >= 0),
  add column if not exists monthly_rate numeric(12, 2) check (monthly_rate >= 0),
  add column if not exists sale_price numeric(12, 2) check (sale_price >= 0);

-- ============================================================
-- 3. Rentals: delivery assignment and deposit
-- ============================================================
alter table public.rentals
  add column if not exists supervisor_id uuid references public.profiles (id) on delete set null,
  add column if not exists delivery_status text not null default 'pending'
    check (delivery_status in ('pending', 'assigned', 'out_for_delivery', 'delivered')),
  add column if not exists delivered_at timestamptz,
  add column if not exists delivery_notes text,
  add column if not exists deposit_amount numeric(12, 2) not null default 0 check (deposit_amount >= 0);

-- Rentals recorded before this migration (imported registers) were already delivered.
update public.rentals set delivery_status = 'delivered' where delivery_status = 'pending';

create index if not exists idx_rentals_supervisor on public.rentals (supervisor_id);

-- ============================================================
-- 4. Sales
-- ============================================================
create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  sale_number text not null unique,
  customer_id uuid not null references public.customers (id) on delete restrict,
  sale_date date not null default current_date,
  status text not null default 'completed' check (status in ('completed', 'cancelled')),
  notes text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales (id) on delete cascade,
  equipment_unit_id uuid references public.equipment_units (id) on delete restrict,
  equipment_type_id uuid references public.equipment_types (id) on delete set null,
  description text not null,
  quantity int not null default 1 check (quantity > 0),
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  created_at timestamptz not null default now(),
  -- A tracked unit is one physical item.
  constraint sale_items_unit_quantity check (equipment_unit_id is null or quantity = 1)
);

create index if not exists idx_sales_customer on public.sales (customer_id);
create index if not exists idx_sale_items_sale on public.sale_items (sale_id);
create index if not exists idx_sale_items_unit on public.sale_items (equipment_unit_id);

-- ============================================================
-- 5. Invoices: transaction type and sale link
-- ============================================================
alter table public.invoices
  add column if not exists transaction_type text not null default 'rental'
    check (transaction_type in ('rental', 'sale')),
  add column if not exists sale_id uuid references public.sales (id) on delete set null;

alter table public.invoices drop constraint if exists invoices_single_source;
alter table public.invoices
  add constraint invoices_single_source check (rental_id is null or sale_id is null);

create index if not exists idx_invoices_sale on public.invoices (sale_id);

-- ============================================================
-- 6. Delivery photos (files live in the private 'delivery-photos' bucket)
-- ============================================================
create table if not exists public.delivery_photos (
  id uuid primary key default gen_random_uuid(),
  rental_id uuid not null references public.rentals (id) on delete cascade,
  storage_path text not null unique,
  uploaded_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index if not exists idx_delivery_photos_rental on public.delivery_photos (rental_id);

-- ============================================================
-- 7. Company settings (single row) and numbering
-- ============================================================
-- Only the business name is known. Address, GSTIN, phone and email stay NULL
-- until an admin enters them in Settings; invoices show them as missing.
create table if not exists public.company_settings (
  id boolean primary key default true check (id),
  company_name text not null,
  address text,
  phone text,
  email text,
  gstin text,
  invoice_prefix text not null default 'BCK' check (invoice_prefix ~ '^[A-Za-z0-9-]{1,12}$'),
  invoice_terms text,
  updated_by uuid references public.profiles (id),
  updated_at timestamptz not null default now()
);

insert into public.company_settings (id, company_name) values (true, 'Breath Care Kart')
on conflict (id) do nothing;

-- Invoice numbers run per calendar year: BCK/2026/0001, BCK/2026/0002, …
create table if not exists public.invoice_counters (
  year int primary key,
  last_number int not null default 0
);

create sequence if not exists public.rental_number_seq;
create sequence if not exists public.sale_number_seq;

-- ============================================================
-- 8. Activity metadata
-- ============================================================
alter table public.activity_log add column if not exists metadata jsonb not null default '{}'::jsonb;
create index if not exists idx_activity_created on public.activity_log (created_at desc);

-- ============================================================
-- 9. Attribution: the database, not the browser, says who did it
-- ============================================================
create or replace function public.set_created_by()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is not null then
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$;

create or replace function public.set_recorded_by()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is not null then
    new.recorded_by := auth.uid();
  end if;
  return new;
end;
$$;

create or replace function public.set_uploaded_by()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is not null then
    new.uploaded_by := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists set_created_by on public.customers;
create trigger set_created_by before insert on public.customers
  for each row execute function public.set_created_by();
drop trigger if exists set_created_by on public.equipment_units;
create trigger set_created_by before insert on public.equipment_units
  for each row execute function public.set_created_by();
drop trigger if exists set_created_by on public.rentals;
create trigger set_created_by before insert on public.rentals
  for each row execute function public.set_created_by();
drop trigger if exists set_created_by on public.invoices;
create trigger set_created_by before insert on public.invoices
  for each row execute function public.set_created_by();
drop trigger if exists set_created_by on public.sales;
create trigger set_created_by before insert on public.sales
  for each row execute function public.set_created_by();
drop trigger if exists set_recorded_by on public.payments;
create trigger set_recorded_by before insert on public.payments
  for each row execute function public.set_recorded_by();
drop trigger if exists set_uploaded_by on public.delivery_photos;
create trigger set_uploaded_by before insert on public.delivery_photos
  for each row execute function public.set_uploaded_by();

drop trigger if exists set_updated_at on public.sales;
create trigger set_updated_at before update on public.sales
  for each row execute function public.set_updated_at();

-- created_by / recorded_by can never be rewritten afterwards.
create or replace function public.keep_creator()
returns trigger
language plpgsql
as $$
begin
  new.created_by := old.created_by;
  return new;
end;
$$;

drop trigger if exists keep_creator on public.customers;
create trigger keep_creator before update on public.customers
  for each row execute function public.keep_creator();
drop trigger if exists keep_creator on public.equipment_units;
create trigger keep_creator before update on public.equipment_units
  for each row execute function public.keep_creator();
drop trigger if exists keep_creator on public.rentals;
create trigger keep_creator before update on public.rentals
  for each row execute function public.keep_creator();
drop trigger if exists keep_creator on public.invoices;
create trigger keep_creator before update on public.invoices
  for each row execute function public.keep_creator();
drop trigger if exists keep_creator on public.sales;
create trigger keep_creator before update on public.sales
  for each row execute function public.keep_creator();

-- ============================================================
-- 10. Activity logging (server-side only)
-- ============================================================
create or replace function public.log_activity(
  p_entity_type text,
  p_entity_id uuid,
  p_action text,
  p_description text,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language sql
security definer set search_path = public
as $$
  insert into public.activity_log (entity_type, entity_id, action, description, actor_id, metadata)
  values (p_entity_type, p_entity_id, p_action, p_description, auth.uid(), coalesce(p_metadata, '{}'::jsonb));
$$;

create or replace function public.log_customer_activity()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_activity('customer', new.id, 'created', 'Customer ' || new.name || ' added');
  elsif row(new.name, new.age, new.gender, new.attender_name, new.attender_relation, new.phone, new.whatsapp,
            new.emergency_contact, new.city, new.address, new.notes, new.alternate_phones)
        is distinct from
        row(old.name, old.age, old.gender, old.attender_name, old.attender_relation, old.phone, old.whatsapp,
            old.emergency_contact, old.city, old.address, old.notes, old.alternate_phones) then
    perform public.log_activity('customer', new.id, 'updated', 'Customer ' || new.name || ' updated');
  end if;
  return new;
end;
$$;

drop trigger if exists log_activity on public.customers;
create trigger log_activity after insert or update on public.customers
  for each row execute function public.log_customer_activity();

create or replace function public.log_equipment_activity()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_name text;
begin
  select coalesce(new.unit_code, t.name) into v_name from public.equipment_types t where t.id = new.equipment_type_id;
  if tg_op = 'INSERT' then
    perform public.log_activity('equipment', new.id, 'created', 'Equipment ' || coalesce(v_name, 'unit') || ' added');
  elsif new.status is distinct from old.status then
    perform public.log_activity('equipment', new.id, 'status_changed',
      'Equipment ' || coalesce(v_name, 'unit') || ' → ' || new.status::text,
      jsonb_build_object('from', old.status, 'to', new.status));
  end if;
  return new;
end;
$$;

drop trigger if exists log_activity on public.equipment_units;
create trigger log_activity after insert or update on public.equipment_units
  for each row execute function public.log_equipment_activity();

create or replace function public.log_profile_activity()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.role is distinct from old.role then
    perform public.log_activity('profile', new.id, 'role_changed',
      coalesce(new.full_name, new.email, 'User') || ' role → ' || new.role,
      jsonb_build_object('from', old.role, 'to', new.role));
  end if;
  if new.is_active is distinct from old.is_active then
    perform public.log_activity('profile', new.id, case when new.is_active then 'activated' else 'deactivated' end,
      coalesce(new.full_name, new.email, 'User') || case when new.is_active then ' activated' else ' deactivated' end);
  end if;
  return new;
end;
$$;

drop trigger if exists log_activity on public.profiles;
create trigger log_activity after update on public.profiles
  for each row execute function public.log_profile_activity();

create or replace function public.log_delivery_photo()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_number text;
begin
  select rental_number into v_number from public.rentals where id = new.rental_id;
  perform public.log_activity('rental', new.rental_id, 'delivery_photo_uploaded',
    'Delivery photo uploaded for ' || coalesce(v_number, 'rental'),
    jsonb_build_object('photo_id', new.id));
  return new;
end;
$$;

drop trigger if exists log_activity on public.delivery_photos;
create trigger log_activity after insert on public.delivery_photos
  for each row execute function public.log_delivery_photo();

-- ============================================================
-- 11. Payments keep invoice totals consistent (any insert/delete path)
-- ============================================================
create or replace function public.recalc_invoice_payments()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_invoice uuid := coalesce(new.invoice_id, old.invoice_id);
  v_paid numeric(12, 2);
begin
  if v_invoice is null then
    return null;
  end if;
  select coalesce(sum(amount), 0) into v_paid from public.payments where invoice_id = v_invoice;
  update public.invoices
    set amount_paid = v_paid,
        status = case
          when status in ('cancelled', 'draft') then status
          when v_paid >= grand_total then 'paid'::public.invoice_status
          when status = 'paid' then 'pending'::public.invoice_status
          else status
        end
    where id = v_invoice;
  return null;
end;
$$;

drop trigger if exists recalc_invoice_payments on public.payments;
create trigger recalc_invoice_payments after insert or delete on public.payments
  for each row execute function public.recalc_invoice_payments();

-- ============================================================
-- 12. Equipment on rent / sold only changes through the workflow functions
-- ============================================================
create or replace function public.guard_equipment_status()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status
     and (old.status in ('on_rent', 'sold') or new.status in ('on_rent', 'sold'))
     and coalesce(current_setting('app.workflow', true), '') <> 'on'
     and auth.uid() is not null then
    raise exception 'Use the rental, return or sale workflow to change this status'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_equipment_status on public.equipment_units;
create trigger guard_equipment_status before update on public.equipment_units
  for each row execute function public.guard_equipment_status();
