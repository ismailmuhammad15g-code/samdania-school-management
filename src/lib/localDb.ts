// Supabase-only data layer (no localStorage persistence).
//
// Data lives exclusively in the Supabase Postgres table `kv_store(key, value)`.
// An in-memory cache provides fast synchronous reads during the current session.
//
// On every startup we:
//   1. Wipe ALL `samdani_kv_*` keys from localStorage (kills any stale mirror).
//   2. Pull the current state from Supabase into the in-memory cache.
//
// This means:
//   • Deleting a row in Supabase SQL editor → immediately gone on all devices.
//   • No more "localStorage re-upload" problem — local storage is never written.
//   • Cross-device real-time sync still works via Supabase Realtime + BroadcastChannel.
//
// Public API: dbGet / dbSet / dbDelete / dbExportAll / dbImportAll / dbWipeAll
//             + initDatabase / isDbReady / onDbReady / onDbChange
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL ?? '').replace(/\/+$/, '');
let SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';
const TABLE = 'kv_store';

// ── STEP 1: Wipe the stale localStorage mirror immediately (module load time) ──
// This runs before any React code so the app never reads old local data.
const LS_PREFIX = 'samdani_kv_';
function wipeLocalStorageMirror(): void {
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(LS_PREFIX)) toRemove.push(k);
    }
    toRemove.forEach((k) => localStorage.removeItem(k));
    if (toRemove.length > 0) {
      console.log(`[localDb] Cleared ${toRemove.length} stale localStorage keys.`);
    }
  } catch {
    /* storage unavailable — ignore */
  }
}
wipeLocalStorageMirror();

// ── Config: build-time VITE_* wins; fall back to deployed /supabase-config.json ──
export async function loadConfig(): Promise<void> {
  if (SUPABASE_URL && SUPABASE_ANON) return;
  try {
    const res = await fetch('/supabase-config.json', { cache: 'no-store' });
    if (!res.ok) return;
    const c = await res.json();
    SUPABASE_URL = SUPABASE_URL || (c.VITE_SUPABASE_URL ?? '').replace(/\/+$/, '');
    SUPABASE_ANON = SUPABASE_ANON || c.VITE_SUPABASE_ANON_KEY || '';
  } catch {
    /* no deployed config */
  }
}

let client: SupabaseClient | null = null;
function getClient(): SupabaseClient {
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        storageKey: 'samdania-school-data-no-auth-session',
      },
    });
  }
  return client;
}

function enabled(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON);
}

async function pullAll(): Promise<{ data: Record<string, string>; keys: Set<string> }> {
  const out: Record<string, string> = {};
  const keys = new Set<string>();
  const res = await getClient().from(TABLE).select('key, value');
  if (res.error) throw res.error;
  for (const row of (res.data as Array<{ key: string; value: string }>) || []) {
    out[row.key] = row.value;
    keys.add(row.key);
  }
  return { data: out, keys };
}

async function remoteSet(key: string, value: string): Promise<void> {
  const res = await getClient().from(TABLE).upsert({ key, value }, { onConflict: 'key' });
  if (res.error) throw res.error;
}

async function remoteDelete(key: string): Promise<void> {
  const res = await getClient().from(TABLE).delete().eq('key', key);
  if (res.error) {
    if (/not found|0 rows/i.test(res.error.message || '')) return;
    throw res.error;
  }
}

// ── In-memory cache (only source of truth during a session) ──
const cache = new Map<string, any>();
const cacheRaw = new Map<string, string>();
const dirty = new Map<string, string>();
const removed = new Set<string>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let flushing = false;

let online = false;
let initialized = false;
const readyCallbacks: Array<() => void> = [];

// ── Real-time change subscription ──
const changeListeners: Array<(keys: string[]) => void> = [];
let notifyScheduled = false;
const pendingKeys = new Set<string>();

function notifyChanged(keys: string[]): void {
  for (const cb of changeListeners) {
    try { cb(keys); } catch { /* listener error must not break others */ }
  }
}

function scheduleNotify(key: string): void {
  pendingKeys.add(key);
  if (notifyScheduled) return;
  notifyScheduled = true;
  setTimeout(() => {
    notifyScheduled = false;
    const keys = [...pendingKeys];
    pendingKeys.clear();
    notifyChanged(keys);
  }, 80);
}

/** Subscribe to live db changes. Returns an unsubscribe function. */
export function onDbChange(cb: (keys: string[]) => void): () => void {
  changeListeners.push(cb);
  return () => {
    const i = changeListeners.indexOf(cb);
    if (i >= 0) changeListeners.splice(i, 1);
  };
}

// ── Cross-tab BroadcastChannel (same browser, multiple tabs) ──
let bc: BroadcastChannel | null = null;
try {
  if (typeof BroadcastChannel !== 'undefined') {
    bc = new BroadcastChannel('samdani_kv_sync');
  }
} catch {
  bc = null;
}

