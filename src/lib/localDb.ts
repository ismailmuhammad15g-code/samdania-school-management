// Supabase-only data layer (no localStorage persistence).
//
// Data lives exclusively in the Supabase Postgres table `kv_store(key, value)`.
// An in-memory cache provides fast synchronous reads during the current session.
//
// Safety rules (this holds a school's money records, so they are strict):
//   • NOTHING is ever written to Supabase until the full current state has been
//     loaded from it. A failed/slow start-up can therefore never overwrite real
//     records with an empty list. The app shows a "reconnecting" screen instead
//     and keeps retrying by itself.
//   • A change stays queued until Supabase confirms it; a failed save is retried
//     and never replaces a newer edit with an older value.
//   • Remote updates never overwrite a key that has local changes still waiting
//     to be saved.
//   • Nothing here deletes data on its own — only explicit dbDelete/dbWipeAll.
//
// Public API: dbGet / dbSet / dbDelete / dbExportAll / dbImportAll / dbWipeAll
//             + initDatabase / isDbReady / onDbReady / onDbChange
//             + getDbStatus / subscribeDbStatus / retryDbConnection
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseConfig, loadSupabaseConfig } from './supabaseConfig';

const TABLE = 'kv_store';

// ── Wipe any stale localStorage mirror from older versions (module load time) ──
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

