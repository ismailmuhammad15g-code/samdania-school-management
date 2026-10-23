-- =============================================================================
-- RESET / WIPE DATABASE  —  Samdania Talimul Islam Madrasah Management System
-- =============================================================================
-- WHAT THIS DOES
--   Permanently deletes ALL application data so the app starts from zero
--   with NO mock / seed / demo data. Every student, teacher, invoice, ledger
--   entry, result, attendance, loan, salary, setting, category list, photo,
--   etc. is stored as a row in the single table `public.kv_store(key, value)`.
--   Truncating + deleting clears ALL of it.
--
-- IMPORTANT — WHY THE APP MAY STILL SHOW OLD NUMBERS
--   The browser keeps a LOCAL MIRROR in localStorage (keys prefixed
--   "samdani_kv_"). On next launch the app reads that mirror and RE-UPLOADS it
--   to Supabase, repopulating this table. So after running this SQL you MUST
--   also clear the browser mirror — see step 4 and the companion file
--   "SQLs/03_reset_local_browser.js" (paste it into DevTools console).
--
-- HOW TO USE
--   1. Open the Supabase dashboard for this project.
--   2. Go to  SQL Editor  ->  New query.
--   3. Paste this entire file and click  Run.
--   4. Then wipe the browser mirror: open the app, press F12, go to Console,
--      paste the contents of SQLs/03_reset_local_browser.js, and press Enter.
--      (Or run it now, then hard-refresh the app.)
--
-- SAFETY
--   This is irreversible. Back up first if needed:
--     select * from public.kv_store;   -- copy the result somewhere safe
-- =============================================================================

-- 1) Remove every row (all school data) -> table becomes empty (0 rows).
truncate table public.kv_store restart identity;

-- 2) Belt-and-suspenders: also explicitly delete in case TRUNCATE was blocked.
delete from public.kv_store;

-- 3) Confirm the result (should print 0).
select count(*) as remaining_rows from public.kv_store;
