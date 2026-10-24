import { MONTHS, SalaryPayment, TeacherStaff } from '../types';

export interface SalaryBalance {
  totalAccrued: number;
  totalPaid: number;
  remaining: number;
  balanceBeforeClamp: number;
  monthsAccrued: number;
}

const salaryMonthKey = (month: string, year: number): number | null => {
  const monthIndex = MONTHS.indexOf(month);
  return monthIndex < 0 || !Number.isFinite(year) ? null : year * 12 + monthIndex;
};

const dateMonthKey = (value?: string): number | null => {
  if (!value) return null;
  const match = value.match(/^(\d{4})-(\d{1,2})/);
  if (!match) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.getFullYear() * 12 + date.getMonth();
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  return month >= 1 && month <= 12 ? year * 12 + month - 1 : null;
};

export const getSalaryBalance = (
  staff: TeacherStaff,
  payments: SalaryPayment[],
  throughMonth: string,
  throughYear: number,
  fallbackJoiningDate?: string,
): SalaryBalance => {
  const throughKey = salaryMonthKey(throughMonth, throughYear);
  const today = new Date();
  const firstMonthKey = dateMonthKey(staff.joinedAt || fallbackJoiningDate) ?? today.getFullYear() * 12 + today.getMonth();
  const monthsAccrued = throughKey === null || throughKey < firstMonthKey
    ? 0
    : throughKey - firstMonthKey + 1;
  const totalAccrued = Math.max(0, staff.baseSalary) * monthsAccrued;
  const totalPaid = throughKey === null
    ? 0
    : payments.reduce((sum, payment) => {
        if (payment.teacherStaffId !== staff.id) return sum;
        const paymentKey = salaryMonthKey(payment.month, payment.year);
        return paymentKey !== null && paymentKey >= firstMonthKey && paymentKey <= throughKey
          ? sum + Math.max(0, payment.netPaid)
          : sum;
      }, 0);

  const balanceBeforeClamp = totalAccrued + (staff.salaryDueAdjustment || 0) - totalPaid;
  return {
    totalAccrued,
    totalPaid,
    remaining: Math.max(0, balanceBeforeClamp),
    balanceBeforeClamp,
    monthsAccrued,
  };
};
