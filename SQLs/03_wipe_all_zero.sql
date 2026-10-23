-- =============================================================================
-- WIPE THE ENTIRE DATABASE TO ZERO WITH NO MOCK DATA
-- =============================================================================
-- This script permanently deletes ALL application data stored in Supabase so
-- the app starts from absolutely zero.
--
-- WHAT IT DOES (one query executed on Supabase):
--   1. TRUNCATE public.kv_store — removes every row (students, teachers, fees,
--       ledger, results, attendance, loans, salaries, settings, categories,
--       photos, etc.)
--   2. RESTART IDENTITY — resets auto-increment counters if any
--   3. This makes the `kv_store` table empty (0 rows). The app will treat that
--      as completely fresh and will show ZERO on the dashboard.
--
-- IMPORTANT SAFETY NOTE:
--   This is irreversible. Back up first if you might need the data:
--     SELECT * FROM public.kv_store;
--   Copy the result somewhere safe.
--
-- AFTER RUNNING THIS SQL:
--   1. Hard‑refresh the app (Ctrl/Cmd+Shift+R) so the frontend reloads from the
--      empty cloud table.
--   2. Run the companion JavaScript snippet below in the DevTools Console to
--      also wipe the browser mirror (localStorage). This is required because
--      the app holds the old data in memory and would re‑upload it on its next
--      auto‑save.
--   3. Confirm that the dashboard shows "Collected Fees (All Time): ৳ 0.00" /\n      "0 receipts generated", empty Recent Fee Collections, zero everywhere.
--
-- NO MOCK / SEED DATA WILL BE CREATED. Every numeric widget starts at zero.
-- =============================================================================

-- Execute the empty table operation (one statement):
BEGIN TRANSACTION;

-- 1) Empty the kv_store table — this is the single source of all school data.
TRUNCATE TABLE public.kv_store RESTART IDENTITY;

-- 2) Belt‑and‑suspenders: also delete explicitly (handles potential locks).
DELETE FROM public.kv_store;

-- 3) Confirm the result (should print "0").
SELECT count(*) AS remaining_rows FROM public.kv_store;

COMMIT;
