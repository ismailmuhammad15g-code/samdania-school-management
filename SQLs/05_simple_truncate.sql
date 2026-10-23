-- Simple SQL execution script
truncate table public.kv_store restart identity;
select count(*) as remaining_rows from public.kv_store;