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
  fatherName: string;
  motherName: string;
  extraInfo: string;
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
  invoiceNo: number; // Auto-incrementing serial # (101, 102, ...)
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
  receivedBy: string;
  recordedBy: string;
}

// --- SALARY MODULE TYPES ---
export interface TeacherStaff {
  id: string;
  name: string;
  role: 'Teacher' | 'Staff';
  designation: string;
  baseSalary: number;
  contact: string;
  email: string;
  bio: string;
}

export interface TeacherAccount {
  id: string;
  fullName: string;
  designation: string;
  email: string;
  password: string;
  bio: string;
  registered: boolean;
  status: 'unverified' | 'verified' | 'rejected';
  rejectionReason?: string;
  rejectedAt?: string;
  photoUrl?: string;
  role?: string;
  createdAt: string;
}

// A teacher's request to leave the school. Stays "pending" until the admin
// approves (teacher fully removed) or rejects (request dismissed).
export interface TeacherResignationRequest {
  id: string;
  teacherId: string;
  teacherName: string;
  teacherEmail: string;
  reason?: string;
  requestedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  resolvedAt?: string;
}

export interface TeacherPortalSession {
  version: number;
  sessionId: string;
  accountId: string;
  email: string;
  fullName: string;
  issuedAt: string;
}

export interface StudentAttendanceStatus {
  id: string;
  studentId: string;
  studentName: string;
  className: string;
  present: boolean;
  late: boolean;
  dairy: boolean;
  uniform: boolean;
  note?: string;
  recordedAt: string;
  teacherId: string;
  teacherName: string;
  date: string;
}

export interface StudentAttendanceRecord {
  id: string;
  teacherId: string;
  teacherName: string;
  className: string;
  date: string;
  createdAt: string;
  statuses: StudentAttendanceStatus[];
}

// --- TEACHER CLASS ROUTINE (ক্লাস রুটিন) TYPES ---
export interface TeacherRoutine {
  id: string;
  teacherId: string;
  time: string;
  class: string;
  subject: string;
  restTime: string;
}

// --- TEACHER LEAVE (ছুটি) TYPES ---
export interface TeacherLeave {
  id: string;
  teacherId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  notes?: string;
}

// --- TEACHER ATTENDANCE (উপস্থিতি) TYPES ---
// A single QR day inside a 12-day set. The `token` is an encrypted, signed
// link that can only be validated against this set's secret — tamper-proof.
export interface AttendanceQRDay {
  index: number;            // 1..12
  date: string;             // YYYY-MM-DD the QR is valid for
  token: string;            // signed payload (the QR content)
}

export interface AttendanceQRSet {
  id: string;               // unique set id
  generatedAt: string;      // ISO timestamp
  startDate: string;        // YYYY-MM-DD of day 1
  secret: string;           // signing secret (kept local only)
  days: AttendanceQRDay[];  // 12 days
}

// One teacher's attendance for one day (entry = arrived, exit = left).
export interface AttendanceRecord {
  id: string;               // `${teacherId}_${date}`
  teacherId: string;
  teacherName: string;
  date: string;             // YYYY-MM-DD
  entryTime: string | null; // ISO timestamp of first (arrival) scan
  exitTime: string | null;  // ISO timestamp of second (departure) scan
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
  paymentMode: string;
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
  type: 'Taken' | 'Given' | 'ZakatLillah'; // Taken = loan received (liability), Given = loan provided (asset), ZakatLillah = loan booked under Zakat & Lillah fund
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

export const DEFAULT_ACADEMIC_CLASSES = [...ACADEMIC_CLASSES];

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];


