import { sha256Hex } from './sha256';

const SESSION_KEY = 'samdani_admin_session';
const CRED_KEY = 'samdani_admin_credentials';

// Critical values come from the environment (.env → import.meta.env), never
// hardcoded in source. Sensible defaults keep the app usable if the env is
// absent (override them in .env for real deployments).
const ENV = import.meta.env;
const AUTH_SALT = ENV.VITE_AUTH_SALT ?? 'SamdaniaSalt2026';
const DEFAULT_EMAIL = ENV.VITE_ADMIN_EMAIL ?? 'admin@madrasah.com';
const DEFAULT_PASSWORD = ENV.VITE_ADMIN_PASSWORD ?? 'admin123';

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

function getCreds(): StoredCreds {
  try {
    const raw = localStorage.getItem(CRED_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return defaultCreds();
}

function saveCreds(creds: StoredCreds): void {
  localStorage.setItem(CRED_KEY, JSON.stringify(creds));
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
  const creds = getCreds();
  if (email.toLowerCase() !== creds.email.toLowerCase()) return null;
  const hash = await hashPassword(password);
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

export async function changeAdminEmail(currentPassword: string, newEmail: string): Promise<boolean> {
  const creds = getCreds();
  const hash = await hashPassword(currentPassword);
  if (hash !== creds.passwordHash) return false;
  saveCreds({ ...creds, email: newEmail });
  const session = getSession();
  if (session) {
    session.email = newEmail;
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }
  return true;
}

export async function changeAdminPassword(currentPassword: string, newPassword: string): Promise<boolean> {
  const creds = getCreds();
  const hash = await hashPassword(currentPassword);
  if (hash !== creds.passwordHash) return false;
  const newHash = await hashPassword(newPassword);
  saveCreds({ ...creds, passwordHash: newHash });
  return true;
}
