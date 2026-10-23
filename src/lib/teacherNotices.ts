import { dbGet, dbSet } from './localDb';

export interface TeacherNotice {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  target: 'all' | 'selected';
  recipientIds: string[];
  createdBy: string;
}

export const TEACHER_NOTICES_KEY = 'samdani_teacher_notices';

export function getTeacherNotices(): TeacherNotice[] {
  const value = dbGet(TEACHER_NOTICES_KEY);
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is TeacherNotice =>
    Boolean(
      item &&
      typeof item.id === 'string' &&
      typeof item.title === 'string' &&
      typeof item.message === 'string' &&
      (item.target === 'all' || item.target === 'selected') &&
      Array.isArray(item.recipientIds)
    )
  );
}

export function saveTeacherNotices(notices: TeacherNotice[]): void {
  dbSet(TEACHER_NOTICES_KEY, notices);
}

export function noticeIsForTeacher(notice: TeacherNotice, teacherId: string): boolean {
  return notice.target === 'all' || notice.recipientIds.includes(teacherId);
}
