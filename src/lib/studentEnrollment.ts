import type { Student } from '../types';

export type PromotionOutcome = 'promote' | 'retain' | 'left' | 'transfer';

export const isStudentActive = (student: Student): boolean =>
  student.enrollmentStatus !== 'left' && student.enrollmentStatus !== 'transferred';

export function makeStudentPromotionBackup(
  students: Student[],
  session: number,
  databaseSnapshot: Record<string, unknown> = {},
): void {
  const studentSnapshot = students.map((student) => ({
    ...student,
    enrollmentHistory: student.enrollmentHistory?.map((entry) => ({ ...entry })),
  }));
  const backup = {
    createdAt: new Date().toISOString(),
    academicSession: session,
    students: studentSnapshot,
    database: {
      ...databaseSnapshot,
      students: studentSnapshot,
      samdani_students: studentSnapshot,
    },
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `student-promotion-backup-${session}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
