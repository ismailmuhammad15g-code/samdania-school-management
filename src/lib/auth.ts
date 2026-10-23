import { sha256Hex } from './sha256';
import { dbGet, dbSet, isDbReady } from './localDb';

const SESSION_KEY = 'samdani_admin_session';
const CRED_KEY = 'samdani_admin_credentials';

// Critical values come from the environment (.env → import.meta.env).
// Use || (not ??) so empty strings on Vercel also fall back to working defaults.
const ENV = import.meta.env;
const AUTH_SALT = (ENV.VITE_AUTH_SALT as string | undefined)?.trim() || 'SamdaniaSalt2026';
const DEFAULT_EMAIL = (ENV.VITE_ADMIN_EMAIL as string | undefined)?.trim() || 'admin@madrasah.com';
const DEFAULT_PASSWORD = (ENV.VITE_ADMIN_PASSWORD as string | undefined)?.trim() || 'admin123';

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

/** Read credentials: Supabase-backed db first, then localStorage (legacy), then env defaults. */
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
  // Mirror to localStorage so PasswordConfirmModal / export keep working offline.
  try {
    localStorage.setItem(CRED_KEY, JSON.stringify(creds));
  } catch {
    /* ignore */
  }
  // Persist to Supabase so local + Vercel share the same admin login.
  if (isDbReady()) {
    dbSet(CRED_KEY, creds);
  }
}

/**
 * Ensure admin credentials exist in Supabase (and localStorage).
 * Call once after the database is ready. Seeds from env when missing;
 * migrates legacy localStorage credentials into the cloud store.
 */
export function ensureAdminCredentials(): StoredCreds {
  const defaults = defaultCreds();

  if (isDbReady()) {
    const fromDb = dbGet(CRED_KEY);
    if (isValidCreds(fromDb)) {
      // Keep localStorage in sync with the cloud source of truth.
      try {
        localStorage.setItem(CRED_KEY, JSON.stringify(fromDb));
      } catch {
        /* ignore */
      }
      return fromDb;
    }
  }

  // Prefer a previously-changed local password over re-seeding defaults,
  // but only if it is valid. Then upload it to Supabase.
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

  // First run (or corrupt storage): seed env defaults into Supabase + localStorage.
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
  // Make sure credentials are seeded/migrated before verifying.
  ensureAdminCredentials();

  const trimmedEmail = email.trim();
  const trimmedPassword = password;
  if (!trimmedEmail || !trimmedPassword) return null;

  const hash = await hashPassword(trimmedPassword);
  const defaults = defaultCreds();

  // 1) Env default credentials always work (fixes stale local hashes / salt mismatches
  //    on local and Vercel). Re-sync stored creds so every device stays consistent.
  if (
    trimmedEmail.toLowerCase() === defaults.email.toLowerCase() &&
    hash === defaults.passwordHash
  ) {
    saveCreds(defaults);
    const session: AdminSession = {
      email: defaults.email,
      name: 'samdaniaa madrasah',
      loggedInAt: new Date().toISOString(),
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return session;
  }

  // 2) Otherwise require an exact match against the stored (possibly changed) password.
  const creds = getCreds();
  if (trimmedEmail.toLowerCase() !== creds.email.toLowerCase()) return null;
  if (hash !== creds.passwordHash) return null;

  const session: AdminSession = {
    email: creds.email,
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
}

// Persist whether the current admin session is a read-only "Viewer Admin"
// so it survives a page refresh (the admin session itself already persists).
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

/** Verify a password against the current stored admin hash (for confirm modals). */
export async function verifyAdminPassword(password: string): Promise<boolean> {
  ensureAdminCredentials();
  const creds = getCreds();
  const hash = await hashPassword(password);
  if (hash === creds.passwordHash) return true;
  // Also accept the env default so confirm dialogs work after salt/env recovery.
  const defaults = defaultCreds();
  return hash === defaults.passwordHash;
}

export async function changeAdminEmail(currentPassword: string, newEmail: string): Promise<boolean> {
  ensureAdminCredentials();
  const creds = getCreds();
  const hash = await hashPassword(currentPassword);
  const defaults = defaultCreds();
  const ok = hash === creds.passwordHash || hash === defaults.passwordHash;
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
  const defaults = defaultCreds();
  const ok = hash === creds.passwordHash || hash === defaults.passwordHash;
  if (!ok) return false;
  const newHash = await hashPassword(newPassword);
  saveCreds({ ...creds, passwordHash: newHash });
  return true;
}