let client: SupabaseClient | null = null;
function getClient(): SupabaseClient {
  if (!client) {
    const config = getSupabaseConfig();
    if (!config) throw new Error('Supabase is not configured.');
    client = createClient(config.url, config.anonKey, {
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
  return getSupabaseConfig() !== null;
}

function describeError(error: unknown): string {
  const e = error as { message?: string; status?: number; code?: string } | null;
  const message = e?.message || String(error);
  if (/failed to fetch|networkerror|load failed|network request failed|fetch failed/i.test(message)) {
    return 'Cannot reach the database (Supabase). Check the internet connection.';
  }
  if (e?.status === 401 || e?.status === 403 || /permission denied|row-level security|jwt/i.test(message)) {
    return `The database refused the request (${message}). Check the kv_store policy and the Supabase anon key.`;
  }
  if (/does not exist|relation/i.test(message)) {
    return `Supabase table "${TABLE}" not found. Run SQLs/01_kv_store.sql in the Supabase SQL editor.`;
  }
  return message;
}

async function pullAll(): Promise<Record<string, string>> {
  const res = await getClient().from(TABLE).select('key, value');
  if (res.error) throw res.error;
  const out: Record<string, string> = {};
  for (const row of (res.data as Array<{ key: string; value: string }>) || []) {
    out[row.key] = typeof row.value === 'string' ? row.value : JSON.stringify(row.value);
  }
  return out;
}

async function remoteSet(key: string, value: string): Promise<void> {
  const res = await getClient().from(TABLE).upsert({ key, value }, { onConflict: 'key' });
  if (res.error) throw res.error;
}

async function remoteDelete(key: string): Promise<void> {
  const res = await getClient().from(TABLE).delete().eq('key', key);
  if (res.error) throw res.error;
}

// ── In-memory cache (only source of truth during a session) ──
const cache = new Map<string, any>();
const cacheRaw = new Map<string, string>();
// Changes not yet confirmed by Supabase. An entry is removed only after a
// successful save of that exact value, so a failure can never lose or reorder edits.
const dirty = new Map<string, string>();
const removed = new Set<string>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let flushing = false;
// Bumped by every local write/save. A remote read that started before a bump may be
// older than what this device just saved, so it is discarded instead of applied.
let mutationEpoch = 0;

/** True only after the full remote state has been loaded — the gate for every write. */
let online = false;
/** True once the app may read the cache: loaded from Supabase, or running unconfigured. */
let initialized = false;
let realtimeStarted = false;
let lastSyncAt = 0;
const readyCallbacks: Array<() => void> = [];

// ── Connection / save status (for the UI) ──
export type DbState = 'connecting' | 'online' | 'offline' | 'unconfigured';
export interface DbStatus {
  state: DbState;
  /** Changes made here that Supabase has not confirmed yet. */
  unsaved: number;
  /** Why loading failed (state "offline"). */
  loadError: string | null;
  /** Why the last save failed (state "online" with unsaved changes). */
  saveError: string | null;
}

let state: DbState = 'connecting';
let loadError: string | null = null;
let saveError: string | null = null;
let statusSnapshot: DbStatus = { state, unsaved: 0, loadError, saveError };
const statusListeners = new Set<() => void>();

function emitStatus(): void {
  const unsaved = dirty.size + removed.size;
  if (
    statusSnapshot.state === state &&
    statusSnapshot.unsaved === unsaved &&
    statusSnapshot.loadError === loadError &&
    statusSnapshot.saveError === saveError
  ) return;
  statusSnapshot = { state, unsaved, loadError, saveError };
  statusListeners.forEach((listener) => listener());
}

export function getDbStatus(): DbStatus {
  return statusSnapshot;
}

/** useSyncExternalStore-compatible subscription. */
export function subscribeDbStatus(listener: () => void): () => void {
  statusListeners.add(listener);
  return () => { statusListeners.delete(listener); };
}

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

type BcOp = { t: 'set' | 'del' | 'import'; key?: string; raw?: string; all?: Record<string, string> };

function broadcast(op: BcOp): void {
  if (bc) {
    try { bc.postMessage(op); } catch { /* ignore */ }
  }
}

function deserialize(raw: string | null): any {
  if (raw == null) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

// A remote/other-tab value never replaces a key that still has unsaved local changes.
function applyExternal(key: string, raw: string): void {
  if (dirty.has(key) || removed.has(key)) return;
  if (cacheRaw.get(key) === raw) return; // identical — no-op
  cache.set(key, deserialize(raw));
  cacheRaw.set(key, raw);
  scheduleNotify(key);
}

function applyExternalDelete(key: string): void {
  if (dirty.has(key) || removed.has(key)) return;
  if (!cache.has(key) && !cacheRaw.has(key)) return;
  cache.delete(key);
  cacheRaw.delete(key);
  scheduleNotify(key);
}

if (bc) {
  bc.addEventListener('message', (e: MessageEvent) => {
    // Another tab's data is only trusted once this tab has loaded its own copy.
    if (!initialized) return;
    const op = e.data as BcOp | null;
    if (!op) return;
    if (op.t === 'set' && op.key != null && op.raw != null) {
      applyExternal(op.key, op.raw);
    } else if (op.t === 'del' && op.key != null) {
      applyExternalDelete(op.key);
    } else if (op.t === 'import' && op.all) {
      for (const [k, v] of Object.entries(op.all)) applyExternal(k, v);
    }
  });
}

// ── Saving ──
const RETRY_SAVE_MS = 10_000;

function scheduleFlush(delay = 500): void {
  if (flushTimer === null) flushTimer = setTimeout(() => void flush(), delay);
}

async function flush(): Promise<void> {
  flushTimer = null;
  if (!online) return; // never write before the full remote state has been loaded
  if (flushing) { scheduleFlush(); return; }
  flushing = true;
  let failure: string | null = null;
  try {
    for (const [key, raw] of [...dirty]) {
      try {
        await remoteSet(key, raw);
        mutationEpoch++;
        // Keep the entry if the value changed while it was being sent; it is saved next round.
        if (dirty.get(key) === raw) dirty.delete(key);
      } catch (e) {
        failure = describeError(e);
      }
    }
    for (const key of [...removed]) {
      try {
        await remoteDelete(key);
        mutationEpoch++;
        removed.delete(key);
      } catch (e) {
        failure = describeError(e);
      }
    }
  } finally {
    flushing = false;
    saveError = failure;
    emitStatus();
  }
  if (failure) scheduleFlush(RETRY_SAVE_MS);
  else if (dirty.size || removed.size) scheduleFlush();
}

// ── Supabase Realtime (cross-device live sync) ──
async function subscribeRealtime(): Promise<void> {
  if (realtimeStarted) return;
  realtimeStarted = true;
  try {
    const ch = getClient().channel('samdani_kv_sync');
    ch.on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, (payload: any) => {
      try {
        if (payload.eventType === 'DELETE') {
          const k = payload.old?.key;
          if (k != null) applyExternalDelete(k);
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
    realtimeStarted = false;
    console.warn('[localDb] Realtime subscription failed (continuing without live sync).', e);
  }
}

// ── Loading ──
let loading = false;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempt = 0;

/** Loads the complete remote state. Returns false (and keeps retrying) on any failure. */
async function loadFromRemote(): Promise<boolean> {
  if (loading) return false;
  loading = true;
  try {
    const remote = await pullAll();

    const touched = new Set<string>([...cache.keys(), ...Object.keys(remote)]);
    cache.clear();
    cacheRaw.clear();
    for (const [k, v] of Object.entries(remote)) {
      cache.set(k, deserialize(v));
      cacheRaw.set(k, v);
    }
    online = true;
    lastSyncAt = Date.now();
    reconnectAttempt = 0;
    loadError = null;
    state = 'online';
    initialized = true;
    void subscribeRealtime();
    emitStatus();
    readyCallbacks.splice(0).forEach((cb) => cb());
    notifyChanged([...touched]);
    return true;
  } catch (e) {
    console.warn('[localDb] Could not load data from Supabase; will retry.', e);
    loadError = describeError(e);
    state = 'offline';
    emitStatus();
    return false;
  } finally {
    loading = false;
  }
}

function scheduleReconnect(): void {
  if (online || reconnectTimer !== null) return;
  const delay = Math.min(30_000, 2_000 * 2 ** reconnectAttempt++);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    void retryDbConnection();
  }, delay);
}

/** Retry loading right now (used by the "Retry" button and when the network returns). */
export async function retryDbConnection(): Promise<boolean> {
  if (online || !enabled() || loading) return online;
  if (reconnectTimer !== null) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  state = 'connecting';
  emitStatus();
  const ok = await loadFromRemote();
  if (!ok) scheduleReconnect();
  return ok;
}

/**
 * Re-reads the remote state after the network or tab comes back, so edits made
 * from this device after a long sleep are never based on stale data. Keys with
 * unsaved local changes are left untouched.
 */
async function resyncFromRemote(): Promise<void> {
  if (!online || loading || flushing) return;
  loading = true;
  try {
    const epoch = mutationEpoch;
    const remote = await pullAll();
    if (epoch !== mutationEpoch) return; // something was saved meanwhile — this snapshot may be older
    for (const [k, v] of Object.entries(remote)) applyExternal(k, v);
    for (const k of [...cache.keys()]) {
      if (!(k in remote)) applyExternalDelete(k);
    }
    lastSyncAt = Date.now();
  } catch (e) {
    console.warn('[localDb] Background re-sync failed; will try again later.', e);
  } finally {
    loading = false;
  }
}

let initPromise: Promise<void> | null = null;

/** Starts loading (idempotent — safe to call from React StrictMode's double effect). */
export function initDatabase(): Promise<void> {
  initPromise ??= startDatabase();
  return initPromise;
}

async function startDatabase(): Promise<void> {
  await loadSupabaseConfig();

  // Always start with a clean in-memory cache.
  cache.clear();
  cacheRaw.clear();

  if (!enabled()) {
    // No Supabase configured — run in-memory only (data will not persist).
    console.warn('[localDb] No Supabase config found. Running in-memory only (data will not persist).');
    online = false;
    state = 'unconfigured';
    initialized = true;
    emitStatus();
    readyCallbacks.splice(0).forEach((cb) => cb());
    return;
  }

  state = 'connecting';
  emitStatus();
  if (!(await loadFromRemote())) scheduleReconnect();
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
 * Fetch ONE key fresh from Supabase, then update the cache + notify listeners.
 * Used by live search so results reflect the remote store, not a stale snapshot.
 * Read-only: it never changes the connection state, and never replaces a key
 * that has unsaved local changes.
 */
export async function dbRefreshKey(key: string): Promise<any> {
  if (!online) return dbGet(key);
  try {
    const epoch = mutationEpoch;
    const res = await getClient().from(TABLE).select('value').eq('key', key).maybeSingle();
    if (res.error) throw res.error;
    if (epoch !== mutationEpoch) return dbGet(key); // saved meanwhile — the fetched copy may be older
    if (res.data == null || res.data.value == null) {
      applyExternalDelete(key);
      return dbGet(key);
    }
    applyExternal(key, typeof res.data.value === 'string' ? res.data.value : JSON.stringify(res.data.value));
    return dbGet(key);
  } catch (e) {
    console.warn('[localDb] dbRefreshKey failed; falling back to cache.', e);
    return dbGet(key);
  }
}

export function dbSet(key: string, value: any): void {
  const raw = JSON.stringify(value);
  // Echo-loop guard: skip if value is unchanged.
  if (cacheRaw.get(key) === raw) return;
  mutationEpoch++;
  cache.set(key, value);
  cacheRaw.set(key, raw);
  if (online) {
    dirty.set(key, raw);
    removed.delete(key);
    scheduleFlush();
    emitStatus();
  }
  broadcast({ t: 'set', key, raw });
  scheduleNotify(key);
}

export function dbDelete(key: string): void {
  const had = cache.has(key) || cacheRaw.has(key);
  mutationEpoch++;
  cache.delete(key);
  cacheRaw.delete(key);
  if (online) {
    removed.add(key);
    dirty.delete(key);
    scheduleFlush();
    emitStatus();
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
  mutationEpoch++;
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
  if (online) { scheduleFlush(); emitStatus(); }
  broadcast({ t: 'import', all: {} });
  notifyChanged(keys);
}

export function dbImportAll(data: Record<string, any>): void {
  const all: Record<string, string> = {};
  mutationEpoch++;
  cache.clear();
  cacheRaw.clear();
  for (const [k, v] of Object.entries(data)) {
    const raw = JSON.stringify(v);
    cache.set(k, v);
    cacheRaw.set(k, raw);
    all[k] = raw;
    if (online) {
      dirty.set(k, raw);
      removed.delete(k);
    }
  }
  removed.clear();
  if (online) { scheduleFlush(); emitStatus(); }
  broadcast({ t: 'import', all });
  notifyChanged(Object.keys(all));
}

if (typeof window !== 'undefined') {
  const flushNow = () => { if (online && (dirty.size || removed.size)) void flush(); };
  window.addEventListener('pagehide', flushNow);

  // Closing the tab with changes Supabase has not confirmed would lose them — ask first.
  window.addEventListener('beforeunload', (event) => {
    flushNow();
    if (dirty.size || removed.size) {
      event.preventDefault();
      event.returnValue = '';
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      flushNow();
    } else if (!online) {
      void retryDbConnection();
    } else if (Date.now() - lastSyncAt > 60_000) {
      void resyncFromRemote();
    }
  });

  window.addEventListener('online', () => {
    if (!online) void retryDbConnection();
    else {
      scheduleFlush(0);
      void resyncFromRemote();
    }
  });
}
