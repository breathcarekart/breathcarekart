-- Phase 3 · 4/5 — business workflows as atomic database functions.
--
-- Each function runs in one transaction: either every row it touches is written,
-- or none are. They are SECURITY DEFINER so they can write tables that have no
-- direct INSERT/UPDATE policy, and therefore each one checks the caller's role
-- itself. Totals, numbers and "who did it" are computed here, never trusted
-- from the browser.
--
-- Business-rule violations raise a plain exception (SQLSTATE P0001) with a
-- message that is safe to show to staff. Permission failures raise 42501.

-- ============================================================
-- Invoice numbers: {prefix}/{year}/{0001}, counted per calendar year
-- ============================================================
create or replace function public.next_invoice_number(p_date date)
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  v_year int := extract(year from p_date)::int;
  v_n int;
  v_prefix text;
begin
  insert into public.invoice_counters (year, last_number) values (v_year, 1)
  on conflict (year) do update set last_number = public.invoice_counters.last_number + 1
  returning last_number into v_n;
  select invoice_prefix into v_prefix from public.company_settings where id;
  return coalesce(v_prefix, 'INV') || '/' || v_year || '/' || lpad(v_n::text, 4, '0');
end;
$$;

-- ============================================================
-- Create a rental or sale with its invoice
-- ============================================================
-- p = {
--   transaction_type: 'rental' | 'sale',
--   customer_id, invoice_date?, due_date?, notes?,
--   tax_rate (0–100), discount?, delivery_charge?,
--   start_date?, end_date, supervisor_id?, deposit_amount?   -- rental only
--   items: [{ equipment_unit_id, rate, months? }]             -- one tracked unit per line
-- }
create or replace function public.create_invoice(p jsonb)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_type text := p ->> 'transaction_type';
  v_customer uuid := nullif(p ->> 'customer_id', '')::uuid;
  v_invoice_date date := coalesce(nullif(p ->> 'invoice_date', '')::date, current_date);
  v_due date;
  v_start date;
  v_end date;
  v_supervisor uuid := nullif(p ->> 'supervisor_id', '')::uuid;
  v_deposit numeric(12, 2) := coalesce(nullif(p ->> 'deposit_amount', '')::numeric, 0);
  v_discount numeric(12, 2) := coalesce(nullif(p ->> 'discount', '')::numeric, 0);
  v_delivery numeric(12, 2) := coalesce(nullif(p ->> 'delivery_charge', '')::numeric, 0);
  v_tax_rate numeric(5, 2) := nullif(p ->> 'tax_rate', '')::numeric;
  v_items jsonb := p -> 'items';
  v_notes text := nullif(trim(p ->> 'notes'), '');
  v_item jsonb;
  v_unit record;
  v_rate numeric(12, 2);
  v_months int;
  v_amount numeric(12, 2);
  v_desc text;
  v_subtotal numeric(12, 2) := 0;
  v_taxable numeric(12, 2);
  v_tax numeric(12, 2);
  v_customer_name text;
  v_rental uuid;
  v_sale uuid;
  v_invoice uuid;
  v_number text;
  v_ref text;
