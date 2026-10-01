-- Schema support for importing the paper rental registers (2025 onwards).
-- The registers record who rented what, at what rate, and each monthly payment,
-- but not individual equipment units, invoices, or payment methods. These
-- changes let that history live in the real tables without inventing data.

-- ============================================================
-- customers
-- ============================================================
-- A few register entries have no phone number.
alter table public.customers alter column phone drop not null;

-- Registers often list 2-3 numbers per customer; keep all of them searchable.
alter table public.customers add column alternate_phones text[] not null default '{}';

-- Stable key for imported rows so the import can be re-run safely.
alter table public.customers add column legacy_ref text unique;

-- ============================================================
-- rentals
-- ============================================================
alter table public.rentals add column legacy_ref text unique;

-- ============================================================
-- rental_items
-- ============================================================
-- Register entries describe equipment in free text ("5 Function icu bed with
-- mattress, 5L concentrator") without identifying a physical unit.
alter table public.rental_items alter column equipment_unit_id drop not null;
alter table public.rental_items add column description text;
alter table public.rental_items add column equipment_type_id uuid references public.equipment_types (id) on delete set null;
alter table public.rental_items
  add constraint rental_items_unit_or_description
  check (equipment_unit_id is not null or description is not null);

-- Some entries have no recorded rate.
alter table public.rental_items alter column rate drop not null;

-- Short rentals are often a flat amount ("4,000 for 4 days", "2,000 for 12 hrs").
alter table public.rental_items drop constraint rental_items_rate_type_check;
alter table public.rental_items
  add constraint rental_items_rate_type_check
  check (rate_type in ('daily', 'monthly', 'fixed'));

create index idx_rental_items_type on public.rental_items (equipment_type_id);

-- ============================================================
-- payments
-- ============================================================
-- Register payments are per rental billing period, not against an invoice.
alter table public.payments alter column invoice_id drop not null;
alter table public.payments add column rental_id uuid references public.rentals (id) on delete cascade;
alter table public.payments add column period_start date;
alter table public.payments add column period_end date;
alter table public.payments add column legacy_ref text unique;
alter table public.payments
  add constraint payments_invoice_or_rental
  check (invoice_id is not null or rental_id is not null);

create index idx_payments_rental on public.payments (rental_id);

-- The registers never record how a payment was made.
alter type public.payment_method add value if not exists 'unknown';
