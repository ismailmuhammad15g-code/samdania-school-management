// =============================================================================
// BROWSER RESET  —  paste this into the app's DevTools Console (F12 -> Console)
// after running SQLs/02_reset_wipe_all.sql in Supabase.
// =============================================================================
// The app mirrors the whole database in localStorage under keys prefixed
// "samdani_kv_". Until those are removed the dashboard (Collected Fees,
// Recent Fee Collections, balances, etc.) keeps showing old numbers and the
// app re-uploads them to Supabase. This script wipes that mirror so the app
// truly starts from zero. It does NOT touch the login/session hash.
//
// Run it, then hard-refresh the page (Ctrl/Cmd+Shift+R).

(function wipeLocalMirror() {
  const PREFIX = 'samdani_kv_';
  const AUTH_KEYS = ['samdani_auth_hash', 'samdani_session']; // keep login working
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(PREFIX) && !AUTH_KEYS.includes(k)) {
      keysToRemove.push(k);
    }
  }
  keysToRemove.forEach((k) => localStorage.removeItem(k));

  // Also clear any broadcast-echo leftovers and force a clean re-sync.
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel('samdani_kv_sync');
      bc.postMessage({ t: 'import', all: {} });
      bc.close();
    }
  } catch (e) { /* ignore */ }

  console.log('[reset] Removed ' + keysToRemove.length + ' local data keys:');
  console.log(keysToRemove);
  console.log('[reset] Done. Hard-refresh the page (Ctrl/Cmd+Shift+R) to reload from the empty database.');
})();