function broadcast(op: { t: 'set' | 'del' | 'import'; key?: string; raw?: string; all?: Record<string, string> }): void {
  if (bc) {
    try { bc.postMessage(op); } catch { /* ignore */ }
  }
}

type BcOp = { t: 'set' | 'del' | 'import'; key?: string; raw?: string; all?: Record<string, string> };

function applyExternal(key: string, raw: string): void {
  if (cacheRaw.get(key) === raw) return; // identical — no-op
  cache.set(key, deserialize(raw));
  cacheRaw.set(key, raw);
  // NOTE: we intentionally do NOT write to localStorage here
  scheduleNotify(key);
}

if (bc) {
  bc.addEventListener('message', (e: MessageEvent) => {
    const op = e.data as BcOp | null;
    if (!op) return;
    if (op.t === 'set' && op.key != null && op.raw != null) {
      applyExternal(op.key, op.raw);
    } else if (op.t === 'del' && op.key != null) {
      cache.delete(op.key);
      cacheRaw.delete(op.key);
      scheduleNotify(op.key);
    } else if (op.t === 'import' && op.all) {
      for (const [k, v] of Object.entries(op.all)) applyExternal(k, v);
    }
  });
}

function deserialize(raw: string | null): any {
  if (raw == null) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function scheduleFlush(): void {
  if (flushTimer === null) flushTimer = setTimeout(() => void flush(), 500);
}

async function flush(): Promise<void> {
  flushTimer = null;
  if (!online || flushing) {
    if (flushing) scheduleFlush();
    return;
  }
  flushing = true;
  try {
    const toSet = [...dirty.entries()];
    dirty.clear();
    const toDelete = [...removed];
    removed.clear();
    for (const [key, value] of toSet) {
      try {
        await remoteSet(key, value);
      } catch (e: any) {
        dirty.set(key, value);
        const status = e && e.status;
        if (status === 401 || status === 403) online = false;
      }
    }
    for (const key of toDelete) {
      try {
        await remoteDelete(key);
      } catch (e: any) {
        const status = e && e.status;
        if (status === 404) continue;
        removed.add(key);
        if (status === 401 || status === 403) online = false;
      }
    }
    if (online && dirty.size) setTimeout(scheduleFlush, 10000);
  } catch {
    setTimeout(scheduleFlush, 10000);
  } finally {
    flushing = false;
  }
}

// ── Supabase Realtime (cross-device live sync) ──
async function subscribeRealtime(): Promise<void> {
  try {
    const ch = getClient().channel('samdani_kv_sync');
    ch.on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, (payload: any) => {
      try {
        if (payload.eventType === 'DELETE') {
          const k = payload.old?.key;
          if (k != null) {
            cache.delete(k);
            cacheRaw.delete(k);
            // No localStorage to delete from
            scheduleNotify(k);
          }
        } else {
          const k = payload.new?.key;
          const v = payload.new?.value;
          if (k != null && v != null) applyExternal(k, v);
        }
      } catch {
        /* ignore malformed payloads */
      }
    });
    await ch.subscribe();
  } catch (e) {
    console.warn('[localDb] Realtime subscription failed (continuing without live sync).', e);
  }
}

export async function initDatabase(): Promise<void> {
  if (initialized) return;
  await loadConfig();

  // Always start with a clean in-memory cache.
  // localStorage was already wiped at module load time above.
  cache.clear();
  cacheRaw.clear();

  if (!enabled()) {
    // No Supabase configured — run in-memory only (empty start every session).
    console.warn('[localDb] No Supabase config found. Running in-memory only (data will not persist).');
    online = false;
    initialized = true;
    readyCallbacks.forEach((cb) => cb());
    return;
  }

  try {
    // ── ONE-TIME MIGRATION v3: wipe stale fee/loan/attendance test data from Supabase ──
    // Runs once ever per Supabase project. Checks for a marker row; if absent,
    // directly deletes the payment/loan/attendance rows from the remote table before loading,
    // then writes the marker so this never runs again on any device.
    const MIGRATION_KEY = 'samdani_migration_v3_cleared';
    const [schemaCheck, markerRes] = await Promise.all([
      getClient().from(TABLE).select('key', { count: 'exact', head: true }),
      getClient().from(TABLE).select('key').eq('key', MIGRATION_KEY).maybeSingle(),
    ]);
    if (schemaCheck.error) {
      const message = schemaCheck.error.message || '';
      if (/does not exist|relation/i.test(message)) {
        throw new Error(`Supabase table "${TABLE}" not found. Run SQLs/01_kv_store.sql in the Supabase SQL editor.`);
      }
      throw schemaCheck.error;
    }
    if (markerRes.error) throw markerRes.error;

    if (!markerRes.data) {
      // Marker absent → first run after deploy. Wipe the stale rows.
      const KEYS_TO_WIPE = [
        'samdani_payments',
        'samdani_invoice_counter',
        'samdani_loans',
        'samdani_loan_payments',
        'samdani_attendance_records',
        'samdani_student_attendance_records',
        'samdani_attendance_qrset'
      ];
      const deleteResult = await getClient().from(TABLE).delete().in('key', KEYS_TO_WIPE);
      if (deleteResult.error) throw deleteResult.error;
      // Set the marker so migration never repeats.
      const markerWrite = await getClient()
        .from(TABLE)
        .upsert({ key: MIGRATION_KEY, value: JSON.stringify(true) }, { onConflict: 'key' });
      if (markerWrite.error) throw markerWrite.error;
      console.log('[localDb] Migration v3: wiped stale fee, loan, and attendance data from Supabase.');
    }

    // STEP 2: Load ALL data exclusively from Supabase.
    const { data: remoteRaw } = await pullAll();
    for (const [k, v] of Object.entries(remoteRaw)) {
      cache.set(k, deserialize(v));
      cacheRaw.set(k, v);
    }
    online = true;
    void subscribeRealtime();
  } catch (e) {
    console.warn('[localDb] Supabase unreachable; starting with empty in-memory state.', e);
    online = false;
  } finally {
    initialized = true;
    readyCallbacks.forEach((cb) => cb());
    // No dirty keys to flush — we loaded from remote, not from local.
  }
}