begin
  if not public.is_office() then
    raise exception 'You don''t have permission to create invoices' using errcode = '42501';
  end if;
  if v_type is null or v_type not in ('rental', 'sale') then
    raise exception 'Choose Rental or Sale';
  end if;
  select name into v_customer_name from public.customers where id = v_customer;
  if v_customer_name is null then
    raise exception 'Select an existing customer';
  end if;
  if v_items is null or jsonb_typeof(v_items) <> 'array' or jsonb_array_length(v_items) = 0 then
    raise exception 'Add at least one item';
  end if;
  if v_tax_rate is null or v_tax_rate < 0 or v_tax_rate > 100 then
    raise exception 'Choose a GST rate';
  end if;
  if v_discount < 0 or v_delivery < 0 or v_deposit < 0 then
    raise exception 'Charges cannot be negative';
  end if;
  v_due := coalesce(nullif(p ->> 'due_date', '')::date, v_invoice_date);
  if v_due < v_invoice_date then
    raise exception 'Payment due date cannot be before the invoice date';
  end if;

  -- Lets this transaction move units to on_rent / sold (see guard_equipment_status).
  perform set_config('app.workflow', 'on', true);

  if v_type = 'rental' then
    v_start := coalesce(nullif(p ->> 'start_date', '')::date, v_invoice_date);
    v_end := nullif(p ->> 'end_date', '')::date;
    if v_end is null or v_end <= v_start then
      raise exception 'Rental end date must be after the start date';
    end if;
    if v_supervisor is not null and not exists (
      select 1 from public.profiles where id = v_supervisor and role = 'supervisor' and is_active
    ) then
      raise exception 'Choose an active supervisor';
    end if;
    v_ref := 'RN-' || lpad(nextval('public.rental_number_seq')::text, 5, '0');
    insert into public.rentals (rental_number, customer_id, start_date, due_date, status, notes,
                                supervisor_id, delivery_status, deposit_amount)
    values (v_ref, v_customer, v_start, v_end, 'active', v_notes,
            v_supervisor, case when v_supervisor is null then 'pending' else 'assigned' end, v_deposit)
    returning id into v_rental;
  else
    v_ref := 'SL-' || lpad(nextval('public.sale_number_seq')::text, 5, '0');
    insert into public.sales (sale_number, customer_id, sale_date, notes)
    values (v_ref, v_customer, v_invoice_date, v_notes)
    returning id into v_sale;
  end if;

  v_number := public.next_invoice_number(v_invoice_date);
  insert into public.invoices (invoice_number, customer_id, rental_id, sale_id, transaction_type,
                               invoice_date, due_date, period_start, period_end,
                               discount, tax_rate, status, notes)
  values (v_number, v_customer, v_rental, v_sale, v_type,
          v_invoice_date, v_due, v_start, v_end,
          v_discount, v_tax_rate, 'pending', v_notes)
  returning id into v_invoice;

  for v_item in select value from jsonb_array_elements(v_items) loop
    v_rate := nullif(v_item ->> 'rate', '')::numeric;
    v_months := coalesce(nullif(v_item ->> 'months', '')::int, 1);
    if v_rate is null or v_rate < 0 then
      raise exception 'Every item needs a rate';
    end if;
    if v_months < 1 then
      raise exception 'Rental months must be at least 1';
    end if;

    select u.*, t.name as type_name into v_unit
    from public.equipment_units u
    join public.equipment_types t on t.id = u.equipment_type_id
    where u.id = nullif(v_item ->> 'equipment_unit_id', '')::uuid
    for update of u;
    if not found then
      raise exception 'Selected equipment no longer exists';
    end if;
    if v_unit.status <> 'available' then
      raise exception '% is not available (%)',
        v_unit.type_name || coalesce(' ' || v_unit.unit_code, ''), replace(v_unit.status::text, '_', ' ');
    end if;

    v_desc := v_unit.type_name
      || coalesce(' · ' || nullif(concat_ws(' ', v_unit.brand, v_unit.model), ''), '')
      || coalesce(' (' || v_unit.unit_code || ')', '');

    if v_type = 'rental' then
      v_amount := round(v_rate * v_months, 2);
      insert into public.rental_items (rental_id, equipment_unit_id, equipment_type_id, description, quantity, rate, rate_type)
      values (v_rental, v_unit.id, v_unit.equipment_type_id, v_desc, 1, v_rate, 'monthly');
      update public.equipment_units set status = 'on_rent' where id = v_unit.id;
      insert into public.invoice_items (invoice_id, equipment_unit_id, description, rental_period, quantity, rate, amount)
      values (v_invoice, v_unit.id, v_desc, v_months || case when v_months = 1 then ' month' else ' months' end,
              v_months, v_rate, v_amount);
    else
      v_amount := v_rate;
      insert into public.sale_items (sale_id, equipment_unit_id, equipment_type_id, description, quantity, unit_price)
      values (v_sale, v_unit.id, v_unit.equipment_type_id, v_desc, 1, v_rate);
      update public.equipment_units set status = 'sold' where id = v_unit.id;
      insert into public.invoice_items (invoice_id, equipment_unit_id, description, quantity, rate, amount)
      values (v_invoice, v_unit.id, v_desc, 1, v_rate, v_amount);
    end if;
    v_subtotal := v_subtotal + v_amount;
  end loop;

  if v_delivery > 0 then
    insert into public.invoice_items (invoice_id, description, quantity, rate, amount)
    values (v_invoice, 'Delivery charge', 1, v_delivery, v_delivery);
    v_subtotal := v_subtotal + v_delivery;
  end if;

  if v_discount > v_subtotal then
    raise exception 'Discount cannot be more than the subtotal';
  end if;
  v_taxable := v_subtotal - v_discount;
  v_tax := round(v_taxable * v_tax_rate / 100, 2);

  update public.invoices
    set subtotal = v_subtotal, tax_amount = v_tax, grand_total = v_taxable + v_tax
    where id = v_invoice;

  if v_type = 'rental' then
    perform public.log_activity('rental', v_rental, 'created',
      'Rental ' || v_ref || ' created for ' || v_customer_name, jsonb_build_object('invoice_id', v_invoice));
    if v_supervisor is not null then
      perform public.log_activity('rental', v_rental, 'delivery_assigned',
        'Rental ' || v_ref || ' assigned to ' || (select coalesce(full_name, email) from public.profiles where id = v_supervisor),
        jsonb_build_object('supervisor_id', v_supervisor));
    end if;
  else
    perform public.log_activity('sale', v_sale, 'created',
      'Sale ' || v_ref || ' created for ' || v_customer_name, jsonb_build_object('invoice_id', v_invoice));
  end if;
  perform public.log_activity('invoice', v_invoice, 'created',
    'Invoice ' || v_number || ' created for ' || v_customer_name,
    jsonb_build_object('total', v_taxable + v_tax, 'transaction_type', v_type));

  return jsonb_build_object('invoice_id', v_invoice, 'invoice_number', v_number,
                            'rental_id', v_rental, 'sale_id', v_sale);
