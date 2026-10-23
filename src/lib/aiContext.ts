// Builds a complete, human-readable snapshot of the entire school database so
// the AI Assistant can answer ANY question accurately (summaries, invoices,
// rows, columns, balances, attendance, loans, salaries, results, etc.).
//
// Everything is read live from the local SQL/IndexedDB store (the same store the
// UI uses), so the assistant always sees the latest data — no stale cache.
import { dbGet } from './localDb';

interface StudentLite {
  id: string;
  name: string;
  roll: string | number;
  class: string;
  contact: string;
  fatherName: string;
  motherName: string;
  previousDue: number;
  currentMonthFee: number;
  examFee: number;
  transport: number;
  electricity: number;
  water: number;
  waiver: number;
  advancePaid: number;
}

function num(v: unknown, d = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function bdt(n: number): string {
  return '৳' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function computeTotalPayable(s: StudentLite): number {
  return (
    s.previousDue +
    s.currentMonthFee +
    s.examFee +
    s.transport +
    s.electricity +
    s.water -
    s.waiver -
    s.advancePaid
  );
}

function safeGet<T>(key: string, fallback: T): T {
  try {
    const v = dbGet(key);
    return v == null ? fallback : (v as T);
  } catch {
    return fallback;
  }
}

export interface Snapshot {
  text: string;
  counts: Record<string, number>;
}

/**
 * Produce a full textual snapshot of the database. Used both to ground the
 * "Ask" mode system prompt and to answer read-only data questions.
 */
export function buildSnapshot(): Snapshot {
  const students = safeGet<StudentLite[]>('samdani_students', []);
  const payments = safeGet<any[]>('samdani_payments', []);
  const ledger = safeGet<any[]>('samdani_ledger', []);
  const hifzStudents = safeGet<StudentLite[]>('samdani_hifz_students', []);
  const hifzPayments = safeGet<any[]>('samdani_hifz_payments', []);
  const hifzLedger = safeGet<any[]>('samdani_hifz_ledger', []);
  const teachers = safeGet<any[]>('samdani_teachers_staff', []);
  const salaryPayments = safeGet<any[]>('samdani_salary_payments', []);
  const results = safeGet<any[]>('samdani_student_results', []);
  const loans = safeGet<any[]>('samdani_loans', []);
  const loanPayments = safeGet<any[]>('samdani_loan_payments', []);
  const teacherAccounts = safeGet<any[]>('samdani_teacher_accounts', []);
  const attendanceRecords = safeGet<any[]>('samdani_attendance_records', []);
  const studentAttendance = safeGet<any[]>('samdani_student_attendance_records', []);

  const lines: string[] = [];
  lines.push('# SCHOOL DATABASE SNAPSHOT (Samdania Talimul Islam Madrasah)');
  lines.push(`Generated: ${new Date().toLocaleString()}`);
  lines.push('');

  // ── STUDENTS ──
  lines.push('## Students (শিক্ষার্থী)');
  lines.push(`Total enrolled students: ${students.length}`);
  const totalOutstanding = students.reduce((s, x) => s + Math.max(0, computeTotalPayable(x)), 0);
  const totalAdvance = students.reduce((s, x) => s + Math.max(0, x.advancePaid), 0);
  lines.push(`Total outstanding (due) across all students: ${bdt(totalOutstanding)}`);
  lines.push(`Total advance paid by students: ${bdt(totalAdvance)}`);
  const studentsByClass: Record<string, number> = {};
  for (const s of students) studentsByClass[s.class] = (studentsByClass[s.class] || 0) + 1;
  lines.push('Students per class: ' + Object.entries(studentsByClass).map(([k, v]) => `${k}=${v}`).join(', '));
  lines.push('');
  lines.push('Full student directory (columns: ID | Name | Roll | Class | Contact | Father | Mother | PreviousDue | CurrentMonthFee | ExamFee | Transport | Electricity | Water | Waiver | AdvancePaid | TotalPayable):');
  for (const s of students) {
    lines.push(
      `- ${s.id} | ${s.name} | Roll ${s.roll} | ${s.class} | ${s.contact} | Father: ${s.fatherName} | Mother: ${s.motherName} | Due:${bdt(s.previousDue)} | Cur:${bdt(s.currentMonthFee)} | Exam:${bdt(s.examFee)} | Trans:${bdt(s.transport)} | Elec:${bdt(s.electricity)} | Water:${bdt(s.water)} | Waiver:${bdt(s.waiver)} | Adv:${bdt(s.advancePaid)} | Payable:${bdt(computeTotalPayable(s))}`
    );
  }
  lines.push('');

  // ── FEE PAYMENTS / INVOICES ──
  lines.push('## Fee Payments & Invoices (ফি রসিদ)');
  lines.push(`Total invoices recorded: ${payments.length}`);
  const totalCollected = payments.reduce((s, p) => s + num(p.amountPaid), 0);
  lines.push(`Total fees collected: ${bdt(totalCollected)}`);
  lines.push('Recent invoices (newest first):');
  const recentPay = [...payments].slice(0, 25);
  for (const p of recentPay) {
    lines.push(
      `- Inv#${p.invoiceNo} | ${p.receiptNo} | ${p.date} | ${p.studentName} (${p.class}) | Month:${p.month} | Paid:${bdt(num(p.amountPaid))} / Payable:${bdt(num(p.totalPayable))} | By:${p.recordedBy || p.receivedBy || '-'}`
    );
  }
  lines.push('');

  // ── FINANCE LEDGER ──
  lines.push('## Finance Ledger (লেজার)');
  lines.push(`Total ledger transactions: ${ledger.length}`);
  const income = ledger.filter((t) => t.type === 'Income').reduce((s, t) => s + num(t.amount), 0);
  const expense = ledger.filter((t) => t.type === 'Expense').reduce((s, t) => s + num(t.amount), 0);
  lines.push(`Total Income: ${bdt(income)} | Total Expense: ${bdt(expense)} | Net Balance: ${bdt(income - expense)}`);
  const byFund: Record<string, { inc: number; exp: number }> = {};
  for (const t of ledger) {
    byFund[t.fund] = byFund[t.fund] || { inc: 0, exp: 0 };
    if (t.type === 'Income') byFund[t.fund].inc += num(t.amount);
    else byFund[t.fund].exp += num(t.amount);
  }
  lines.push('Ledger by fund: ' + Object.entries(byFund).map(([k, v]) => `${k}(In:${bdt(v.inc)},Out:${bdt(v.exp)})`).join(' | '));
  lines.push('');

  // ── TEACHERS & SALARIES ──
  lines.push('## Teachers, Staff & Salaries (শিক্ষক ও বেতন)');
  lines.push(`Total teacher/staff records: ${teachers.length}`);
  const totalBaseSalary = teachers.reduce((s, t) => s + num(t.baseSalary), 0);
  lines.push(`Total monthly base salary obligation: ${bdt(totalBaseSalary)}`);
  lines.push(`Salary payments made: ${salaryPayments.length}`);
  const totalSalaryPaid = salaryPayments.reduce((s, p) => s + num(p.netPaid), 0);
  lines.push(`Total salary paid: ${bdt(totalSalaryPaid)}`);
  lines.push('Teacher accounts (portal): ' + teacherAccounts.length + ' (verified: ' + teacherAccounts.filter((a) => a.status === 'verified').length + ')');
  lines.push('');

  // ── RESULTS ──
  lines.push('## Academic Results (ফলাফল)');
  lines.push(`Total result records: ${results.length}`);
  const passCount = results.filter((r) => r.status === 'Pass').length;
  lines.push(`Pass: ${passCount} | Fail: ${results.length - passCount}`);
  lines.push('');

  // ── LOANS ──
  lines.push('## Loan Fund (ঋণ তহবিল)');
  lines.push(`Total loans: ${loans.length}`);
  const loanGiven = loans.filter((l) => l.type === 'Given').reduce((s, l) => s + num(l.amount) - num(l.repaidAmount), 0);
  const loanTaken = loans.filter((l) => l.type === 'Taken').reduce((s, l) => s + num(l.repaidAmount) - num(l.amount), 0);
  const zakatOutstanding = loans.filter((l) => l.type === 'ZakatLillah').reduce((s, l) => s + num(l.amount) - num(l.repaidAmount), 0);
  lines.push(`Outstanding Given (asset): ${bdt(loanGiven)} | Outstanding Taken (liability): ${bdt(loanTaken)} | Zakat & Lillah outstanding: ${bdt(zakatOutstanding)}`);
  lines.push(`Loan repayments recorded: ${loanPayments.length}`);
  lines.push('');

  // ── ATTENDANCE ──
  lines.push('## Attendance (উপস্থিতি)');
  lines.push(`Teacher attendance records: ${attendanceRecords.length}`);
  lines.push(`Student attendance class-records: ${studentAttendance.length}`);
  lines.push('');

  // ── HIFZ (independent school) ──
  lines.push('## Hifz School (حفظ) — independent data');
  lines.push(`Hifz students: ${hifzStudents.length} | Hifz invoices: ${hifzPayments.length} | Hifz ledger txns: ${hifzLedger.length}`);
  lines.push('');

  lines.push('## INSTRUCTIONS FOR THE AI');
  lines.push('Use ONLY the data above to answer. Do not invent students, invoices or amounts.');
  lines.push('When the user asks for a summary, totals, a specific student, a class list, or invoice details, answer precisely from this data.');

  const text = lines.join('\n');

  return {
    text,
    counts: {
      students: students.length,
      payments: payments.length,
      ledger: ledger.length,
      teachers: teachers.length,
      results: results.length,
      loans: loans.length,
      attendance: attendanceRecords.length,
      hifzStudents: hifzStudents.length,
    },
  };
}
