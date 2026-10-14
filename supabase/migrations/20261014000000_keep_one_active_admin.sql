-- Never let the system end up with no active admin.
--
-- The Users & Roles screen already hides actions on your own row, but that is only
-- the interface. This is enforced in the database, so it also covers the API, SQL
-- run from the dashboard or CLI, and deleting a login (which cascades to profiles).
--
-- Paths covered:
--   * demote an active admin (role -> telecaller/supervisor)
--   * deactivate an active admin (is_active -> false)
--   * delete an active admin's profile, directly or by deleting the auth user
--   * TRUNCATE profiles
--
-- To remove the last admin on purpose, make another user an active admin first.
-- No data is changed by this migration.

-- ============================================================
-- 1. The check
-- ============================================================
-- Runs AFTER the change, so a single statement that swaps admins
-- (A -> telecaller, B -> admin) is judged on its final result. It looks at the
-- whole table rather than the one row, which also covers deletes.
create or replace function public.ensure_active_admin()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  -- One at a time. Without this, two admins demoting each other in separate
  -- transactions could both see the other still active and both succeed. The second
  -- waits here until the first commits, then re-checks with a fresh view of the table.
  -- (Assumes the default READ COMMITTED isolation, which Supabase uses.)
  perform pg_advisory_xact_lock(hashtext('breathcarekart.active_admin'));

  if not exists (select 1 from public.profiles where role = 'admin' and is_active) then
    raise exception 'At least one active admin is required. Make another user an active admin first.';
  end if;
  return null;
end;
$$;

-- ============================================================
-- 2. Triggers: only fire when an ACTIVE admin row is changed away or removed
-- ============================================================
-- Everything else (edits to names, other roles, promotions, activations, creating
-- the first admin on an empty database) is untouched and takes no lock.
drop trigger if exists keep_one_active_admin_on_update on public.profiles;
create trigger keep_one_active_admin_on_update
  after update on public.profiles
  for each row
  when (old.role = 'admin' and old.is_active and (new.role <> 'admin' or not new.is_active))
  execute function public.ensure_active_admin();

drop trigger if exists keep_one_active_admin_on_delete on public.profiles;
create trigger keep_one_active_admin_on_delete
  after delete on public.profiles
  for each row
  when (old.role = 'admin' and old.is_active)
  execute function public.ensure_active_admin();

-- ============================================================
-- 3. TRUNCATE
-- ============================================================
-- The API can't send TRUNCATE, but the table grants allow it on a direct connection,
-- and TRUNCATE skips row-level triggers. This also stops TRUNCATE ... CASCADE from
-- auth.users reaching profiles.
create or replace function public.block_profiles_truncate()
returns trigger
language plpgsql
as $$
begin
  raise exception 'The profiles table can''t be truncated: it holds the staff accounts and their roles.';
end;
$$;

drop trigger if exists block_profiles_truncate on public.profiles;
create trigger block_profiles_truncate
  before truncate on public.profiles
  for each statement
  execute function public.block_profiles_truncate();