export function isDbReady(): boolean {
  return initialized;
}

export function onDbReady(cb: () => void): void {
  if (initialized) { cb(); return; }
  readyCallbacks.push(cb);
}

export function dbGet(key: string): any {
  // Only reads from the in-memory cache — localStorage is never used.
  return cache.has(key) ? (cache.get(key) ?? null) : null;
}

/**
 * Fetch ONE key fresh from Supabase (bypasses the in-memory cache for that
 * read), then update the cache + notify listeners. Used by live search so
 * directory results always reflect the remote store, not a stale snapshot.
 */
export async function dbRefreshKey(key: string): Promise<any> {
  if (!enabled()) return dbGet(key);
  try {
    const res = await getClient().from(TABLE).select('value').eq('key', key).maybeSingle();
    if (res.error) throw res.error;
    if (res.data == null || res.data.value == null) {
      cache.delete(key);
      cacheRaw.delete(key);
      scheduleNotify(key);
      return null;
    }
    const raw = typeof res.data.value === 'string' ? res.data.value : JSON.stringify(res.data.value);
    applyExternal(key, raw);
    online = true;
    return cache.get(key) ?? null;
  } catch (e) {
    console.warn('[localDb] dbRefreshKey failed; falling back to cache.', e);
    return dbGet(key);
  }
}

export function dbSet(key: string, value: any): void {
  const raw = JSON.stringify(value);
  // Echo-loop guard: skip if value is unchanged.
  if (cacheRaw.get(key) === raw) return;
  cache.set(key, value);
  cacheRaw.set(key, raw);
  // NOTE: intentionally NOT writing to localStorage
  if (online) {
    dirty.set(key, raw);
    removed.delete(key);
    scheduleFlush();
  }
  broadcast({ t: 'set', key, raw });
  scheduleNotify(key);
}

export function dbDelete(key: string): void {
  const had = cache.has(key) || cacheRaw.has(key);
  cache.delete(key);
  cacheRaw.delete(key);
  // NOTE: intentionally NOT touching localStorage
  if (online) {
    removed.add(key);
    dirty.delete(key);
    scheduleFlush();
  }
  broadcast({ t: 'del', key });
  if (had) scheduleNotify(key);
}

export function dbExportAll(): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of cache) out[k] = v;
  return out;
}

/**
 * Permanently wipe ALL application data — clears the in-memory cache,
 * any remaining localStorage mirror keys, AND queues remote deletes to Supabase.
 * Auth/session keys are intentionally left untouched.
 * Reload the page after calling this to ensure React state re-hydrates empty.
 */
export function dbWipeAll(): void {
  const keys = [...cache.keys()];
  cache.clear();
  cacheRaw.clear();
  // Also wipe any stale localStorage keys (belt-and-suspenders)
  wipeLocalStorageMirror();
  for (const k of keys) {
    if (online) {
      removed.add(k);
      dirty.delete(k);
    }
  }
  if (online) scheduleFlush();
  broadcast({ t: 'import', all: {} });
  notifyChanged(keys);
}

export function dbImportAll(data: Record<string, any>): void {
  const all: Record<string, string> = {};
  cache.clear();
  cacheRaw.clear();
  for (const [k, v] of Object.entries(data)) {
    const raw = JSON.stringify(v);
    cache.set(k, v);
    cacheRaw.set(k, raw);
    // NOTE: intentionally NOT writing to localStorage
    all[k] = raw;
    if (online) {
      dirty.set(k, raw);
      removed.delete(k);
    }
  }
  removed.clear();
  if (online) scheduleFlush();
  broadcast({ t: 'import', all });
  notifyChanged(Object.keys(all));
}

if (typeof window !== 'undefined') {
  const flushNow = () => void flush();
  window.addEventListener('pagehide', flushNow);
  window.addEventListener('beforeunload', flushNow);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushNow();
  });
}
