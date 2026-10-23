-- Run this in Supabase: SQL Editor -> Run
-- Stores all app key/value data as rows in a single table.
-- The browser app uses the "anon" key, so row-level security is
-- opened for anon + authenticated so the app can read/write.
-- (This is a single-tenant school app; public access is acceptable.
--  For stronger isolation, restrict the policy to a known role instead.)

create table if not exists public.kv_store (
  key   text primary key,
  value text not null
);

create index if not exists kv_store_key_idx on public.kv_store (key);

alter table public.kv_store enable row level security;

drop policy if exists "kv_store_public_all" on public.kv_store;
create policy "kv_store_public_all"
  on public.kv_store
  for all
  to anon, authenticated
  using (true)
  with check (true);
