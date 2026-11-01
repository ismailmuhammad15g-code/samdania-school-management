import type { Student } from '../types';

export function currentFeeMonth(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthNumber(month: string): number | null {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month);
  return match ? Number(match[1]) * 12 + Number(match[2]) - 1 : null;
}

export function rolloverMonthlyFees(
  students: Student[],
  date = new Date(),
): { students: Student[]; changed: boolean } {
  const thisMonth = currentFeeMonth(date);
  const thisMonthNumber = monthNumber(thisMonth)!;
  let changed = false;

  const updatedStudents = students.map((student) => {
    const lastMonth = student.feeMonth ? monthNumber(student.feeMonth) : null;
    const monthsElapsed = lastMonth == null ? 0 : thisMonthNumber - lastMonth;

    if (monthsElapsed <= 0) {
      if (student.feeMonth) return student;
      changed = true;
      return { ...student, feeMonth: thisMonth };
    }

    const monthlyTuition = student.monthlyTuition ?? student.currentMonthFee;
    const assessedBalance = Math.max(
      0,
      student.previousDue +
        student.currentMonthFee +
        student.examFee +
        student.transport +
        student.electricity +
        student.water -
        student.waiver +
        monthlyTuition * (monthsElapsed - 1),
    );
    const advancePaid = Math.max(0, student.advancePaid);
    changed = true;

    return {
      ...student,
      feeMonth: thisMonth,
      previousDue: Math.max(0, assessedBalance - advancePaid),
      currentMonthFee: monthlyTuition,
      examFee: 0,
      transport: 0,
      electricity: 0,
      water: 0,
      waiver: 0,
      advancePaid: Math.max(0, advancePaid - assessedBalance),
      digitInputs: {
        ...student.digitInputs,
        previousDue: assessedBalance > advancePaid
          ? String(assessedBalance - advancePaid)
          : '',
        currentMonthFee: String(monthlyTuition),
        examFee: '0',
        transport: '0',
        electricity: '0',
        water: '0',
        waiver: '0',
      },
    };
  });

  return { students: changed ? updatedStudents : students, changed };
}
