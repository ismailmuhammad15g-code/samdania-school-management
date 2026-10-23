// Online-first data layer backed by a Supabase Postgres table (kv_store).
//
// Each logical key/value pair is a row:  kv_store(key text PK, value text).
// Values are JSON-serialized. A persistent localStorage mirror always
// runs underneath as a safety net, so the app never breaks or loses data
// and still works fully offline. When Supabase is unreachable we degrade
// to local-only and never throw.
//
// Public API (dbGet/dbSet/dbDelete/dbExportAll/dbImportAll + initDatabase/
// isDbReady/onDbReady/onDbChange) — plus a REAL-TIME layer: any write in one
// tab/device notifies every other open view instantly (BroadcastChannel for
// same-browser tabs, Supabase Realtime for cross-device), so the UI never
// needs a manual refresh.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL ?? '').replace(/\/+$/, '');
let SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';
const TABLE = 'kv_store';

const LS_PREFIX = 'samdani_kv_';

// ── Local offline fallback (always-on safety net) ──
function lsSet(key: string, value: string): void {
  try {
    localStorage.setItem(LS_PREFIX + key, value);
  } catch {
    /* storage full / unavailable — ignore */
  }
}
function lsGetRaw(key: string): string | null {
  try {
    return localStorage.getItem(LS_PREFIX + key);
  } catch {
    return null;
  }
}
function lsDelete(key: string): void {
  try {
    localStorage.removeItem(LS_PREFIX + key);
  } catch {
    /* ignore */
  }
}
function loadLocalMirrorRaw(): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const full = localStorage.key(i);
      if (full && full.startsWith(LS_PREFIX)) {
        const k = full.slice(LS_PREFIX.length);
        const v = localStorage.getItem(full);
        if (v != null) out[k] = v;
      }
    }
  } catch {
    /* ignore */
  }
  return out;
}

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
    /* no deployed config — fall back to local only */
  }
}

let client: SupabaseClient | null = null;
function getClient(): SupabaseClient {
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

function enabled(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON);
}

// The kv_store table is created by the SQL migration (see SQLs/01_kv_store.sql).
// Here we just confirm it exists; if not, we warn and run local-only.
async function ensureSchema(): Promise<void> {
  const res = await getClient().from(TABLE).select('key', { count: 'exact', head: true });
  if (res.error) {
    const msg = res.error.message || '';
    if (/does not exist|relation/i.test(msg)) {
      throw new Error(
        'Supabase table "' + TABLE + '" not found. Run SQLs/01_kv_store.sql in the Supabase SQL editor.'
      );
    }
    throw res.error;
  }
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
    // 404 / not-found is fine
    if (/not found|0 rows/i.test(res.error.message || '')) return;
    throw res.error;
  }
}

// ── State ──
const cache = new Map<string, any>();
const cacheRaw = new Map<string, string>();
const dirty = new Map<string, string>();
const removed = new Set<string>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let flushing = false;

let online = false;
let initialized = false;
const readyCallbacks: Array<() => void> = [];

// ── Real-time change subscription (cross-tab + cross-device) ──
const changeListeners: Array<(keys: string[]) => void> = [];
let notifyScheduled = false;
const pendingKeys = new Set<string>();

function notifyChanged(keys: string[]): void {
  for (const cb of changeListeners) {
    try {
      cb(keys);
    } catch {
      /* listener error must not break others */
    }
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

// ── Cross-tab BroadcastChannel ──
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
    try {
      bc.postMessage(op);
    } catch {
      /* ignore */
    }
  }
}

type BcOp = { t: 'set' | 'del' | 'import'; key?: string; raw?: string; all?: Record<string, string> };

/** Apply a value that originated from another tab/device. Skips if unchanged. */
function applyExternal(key: string, raw: string): void {
  if (cacheRaw.get(key) === raw) return; // identical — no-op, prevents echo loops
  cache.set(key, deserialize(raw));
  cacheRaw.set(key, raw);
  lsSet(key, raw);
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
      lsDelete(op.key);
      scheduleNotify(op.key);
    } else if (op.t === 'import' && op.all) {
      for (const [k, v] of Object.entries(op.all)) applyExternal(k, v);
    }
  });
}

function deserialize(raw: string | null): any {
  if (raw == null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
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
            lsDelete(k);
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
    console.warn('[localDb] Realtime subscription failed (continuing offline-capable).', e);
  }
}

export async function initDatabase(): Promise<void> {
  if (initialized) return;
  await loadConfig();
  const localRaw = loadLocalMirrorRaw();
  cache.clear();
  cacheRaw.clear();
  for (const [k, v] of Object.entries(localRaw)) {
    cache.set(k, deserialize(v));
    cacheRaw.set(k, v);
  }

  if (!enabled()) {
    online = false;
    initialized = true;
    readyCallbacks.forEach((cb) => cb());
    return;
  }

  try {
    await ensureSchema();
    const { data: remoteRaw, keys: remoteKeys } = await pullAll();
    for (const [k, v] of Object.entries(remoteRaw)) {
      cache.set(k, deserialize(v));
      cacheRaw.set(k, v);
    }
    const localKeys = new Set(Object.keys(localRaw));
    for (const k of localKeys) {
      if (!remoteKeys.has(k)) dirty.set(k, localRaw[k]);
    }
    online = true;
    void subscribeRealtime();
  } catch (e) {
    console.warn('[localDb] Supabase unreachable or not set up; using local fallback.', e);
    online = false;
  } finally {
    initialized = true;
    readyCallbacks.forEach((cb) => cb());
    if (online && dirty.size) scheduleFlush();
  }
}

export function isDbReady(): boolean {
  return initialized;
}

export function onDbReady(cb: () => void): void {
  if (initialized) {
    cb();
    return;
  }
  readyCallbacks.push(cb);
}

export function dbGet(key: string): any {
  if (cache.has(key)) return cache.get(key) ?? null;
  return deserialize(lsGetRaw(key));
}

export function dbSet(key: string, value: any): void {
  const raw = JSON.stringify(value);
  // Echo-loop guard: if the serialized value is identical to what we already
  // have cached, do nothing (no notify / no broadcast). This prevents the
  // persistence effect → re-pull → setState → effect → dbSet feedback loop.
  if (cacheRaw.get(key) === raw) return;
  cache.set(key, value);
  cacheRaw.set(key, raw);
  lsSet(key, raw);
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
  if (cache.has(key)) cache.delete(key);
  cacheRaw.delete(key);
  lsDelete(key);
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
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const full = localStorage.key(i);
      if (full && full.startsWith(LS_PREFIX)) {
        const k = full.slice(LS_PREFIX.length);
        if (!(k in out)) out[k] = deserialize(localStorage.getItem(full));
      }
    }
  } catch {
    /* ignore */
  }
  return out;
}

export function dbImportAll(data: Record<string, any>): void {
  const all: Record<string, string> = {};
  cache.clear();
  cacheRaw.clear();
  for (const [k, v] of Object.entries(data)) {
    const raw = JSON.stringify(v);
    cache.set(k, v);
    cacheRaw.set(k, raw);
    lsSet(k, raw);
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
