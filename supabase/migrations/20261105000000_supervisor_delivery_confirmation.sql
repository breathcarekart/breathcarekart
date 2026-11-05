-- Delivery confirmation is the assigned supervisor's job.
--
-- Before: admins and telecallers ("office") could also mark a delivery out for delivery or
-- delivered, and upload delivery photos (set_delivery_status, delivery_photos insert and
-- the delivery-photos storage upload all allowed public.is_office()).
--
-- After:
--   * Only the active supervisor assigned to the rental may record its delivery: upload
--     photos, mark it out for delivery, and confirm it with notes. Only while the delivery
--     is in progress (assigned / out for delivery) and the rental is open.
--   * That supervisor may remove a photo THEY uploaded, until the delivery is confirmed
--     (so a wrong photo can be replaced). Admins can still delete photos, as before.
--   * Admins and telecallers keep everything else: they see every rental, its delivery
--     status, notes and photos, and assign or reassign supervisors.
--   * Confirming still needs at least one photo (unchanged).
--
-- No data is changed. Existing photos, deliveries and rentals are untouched.
-- Depends on: 20261008000300 (role helpers), 20261008000400 (set_delivery_status),
-- 20261008000500 (delivery-photos storage policies). Safe to re-run.

-- ============================================================
-- 1. The rule, in one place
-- ============================================================
create or replace function public.can_record_delivery(p_rental_id uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select public.is_supervisor()
    and exists (
      select 1 from public.rentals r
      where r.id = p_rental_id
        and r.supervisor_id = auth.uid()
        and r.status::text not in ('completed', 'cancelled')
        and r.delivery_status in ('assigned', 'out_for_delivery')
    );
$$;

revoke execute on function public.can_record_delivery(uuid) from public, anon;
grant execute on function public.can_record_delivery(uuid) to authenticated;

-- ============================================================
-- 2. Status changes: assigned supervisor only
-- ============================================================
create or replace function public.set_delivery_status(p_rental_id uuid, p_status text, p_notes text default null)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_r public.rentals;
begin
  select * into v_r from public.rentals where id = p_rental_id for update;
  if not found or not (public.is_supervisor() and v_r.supervisor_id = auth.uid()) then
    raise exception 'Only the supervisor assigned to this rental can update its delivery'
      using errcode = '42501';
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

revoke execute on function public.set_delivery_status(uuid, text, text) from public, anon;
grant execute on function public.set_delivery_status(uuid, text, text) to authenticated;

-- ============================================================
-- 3. Photo records
-- ============================================================
-- Reading is unchanged: office staff see all, a supervisor sees their own rentals.
drop policy if exists "delivery_photos_insert" on public.delivery_photos;
create policy "delivery_photos_insert" on public.delivery_photos for insert
  with check (public.can_record_delivery(rental_id));

drop policy if exists "delivery_photos_delete" on public.delivery_photos;
create policy "delivery_photos_delete" on public.delivery_photos for delete
  using (
    public.is_admin()
    or (public.can_record_delivery(rental_id) and uploaded_by = auth.uid())
  );

-- ============================================================
-- 4. Photo files in the private delivery-photos bucket
-- ============================================================
drop policy if exists "delivery_photos_upload" on storage.objects;
create policy "delivery_photos_upload" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'delivery-photos'
    and public.delivery_photo_rental_id(name) is not null
    and public.can_record_delivery(public.delivery_photo_rental_id(name))
  );

-- A supervisor removes the file of a photo record they uploaded (the app deletes the file
-- first, then the record). Admins can delete any delivery photo file, as before.
drop policy if exists "delivery_photos_delete" on storage.objects;
create policy "delivery_photos_delete" on storage.objects for delete to authenticated
  using (
    bucket_id = 'delivery-photos'
    and (
      public.is_admin()
      or exists (
        select 1 from public.delivery_photos p
        where p.storage_path = name
          and p.uploaded_by = auth.uid()
          and public.can_record_delivery(p.rental_id)
      )
    )
  );
