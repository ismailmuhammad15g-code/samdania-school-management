import type { TeacherAccount, TeacherPortalSession } from '../types';

const SESSION_VERSION = 1;
export const TEACHER_SESSION_STORAGE_KEY = 'samdani_teacher_session_v2';

export interface SessionStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function makeSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `sess-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getSessionStorage(): SessionStorageLike | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  return window.localStorage;
}

export function createTeacherPortalSession(account: TeacherAccount): TeacherPortalSession {
  return {
    version: SESSION_VERSION,
    sessionId: makeSessionId(),
    accountId: account.id,
    email: account.email,
    fullName: account.fullName,
    issuedAt: new Date().toISOString(),
  };
}

export function validateTeacherPortalSession(
  session: TeacherPortalSession | null | undefined,
  account: TeacherAccount | undefined
): boolean {
  if (!session || !account) return false;
  if (session.version !== SESSION_VERSION) return false;
  if (!session.sessionId) return false;
  if (session.accountId !== account.id) return false;
  if (session.email.toLowerCase() !== account.email.toLowerCase()) return false;
  if (session.fullName !== account.fullName) return false;
  // Rejected accounts are locked out; everything else (including brand-new,
  // not-yet-verified teachers) is allowed so they can complete onboarding.
  if (account.status === 'rejected') return false;
  return true;
}

export function loadTeacherPortalSession(storage: SessionStorageLike | null = getSessionStorage()): TeacherPortalSession | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(TEACHER_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TeacherPortalSession;
    return parsed;
  } catch {
    return null;
  }
}

export function persistTeacherPortalSession(session: TeacherPortalSession, storage: SessionStorageLike | null = getSessionStorage()): void {
  if (!storage) return;
  storage.setItem(TEACHER_SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function clearTeacherPortalSession(storage: SessionStorageLike | null = getSessionStorage()): void {
  if (!storage) return;
  storage.removeItem(TEACHER_SESSION_STORAGE_KEY);
}
