export type UserRole = 'Admin' | 'Teacher' | 'Accountant';

export interface UserProfile {
  email: string | null;
  name: string;
  photoURL?: string;
  role: UserRole;
  isGoogleLinked: boolean;
}

export type FundType = 'General' | 'Zakat' | 'Lillah' | 'Loan';

export interface LedgerTransaction {
  id: string;
  date: string; // YYYY-MM-DD
  type: 'Income' | 'Expense';
  fund: FundType;
  category: string;
  amount: number;
  description: string;
  recordedBy: string;
}

export interface Student {
  id: string;
  name: string;
  roll: number;
  class: string;
  contact: string;
  previousDue: number;
  currentMonthFee: number;
  examFee: number;
  transport: number;
  electricity: number;
  water: number;
  waiver: number;
  advancePaid: number;
}

export interface FeePayment {
  id: string;
  date: string; // YYYY-MM-DD
  receiptNo: string;
  studentId: string;
  studentName: string;
  class: string;
  month: string;
  previousDue: number;
  currentMonthFee: number;
  examFee: number;
  transport: number;
  electricity: number;
  water: number;
  waiver: number;
  advancePaid: number;
  totalPayable: number;
  amountPaid: number;
  recordedBy: string;
}

// --- SALARY MODULE TYPES ---
export interface TeacherStaff {
  id: string;
  name: string;
  role: 'Teacher' | 'Staff';
  designation: string; // e.g., Principal, Senior Teacher, Hifz Muallim, Cook, Guard
  baseSalary: number;
  contact: string;
}

export interface SalaryPayment {
  id: string;
  teacherStaffId: string;
  teacherStaffName: string;
  month: string;
  year: number;
  date: string;
  amount: number;
  allowance: number;
  deduction: number;
  netPaid: number;
  paymentMode: 'Cash' | 'Bank' | 'Bkash/Nagad';
  recordedBy: string;
}

// --- STUDENT RESULTS TYPES ---
export interface SubjectMark {
  subjectName: string;
  marksObtained: number;
  maxMarks: number;
}

export interface StudentResult {
  id: string;
  studentId: string;
  studentName: string;
  class: string;
  examType: 'First Term' | 'Second Term' | 'Annual'; // প্রথম সাময়িক, দ্বিতীয় সাময়িক, বার্ষিক পরীক্ষা
  year: number;
  marks: SubjectMark[];
  grade: string;
  gpa: number;
  status: 'Pass' | 'Fail';
  remarks: string;
  recordedBy: string;
  date: string;
}

// --- LOAN FUND (ঋণ তহবিল) TYPES ---
export interface LoanRecord {
  id: string;
  date: string;
  type: 'Taken' | 'Given'; // Taken = loan received (liability), Given = loan provided (asset)
  personName: string; // borrower / lender
  contact: string;
  amount: number;
  repaidAmount: number;
  status: 'Active' | 'Settled';
  description: string;
  recordedBy: string;
}

export interface LoanPayment {
  id: string;
  loanId: string;
  date: string;
  amount: number;
  type: 'Repayment' | 'Recovery'; // Repayment of taken loan, Recovery of given loan
  recordedBy: string;
}

export const ACADEMIC_CLASSES = [
  'Play',
  'Nursery',
  'Class 1',
  'Class 2',
  'Class 3',
  'Class 4',
  'Class 5',
  'Najera',
  'Hifz',
  'Kitab'
];

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const INCOME_CATEGORIES = [
  'Monthly Tuition',
  'Admission Fee',
  'General Donation',
  'Zakat Donation',
  'Lillah Donation',
  'Exam Fee',
  'Sadaqah',
  'Loan Received (ঋণ গ্রহণ)',
  'Loan Repayment Recovered (ঋণ আদায়)',
  'Other Income'
];

export const EXPENSE_CATEGORIES = [
  'Teacher Salary',
  'Staff Salary',
  'Food & Messing (Lillah)',
  'Electricity Bill',
  'Water Bill',
  'Transport/Fuel',
  'Madrasah Rent',
  'Maintenance',
  'Office Stationery',
  'Exam Expenses',
  'Loan Given (ঋণ প্রদান)',
  'Loan Repaid (ঋণ পরিশোধ)',
  'Other Expense'
];
