import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

// Chỉ mô phỏng schema do Supabase quản lý. SQL nghiệp vụ bên dưới là migration thật.
const bootstrap = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (
    id uuid primary key, aud text, role text, email text,
    email_confirmed_at timestamptz,
    raw_app_meta_data jsonb not null default '{}',
    raw_user_meta_data jsonb not null default '{}'
  );
  create schema storage;
  create table storage.buckets (
    id text primary key, name text, public boolean default false,
    file_size_limit bigint, allowed_mime_types text[]
  );
  create table storage.objects (
    id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text
  );
  alter table storage.objects enable row level security;
  grant usage on schema public, storage to anon, authenticated, service_role;
  grant select, insert, update, delete on storage.objects to anon, authenticated, service_role;
`;

export async function createTestDatabase(seed = true, phase = 5) {
  const db = new PGlite();
  await db.exec(bootstrap);
  for (const file of ["0001_core_tables.sql", "0002_security_and_storage.sql", ...(phase >= 2 ? ["0003_job_transactions.sql"] : []), ...(phase >= 3 ? ["0004_application_transactions.sql"] : []), ...(phase >= 4 ? ["0005_interview_and_inbox_transactions.sql"] : [])]) {
    await db.exec(await readFile(resolve("supabase/migrations", file), "utf8"));
  }
  if (phase >= 5) await db.exec(await readFile(resolve("supabase/migrations/0006_decisions_inbox_and_retention.sql"), "utf8"));
  if (seed) await db.exec(await readFile(resolve("supabase/seed.sql"), "utf8"));
  return db;
}
