-- Security hardening: stop staff from promoting themselves to admin.
--
-- The "profiles_update_self" policy lets a user update their own profile row,
-- and RLS cannot restrict which columns an UPDATE touches. Without this guard a
-- staff user could run `update profiles set role = 'admin' where id = auth.uid()`.
--
-- Role changes are now only allowed when:
--   * the caller is an admin (public.is_admin()), or
--   * there is no end-user JWT (auth.uid() is null): the service role, the
--     Supabase SQL editor, or migrations. This is how the first admin is created.
-- The existing policies are unchanged; this adds a check on top of them.

create function public.prevent_unauthorized_role_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null
     and not public.is_admin() then
    raise exception 'Only admins can change user roles'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger prevent_unauthorized_role_change
  before update on public.profiles
  for each row execute function public.prevent_unauthorized_role_change();
