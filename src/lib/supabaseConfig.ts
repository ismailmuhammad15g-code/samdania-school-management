// Single source of the public Supabase project settings used by the browser.
// Build-time VITE_* values win; otherwise the deployed /supabase-config.json is used,
// so the data layer (localDb) and the admin login/SMS session (auth) always agree.
let url = (import.meta.env.VITE_SUPABASE_URL ?? '').trim().replace(/\/+$/, '');
let anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim();
let pending: Promise<void> | null = null;

export function getSupabaseConfig(): { url: string; anonKey: string } | null {
  return url && anonKey ? { url, anonKey } : null;
}

export function loadSupabaseConfig(): Promise<void> {
  if (getSupabaseConfig()) return Promise.resolve();
  pending ??= (async () => {
    try {
      const res = await fetch('/supabase-config.json', { cache: 'no-store' });
      if (!res.ok) return;
      const saved = await res.json() as Record<string, unknown>;
      if (!url && typeof saved.VITE_SUPABASE_URL === 'string') url = saved.VITE_SUPABASE_URL.trim().replace(/\/+$/, '');
      if (!anonKey && typeof saved.VITE_SUPABASE_ANON_KEY === 'string') anonKey = saved.VITE_SUPABASE_ANON_KEY.trim();
    } catch {
      /* no deployed config, or offline — the next call retries */
    }
  })().finally(() => { pending = null; });
  return pending;
}
