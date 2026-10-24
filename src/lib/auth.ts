import { sha256Hex } from './sha256';
import { dbGet, dbSet, isDbReady } from './localDb';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SESSION_KEY = 'samdani_admin_session';
const CRED_KEY = 'samdani_admin_credentials';

const ENV = import.meta.env;
const AUTH_SALT = (ENV.VITE_AUTH_SALT as string | undefined)?.trim() || 'SamdaniaSalt2026';
const DEFAULT_EMAIL = (ENV.VITE_ADMIN_EMAIL as string | undefined)?.trim() || 'admin@madrasah.com';
const DEFAULT_PASSWORD = (ENV.VITE_ADMIN_PASSWORD as string | undefined)?.trim() || 'admin123';
const SUPABASE_URL = ENV.VITE_SUPABASE_URL?.trim();
const SUPABASE_ANON_KEY = ENV.VITE_SUPABASE_ANON_KEY?.trim();
const authClientHolder = globalThis as typeof globalThis & {
  __samdaniaWebsiteAdminAuthClient?: SupabaseClient;
};

export function getAuthClient(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Supabase URL and anon key are required for the website admin API.');
  }
  if (!authClientHolder.__samdaniaWebsiteAdminAuthClient) {
    authClientHolder.__samdaniaWebsiteAdminAuthClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        storageKey: 'samdania-website-admin-auth-session',
      },
    });
  }
  return authClientHolder.__samdaniaWebsiteAdminAuthClient;
}

export function hasWebsiteAdminAccess(session: { user: { app_metadata?: Record<string, unknown> } } | null): boolean {
  return session?.user.app_metadata?.main_madrasah_admin === true;
}

interface StoredCreds {
  email: string;
  passwordHash: string;
}

function defaultCreds(): StoredCreds {
  return {
    email: DEFAULT_EMAIL,
    passwordHash: sha256Hex(DEFAULT_PASSWORD + AUTH_SALT),
  };
}

function isValidCreds(value: unknown): value is StoredCreds {
  if (!value || typeof value !== 'object') return false;
  const v = value as StoredCreds;
  return typeof v.email === 'string' && v.email.trim() !== '' && typeof v.passwordHash === 'string' && v.passwordHash.length >= 32;
}

function getCreds(): StoredCreds {
  if (isDbReady()) {
    const fromDb = dbGet(CRED_KEY);
    if (isValidCreds(fromDb)) return fromDb;
  }

  try {
    const raw = localStorage.getItem(CRED_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (isValidCreds(parsed)) return parsed;
    }
  } catch {
    /* ignore corrupt localStorage */
  }

  return defaultCreds();
}

function saveCreds(creds: StoredCreds): void {
  try {
    localStorage.setItem(CRED_KEY, JSON.stringify(creds));
  } catch {
    /* ignore */
  }
  if (isDbReady()) dbSet(CRED_KEY, creds);
}

export function ensureAdminCredentials(): StoredCreds {
  const defaults = defaultCreds();

  if (isDbReady()) {
    const fromDb = dbGet(CRED_KEY);
    if (isValidCreds(fromDb)) {
      try {
        localStorage.setItem(CRED_KEY, JSON.stringify(fromDb));
      } catch {
        /* ignore */
      }
      return fromDb;
    }
  }

  try {
    const raw = localStorage.getItem(CRED_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (isValidCreds(parsed)) {
        if (isDbReady()) dbSet(CRED_KEY, parsed);
        return parsed;
      }
    }
  } catch {
    /* ignore */
  }

  saveCreds(defaults);
  return defaults;
}

export interface AdminSession {
  email: string;
  name: string;
  loggedInAt: string;
}

async function hashPassword(password: string): Promise<string> {
  return sha256Hex(password + AUTH_SALT);
}

export { hashPassword };

export async function loginAdmin(email: string, password: string): Promise<AdminSession | null> {
  ensureAdminCredentials();

  const trimmedEmail = email.trim();
  if (!trimmedEmail || !password) return null;

  const hash = await hashPassword(password);
  const defaults = defaultCreds();
  const defaultEmailMatches = trimmedEmail.toLowerCase() === defaults.email.toLowerCase();
  const defaultPasswordMatches = hash === defaults.passwordHash;

  let acceptedEmail: string;
  if (defaultEmailMatches && defaultPasswordMatches) {
    saveCreds(defaults);
    acceptedEmail = defaults.email;
  } else {
    const creds = getCreds();
    if (trimmedEmail.toLowerCase() !== creds.email.toLowerCase() || hash !== creds.passwordHash) return null;
    acceptedEmail = creds.email;
  }

  try {
    const client = getAuthClient();
    const { data, error } = await client.auth.signInWithPassword({
      email: acceptedEmail,
      password,
    });
    if (error) {
      console.warn('Website admin API session was not established. The software login remains available.', error.message);
    } else if (!hasWebsiteAdminAccess(data.session)) {
      await client.auth.signOut();
      console.warn('Website admin API session was not established: the Supabase account lacks the website admin claim.');
    }
  } catch (error) {
    console.warn('Website admin API session was not established. The software login remains available.', error);
  }

  const session: AdminSession = {
    email: acceptedEmail,
    name: 'samdaniaa madrasah',
    loggedInAt: new Date().toISOString(),
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export function getSession(): AdminSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as AdminSession;
    if (!session.email || !session.loggedInAt) return null;
    return session;
  } catch {
    return null;
  }
}

export function logoutAdmin(): void {
  localStorage.removeItem(SESSION_KEY);
  if (authClientHolder.__samdaniaWebsiteAdminAuthClient) {
    void authClientHolder.__samdaniaWebsiteAdminAuthClient.auth.signOut().then(({ error }) => {
      if (error) console.warn('Supabase admin session could not be cleared during software logout.', error.message);
    });
  }
}

export function setAdminReadOnlyFlag(readOnly: boolean): void {
  try {
    localStorage.setItem('samdani_admin_readonly', readOnly ? '1' : '0');
  } catch {
    /* ignore */
  }
}

export function getAdminReadOnlyFlag(): boolean {
  try {
    return localStorage.getItem('samdani_admin_readonly') === '1';
  } catch {
    return false;
  }
}

export function getAdminEmail(): string {
  return getCreds().email;
}

export async function verifyAdminPassword(password: string): Promise<boolean> {
  ensureAdminCredentials();
  const creds = getCreds();
  const hash = await hashPassword(password);
  if (hash === creds.passwordHash) return true;
  return hash === defaultCreds().passwordHash;
}

export async function changeAdminEmail(currentPassword: string, newEmail: string): Promise<boolean> {
  ensureAdminCredentials();
  const creds = getCreds();
  const hash = await hashPassword(currentPassword);
  const ok = hash === creds.passwordHash || hash === defaultCreds().passwordHash;
  if (!ok) return false;
  saveCreds({ ...creds, email: newEmail.trim() });
  const session = getSession();
  if (session) {
    session.email = newEmail.trim();
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }
  return true;
}

export async function changeAdminPassword(currentPassword: string, newPassword: string): Promise<boolean> {
  ensureAdminCredentials();
  const creds = getCreds();
  const hash = await hashPassword(currentPassword);
  const ok = hash === creds.passwordHash || hash === defaultCreds().passwordHash;
  if (!ok) return false;
  saveCreds({ ...creds, passwordHash: await hashPassword(newPassword) });
  return true;
}
