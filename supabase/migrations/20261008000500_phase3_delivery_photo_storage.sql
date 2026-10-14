-- Phase 3 · 5/5 — private storage for delivery photos.
--
-- Files are stored as  delivery-photos/{rental_id}/{file}  and are never public.
-- The browser shows them through short-lived signed URLs. Who can read or upload
-- follows the same rule as the rental itself (office staff, or the assigned
-- supervisor); only admins can delete.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('delivery-photos', 'delivery-photos', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do nothing;

-- "{rental_id}/photo.jpg" → rental_id, or NULL for any other shape.
create or replace function public.delivery_photo_rental_id(p_name text)
returns uuid
language plpgsql
immutable
as $$
begin
  return split_part(p_name, '/', 1)::uuid;
exception when others then
  return null;
end;
$$;

drop policy if exists "delivery_photos_read" on storage.objects;
create policy "delivery_photos_read" on storage.objects for select to authenticated
  using (
    bucket_id = 'delivery-photos'
    and public.delivery_photo_rental_id(name) is not null
    and public.can_see_rental(public.delivery_photo_rental_id(name))
  );

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
