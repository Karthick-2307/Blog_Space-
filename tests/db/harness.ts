import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { citext } from "@electric-sql/pglite/contrib/citext";

/**
 * Minimal stand-ins for the parts of Supabase the migrations depend on:
 * the anon/authenticated roles, auth.users + auth.uid(), and storage.objects.
 */
const SUPABASE_STUBS = `
create role anon nologin;
create role authenticated nologin;
create schema auth;
create schema extensions;
create schema storage;
grant usage on schema auth, extensions, storage to anon, authenticated;

create table auth.users (
  id uuid primary key,
  email text,
  raw_user_meta_data jsonb default '{}'::jsonb,
  raw_app_meta_data jsonb default '{}'::jsonb
);

create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant execute on function auth.uid() to anon, authenticated;

create table storage.buckets (
  id text primary key, name text, public boolean,
  file_size_limit bigint, allowed_mime_types text[]
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text
);
alter table storage.objects enable row level security;
grant select, insert, update, delete on storage.objects to authenticated;

create function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
$$;
grant execute on function storage.foldername(text) to anon, authenticated;
`;

export async function createTestDb() {
  const db = await PGlite.create({ extensions: { citext } });
  await db.exec(SUPABASE_STUBS);
  const dir = join(process.cwd(), "supabase", "migrations");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(join(dir, file), "utf8"));
  }
  return db;
}

export type TestDb = Awaited<ReturnType<typeof createTestDb>>;

/** Creates an auth user (the trigger then creates the profile). */
export async function signUp(db: TestDb, id: string, username: string) {
  await db.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)`, [
    id,
    `${username}@example.com`,
    JSON.stringify({ username }),
  ]);
}

/**
 * Runs SQL as a given user (or anon when userId is null), with RLS enforced.
 * Everything happens in a transaction that is rolled back unless keep=true.
 */
export async function as<T = Record<string, unknown>>(
  db: TestDb,
  userId: string | null,
  sql: string,
  params: unknown[] = [],
  keep = true,
): Promise<T[]> {
  return db.transaction(async (tx) => {
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [userId ?? ""]);
    await tx.exec(`set local role ${userId ? "authenticated" : "anon"}`);
    try {
      const res = await tx.query<T>(sql, params);
      if (!keep) await tx.rollback();
      return res.rows;
    } finally {
      // role/settings are local to the transaction
    }
  });
}
