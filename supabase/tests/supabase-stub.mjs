// In-memory Postgres (PGlite) prepared like a fresh Supabase project — the auth
// schema, API roles and storage tables the migrations rely on — then every
// migration in supabase/migrations is applied in order. No Docker needed.
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const MIG = fileURLToPath(new URL("../migrations", import.meta.url));

export async function createDb() {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema extensions; create extension pgcrypto with schema extensions;
    create schema graphql_public;
    create schema auth;
    create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;

    -- Storage (the parts the migrations touch)
    create schema storage;
    create table storage.buckets (id text primary key, name text, public boolean default false,
      file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id),
      name text, owner uuid default auth.uid(), created_at timestamptz default now());
    alter table storage.objects enable row level security;
    grant usage on schema storage to anon, authenticated, service_role;
    grant all on storage.objects, storage.buckets to anon, authenticated, service_role;

    -- Supabase's default grants for objects created in public
    grant usage on schema public to anon, authenticated, service_role;
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  `);
  const applied = [];
  for (const f of readdirSync(MIG).sort()) {
    await db.exec(readFileSync(`${MIG}/${f}`, "utf8"));
    applied.push(f);
  }
  return { db, applied };
}
