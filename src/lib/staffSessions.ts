import type { StaffAccount, StaffPortalSession } from '../types';

const SESSION_VERSION = 1;
export const STAFF_SESSION_STORAGE_KEY = 'samdani_staff_session_v1';

function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage;
}

export function createStaffPortalSession(account: StaffAccount): StaffPortalSession {
  return {
    version: SESSION_VERSION,
    sessionId: typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `staff-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    accountId: account.id,
    email: account.email,
    fullName: account.fullName,
    issuedAt: new Date().toISOString(),
  };
}

export function validateStaffPortalSession(
  session: StaffPortalSession | null | undefined,
  account: StaffAccount | undefined
): boolean {
  return Boolean(
    session &&
    account &&
    session.version === SESSION_VERSION &&
    session.sessionId &&
    session.accountId === account.id &&
    session.email.toLowerCase() === account.email.toLowerCase() &&
    session.fullName === account.fullName
  );
}

export function loadStaffPortalSession(): StaffPortalSession | null {
  const storage = getStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(STAFF_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StaffPortalSession;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function persistStaffPortalSession(session: StaffPortalSession): void {
  getStorage()?.setItem(STAFF_SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function clearStaffPortalSession(): void {
  getStorage()?.removeItem(STAFF_SESSION_STORAGE_KEY);
}
