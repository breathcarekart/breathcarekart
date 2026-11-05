-- ROLLBACK for migration 20261105000000_supervisor_delivery_confirmation.
--
-- Restores the delivery permissions exactly as they were in production before that
-- migration (verified against production on 2026-11-05):
--   * set_delivery_status: office staff (admin, telecaller) OR the assigned supervisor
--     may mark a delivery out for delivery / delivered        (20261008000400)
--   * delivery_photos insert: anyone who can see the rental   (20261008000300)
--   * delivery_photos delete: admins only                     (20261008000300)
--   * delivery-photos storage upload: anyone who can see the rental
--   * delivery-photos storage delete: admins only             (20261008000500)
-- and removes public.can_record_delivery(uuid).
--
-- No data is changed: no rows in rentals, delivery_photos, storage.objects or any other
-- table are inserted, updated or deleted. Photos uploaded while the migration was live
-- stay in place.
--
-- Run as ONE transaction with psql stopping on the first error, e.g.
--   psql -X -v ON_ERROR_STOP=1 -f 20261105000000_supervisor_delivery_confirmation.rollback.sql
-- (do NOT add psql -1: this file has its own BEGIN/COMMIT). Any error before COMMIT leaves
-- the database exactly as it was. Safe to run more than once.

begin;

set local role postgres;
set local lock_timeout = '15s';
set local statement_timeout = '120s';

-- ============================================================
-- 1. set_delivery_status: office staff OR the assigned supervisor (20261008000400)
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

revoke execute on function public.set_delivery_status(uuid, text, text) from public, anon;
grant execute on function public.set_delivery_status(uuid, text, text) to authenticated;

-- ============================================================
-- 2. Photo records (20261008000300)
-- ============================================================
drop policy if exists "delivery_photos_insert" on public.delivery_photos;
create policy "delivery_photos_insert" on public.delivery_photos for insert with check (public.can_see_rental(rental_id));

drop policy if exists "delivery_photos_delete" on public.delivery_photos;
create policy "delivery_photos_delete" on public.delivery_photos for delete using (public.is_admin());

-- ============================================================
-- 3. Photo files in the private delivery-photos bucket (20261008000500)
-- ============================================================
drop policy if exists "delivery_photos_upload" on storage.objects;
create policy "delivery_photos_upload" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'delivery-photos'
    and public.delivery_photo_rental_id(name) is not null
    and public.can_see_rental(public.delivery_photo_rental_id(name))
  );

drop policy if exists "delivery_photos_delete" on storage.objects;
create policy "delivery_photos_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'delivery-photos' and public.is_admin());

-- ============================================================
-- 4. Remove the helper. Done last, after nothing above uses it any more. RESTRICT (the
--    default): if anything else still depends on it, this fails and the whole rollback
--    is undone instead of silently dropping that dependent object.
-- ============================================================
drop function if exists public.can_record_delivery(uuid) restrict;

-- ============================================================
-- 5. Forget the migration, so it can be applied again later with the usual tooling.
-- ============================================================
delete from supabase_migrations.schema_migrations where version = '20261105000000';

commit;