end;
$$;

-- ============================================================
-- Payments
-- ============================================================
create or replace function public.record_payment(
  p_invoice_id uuid,
  p_amount numeric,
  p_method public.payment_method,
  p_payment_date date default current_date,
  p_reference text default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_inv public.invoices;
  v_outstanding numeric(12, 2);
  v_payment uuid;
begin
  if not public.is_office() then
    raise exception 'You don''t have permission to record payments' using errcode = '42501';
  end if;
  select * into v_inv from public.invoices where id = p_invoice_id for update;
  if not found then
    raise exception 'Invoice not found';
  end if;
  if v_inv.status in ('cancelled', 'draft') then
    raise exception 'Payments can''t be recorded on a % invoice', v_inv.status;
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Enter an amount greater than zero';
  end if;
  v_outstanding := v_inv.grand_total - v_inv.amount_paid;
  if p_amount > v_outstanding then
    raise exception 'Amount is more than the outstanding balance of %', v_outstanding;
  end if;

  insert into public.payments (invoice_id, rental_id, amount, payment_date, method, reference_no, notes)
  values (p_invoice_id, v_inv.rental_id, p_amount, coalesce(p_payment_date, current_date), p_method,
          nullif(trim(p_reference), ''), nullif(trim(p_notes), ''))
  returning id into v_payment;
  -- recalc_invoice_payments() updates amount_paid and status.

  perform public.log_activity('payment', v_payment, 'recorded',
    'Payment of ' || p_amount || ' recorded for ' || v_inv.invoice_number,
    jsonb_build_object('invoice_id', p_invoice_id, 'amount', p_amount, 'method', p_method));
  return v_payment;
end;
$$;

-- ============================================================
-- Rental lifecycle
-- ============================================================
create or replace function public.return_rental(p_rental_id uuid, p_returned_date date default current_date)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_r public.rentals;
begin
  if not public.is_office() then
    raise exception 'You don''t have permission to close rentals' using errcode = '42501';
  end if;
  select * into v_r from public.rentals where id = p_rental_id for update;
  if not found then
    raise exception 'Rental not found';
  end if;
  if v_r.status in ('completed', 'cancelled') then
    raise exception 'Rental % is already closed', v_r.rental_number;
  end if;
  if coalesce(p_returned_date, current_date) < v_r.start_date then
    raise exception 'Return date cannot be before the rental start date';
  end if;

  perform set_config('app.workflow', 'on', true);
  update public.rentals
    set status = 'completed', returned_date = coalesce(p_returned_date, current_date)
    where id = p_rental_id;
  update public.rental_items set returned_at = now() where rental_id = p_rental_id and returned_at is null;
  update public.equipment_units set status = 'available'
    where status = 'on_rent'
      and id in (select equipment_unit_id from public.rental_items where rental_id = p_rental_id);

  perform public.log_activity('rental', p_rental_id, 'returned',
    'Rental ' || v_r.rental_number || ' returned', jsonb_build_object('returned_date', coalesce(p_returned_date, current_date)));
end;
$$;

create or replace function public.renew_rental(p_rental_id uuid, p_new_due_date date)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_r public.rentals;
begin
  if not public.is_office() then
    raise exception 'You don''t have permission to renew rentals' using errcode = '42501';
  end if;
  select * into v_r from public.rentals where id = p_rental_id for update;
  if not found then
    raise exception 'Rental not found';
  end if;
  if v_r.status in ('completed', 'cancelled') then
    raise exception 'Rental % is closed and can''t be renewed', v_r.rental_number;
  end if;
  if p_new_due_date is null or p_new_due_date <= v_r.due_date then
    raise exception 'New end date must be after the current end date';
  end if;

  update public.rentals set due_date = p_new_due_date, status = 'active' where id = p_rental_id;
  perform public.log_activity('rental', p_rental_id, 'renewed',
    'Rental ' || v_r.rental_number || ' renewed until ' || to_char(p_new_due_date, 'DD Mon YYYY'),
    jsonb_build_object('from', v_r.due_date, 'to', p_new_due_date));
end;
$$;

-- ============================================================
-- Delivery
-- ============================================================
create or replace function public.assign_rental_supervisor(p_rental_id uuid, p_supervisor_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_r public.rentals;
  v_name text;
begin
  if not public.is_office() then
    raise exception 'You don''t have permission to assign deliveries' using errcode = '42501';
  end if;
  select * into v_r from public.rentals where id = p_rental_id for update;
  if not found then
    raise exception 'Rental not found';
  end if;
  if v_r.status in ('completed', 'cancelled') then
    raise exception 'Rental % is closed', v_r.rental_number;
  end if;
  if v_r.delivery_status = 'delivered' then
    raise exception 'Rental % is already delivered', v_r.rental_number;
  end if;
  select coalesce(full_name, email) into v_name
  from public.profiles where id = p_supervisor_id and role = 'supervisor' and is_active;
  if v_name is null then
    raise exception 'Choose an active supervisor';
  end if;

  update public.rentals
    set supervisor_id = p_supervisor_id,
        delivery_status = case when delivery_status = 'pending' then 'assigned' else delivery_status end
    where id = p_rental_id;
  perform public.log_activity('rental', p_rental_id, 'delivery_assigned',
    'Rental ' || v_r.rental_number || ' assigned to ' || v_name, jsonb_build_object('supervisor_id', p_supervisor_id));
end;
$$;

create or replace function public.set_delivery_status(p_rental_id uuid, p_status text, p_notes text default null)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_r public.rentals;
begin
  select * into v_r from public.rentals where id = p_rental_id for update;
  if not found or not (public.is_office() or (public.is_supervisor() and v_r.supervisor_id = auth.uid())) then
    raise exception 'You don''t have permission to update this delivery' using errcode = '42501';
  end if;
  if v_r.status in ('completed', 'cancelled') then
    raise exception 'Rental % is closed', v_r.rental_number;
  end if;
  if v_r.delivery_status = 'pending' then
    raise exception 'Assign a supervisor before starting delivery';
  end if;
  if v_r.delivery_status = 'delivered' then
    raise exception 'Rental % is already delivered', v_r.rental_number;
  end if;
  if p_status not in ('out_for_delivery', 'delivered')
     or (p_status = 'out_for_delivery' and v_r.delivery_status <> 'assigned') then
    raise exception 'That delivery step isn''t allowed from the current status';
  end if;
  if p_status = 'delivered' and not exists (select 1 from public.delivery_photos where rental_id = p_rental_id) then
    raise exception 'Upload a delivery photo before confirming delivery';
  end if;

  update public.rentals
    set delivery_status = p_status,
        delivered_at = case when p_status = 'delivered' then now() else delivered_at end,
        delivery_notes = coalesce(nullif(trim(p_notes), ''), delivery_notes)
    where id = p_rental_id;
  perform public.log_activity('rental', p_rental_id,
    case when p_status = 'delivered' then 'delivered' else 'out_for_delivery' end,
    'Rental ' || v_r.rental_number || case when p_status = 'delivered' then ' delivered' else ' out for delivery' end);
end;
$$;

-- ============================================================
-- Company settings audit
-- ============================================================
create or replace function public.stamp_company_settings()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  if auth.uid() is not null then
    new.updated_by := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists stamp_company_settings on public.company_settings;
create trigger stamp_company_settings before update on public.company_settings
  for each row execute function public.stamp_company_settings();

-- ============================================================
-- Who may call what
-- ============================================================
revoke execute on function public.next_invoice_number(date) from public, anon, authenticated;

revoke execute on function public.create_invoice(jsonb) from public, anon;
revoke execute on function public.record_payment(uuid, numeric, public.payment_method, date, text, text) from public, anon;
revoke execute on function public.return_rental(uuid, date) from public, anon;
revoke execute on function public.renew_rental(uuid, date) from public, anon;
revoke execute on function public.assign_rental_supervisor(uuid, uuid) from public, anon;
revoke execute on function public.set_delivery_status(uuid, text, text) from public, anon;

grant execute on function public.create_invoice(jsonb) to authenticated;
grant execute on function public.record_payment(uuid, numeric, public.payment_method, date, text, text) to authenticated;
grant execute on function public.return_rental(uuid, date) to authenticated;
grant execute on function public.renew_rental(uuid, date) to authenticated;
grant execute on function public.assign_rental_supervisor(uuid, uuid) to authenticated;
grant execute on function public.set_delivery_status(uuid, text, text) to authenticated;
