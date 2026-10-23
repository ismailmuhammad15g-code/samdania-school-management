import { dbGet, dbSet } from './localDb';

export interface StaffNotice {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  target: 'all' | 'selected';
  recipientIds: string[];
  createdBy: string;
}

export const STAFF_NOTICES_KEY = 'samdani_staff_notices';

export function getStaffNotices(): StaffNotice[] {
  const value = dbGet(STAFF_NOTICES_KEY);
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is StaffNotice => Boolean(
    item &&
    typeof item.id === 'string' &&
    typeof item.title === 'string' &&
    typeof item.message === 'string' &&
    Array.isArray(item.recipientIds)
  ));
}

export function saveStaffNotices(notices: StaffNotice[]): void {
  dbSet(STAFF_NOTICES_KEY, notices);
}

export function noticeIsForStaff(notice: StaffNotice, staffId: string): boolean {
  return notice.target === 'all' || notice.recipientIds.includes(staffId);
}
