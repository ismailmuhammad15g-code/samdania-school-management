// Notifications layer — stores an activity feed in the same local db that the
// rest of the app uses, so a notification pushed in one tab/device shows up
// instantly in every other open view (no manual refresh, thanks to the
// BroadcastChannel + Supabase Realtime sync in localDb).
import { dbGet, dbSet } from './localDb';

export type NotificationType =
  | 'payment'
  | 'student'
  | 'teacher'
  | 'salary'
  | 'result'
  | 'loan'
  | 'attendance'
  | 'resignation'
  | 'leave'
  | 'ledger'
  | 'system';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  createdAt: number; // epoch ms
  read: boolean;
}

const KEY = 'samdani_notifications';
const MAX = 250;

// In-tab signal so the bell re-renders instantly (same tab), independent of
// the async db-change broadcast. Cross-tab/device updates still arrive via
// localDb's onDbChange (BroadcastChannel + Supabase Realtime).
export const NOTIFICATIONS_CHANGED_EVENT = 'samdani:notifications';

function emitChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(NOTIFICATIONS_CHANGED_EVENT));
  }
}

export function getNotifications(): AppNotification[] {
  try {
    const v = dbGet(KEY);
    if (Array.isArray(v)) {
      return v.map((item: any) => item && typeof item.content === 'string'
        ? {
            id: item.id,
            type: 'system' as const,
            title: item.title || 'Notice',
            message: item.content,
            createdAt: item.createdAt || Date.parse(item.published_at) || Date.now(),
            read: Boolean(item.read),
          }
        : item as AppNotification);
    }
    if (v && typeof v === 'object' && 'message' in v) {
      const item = v as { id?: string; title?: string; message: string; createdAt?: number };
      return [{
        id: item.id || `PUSH-${item.createdAt || Date.now()}`,
        type: 'system',
        title: item.title || 'Notification',
        message: item.message,
        createdAt: item.createdAt || Date.now(),
        read: false,
      }];
    }
    return [];
  } catch {
    return [];
  }
}

/** Push a new notification. Persisted to the db so it syncs everywhere live. */
export function pushNotification(n: Omit<AppNotification, 'id' | 'createdAt' | 'read'>): void {
  const list = getNotifications();
  const item = {
    id: `NTF-${Date.now().toString(36)}-${Math.floor(Math.random() * 900 + 100)}`,
    title: n.title,
    content: n.message,
    published_at: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    is_breaking: false,
    category: 'General',
    read: false,
  };
  const next = [item, ...list.map((notification) => ({
    id: `NTF-${Date.now().toString(36)}-${Math.floor(Math.random() * 900 + 100)}`,
    title: notification.title,
    content: notification.message,
    published_at: new Date(notification.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    is_breaking: false,
    category: 'General',
    read: notification.read,
  }))].slice(0, MAX);
  dbSet(KEY, next);
  emitChanged();
}

/** Mark every notification as read (e.g. when the panel is opened). */
export function markAllRead(): void {
  const list = getNotifications();
  if (list.every((n) => n.read)) return; // no-op avoids an unnecessary db write
  const next = list.map((n) => (n.read ? n : { ...n, read: true }));
  dbSet(KEY, next);
  emitChanged();
}

export function markRead(id: string): void {
  const list = getNotifications();
  const next = list.map((n) => (n.id === id ? { ...n, read: true } : n));
  dbSet(KEY, next);
  emitChanged();
}

export function clearNotifications(): void {
  dbSet(KEY, []);
  emitChanged();
}
