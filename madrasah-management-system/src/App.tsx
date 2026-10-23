import React, { useState, useEffect } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { 
  LedgerTransaction, 
  Student, 
  FeePayment, 
  UserRole, 
  UserProfile,
  ACADEMIC_CLASSES,
  TeacherStaff,
  SalaryPayment,
  StudentResult,
  LoanRecord,
  LoanPayment
} from './types';
import { 
  initAuth, 
  googleSignIn, 
  logout, 
  getAccessToken 
} from './lib/firebase';
import { 
  findSpreadsheet, 
  createSpreadsheet, 
  fetchSpreadsheetData, 
  saveAllToSheets, 
  appendLedgerRow, 
  appendPaymentRow, 
  rewriteStudentsSheet 
} from './lib/googleSheets';

import Navbar from './components/Navbar';
import Dashboard from './components/Dashboard';
import FinanceModule from './components/FinanceModule';
import FeesModule from './components/FeesModule';
import SalariesModule from './components/SalariesModule';
import ResultsModule from './components/ResultsModule';
import LoansModule from './components/LoansModule';

// Initial Mock Data to allow immediate, beautiful explore experience
const INITIAL_STUDENTS: Student[] = [
  { id: 'ST-101', name: 'Salman Al-Farsi', roll: 1, class: 'Hifz', contact: '01711223344', previousDue: 1500, currentMonthFee: 1200, examFee: 500, transport: 300, electricity: 100, water: 50, waiver: 200, advancePaid: 0 },
  { id: 'ST-102', name: 'Abu Bakr Siddique', roll: 2, class: 'Class 5', contact: '01855667788', previousDue: 0, currentMonthFee: 1000, examFee: 0, transport: 0, electricity: 100, water: 50, waiver: 0, advancePaid: 200 },
  { id: 'ST-103', name: 'Umar Ibn Khattab', roll: 3, class: 'Class 3', contact: '01911335577', previousDue: 500, currentMonthFee: 800, examFee: 300, transport: 200, electricity: 100, water: 50, waiver: 100, advancePaid: 0 },
  { id: 'ST-104', name: 'Usman Ibn Affan', roll: 4, class: 'Kitab', contact: '01533445566', previousDue: 0, currentMonthFee: 1500, examFee: 500, transport: 500, electricity: 100, water: 50, waiver: 500, advancePaid: 100 },
  { id: 'ST-105', name: 'Ali Ibn Abi Talib', roll: 5, class: 'Najera', contact: '01677889900', previousDue: 3000, currentMonthFee: 900, examFee: 300, transport: 0, electricity: 100, water: 50, waiver: 0, advancePaid: 0 },
  { id: 'ST-106', name: 'Zayd Ibn Harithah', roll: 6, class: 'Class 1', contact: '01722446688', previousDue: 200, currentMonthFee: 700, examFee: 0, transport: 150, electricity: 100, water: 50, waiver: 0, advancePaid: 0 },
  { id: 'ST-107', name: 'Bilal Ibn Rabah', roll: 7, class: 'Nursery', contact: '01899112233', previousDue: 0, currentMonthFee: 600, examFee: 0, transport: 0, electricity: 100, water: 50, waiver: 150, advancePaid: 50 }
];

const INITIAL_LEDGER: LedgerTransaction[] = [
  { id: 'TX-001', date: '2026-07-01', type: 'Income', fund: 'General', category: 'General Donation', amount: 5000, description: 'Sponsor donation for floor mats and repairs', recordedBy: 'Admin' },
  { id: 'TX-002', date: '2026-07-02', type: 'Income', fund: 'Zakat', category: 'Zakat Donation', amount: 8000, description: 'Sadaqah/Zakat pool from local merchants', recordedBy: 'Admin' },
  { id: 'TX-003', date: '2026-07-03', type: 'Income', fund: 'Lillah', category: 'Lillah Donation', amount: 4000, description: 'Lillah donations for student meals and messing', recordedBy: 'Accountant' },
  { id: 'TX-004', date: '2026-07-04', type: 'Expense', fund: 'General', category: 'Teacher Salary', amount: 3500, description: 'Monthly salary for Hafiz Mawlana Mahmud', recordedBy: 'Admin' },
  { id: 'TX-005', date: '2026-07-05', type: 'Expense', fund: 'Lillah', category: 'Food & Messing (Lillah)', amount: 1800, description: 'Rice sacks, oil, spices bazaar for Lillah dining', recordedBy: 'Accountant' },
  { id: 'TX-006', date: '2026-07-06', type: 'Expense', fund: 'General', category: 'Electricity Bill', amount: 420, description: 'June power utility dues', recordedBy: 'Accountant' },
  { id: 'TX-007', date: '2026-07-07', type: 'Income', fund: 'General', category: 'Admission Fee', amount: 1500, description: 'Registration fees collected from Class 1 intake', recordedBy: 'Accountant' },
  { id: 'TX-008', date: '2026-07-01', type: 'Income', fund: 'Loan', category: 'Loan Received (ঋণ গ্রহণ)', amount: 50000, description: 'Taken: Haji Masood (Committee)', recordedBy: 'Admin' },
  { id: 'TX-009', date: '2026-07-05', type: 'Expense', fund: 'Loan', category: 'Loan Given (ঋণ প্রদান)', amount: 5000, description: 'Given: Abdur Rahman (Chef)', recordedBy: 'Admin' },
  { id: 'TX-010', date: '2026-07-08', type: 'Expense', fund: 'Loan', category: 'Loan Repaid (ঋণ পরিশোধ)', amount: 20000, description: 'Repayment of Taken loan from Haji Masood', recordedBy: 'Admin' },
  { id: 'TX-011', date: '2026-07-10', type: 'Income', fund: 'Loan', category: 'Loan Repayment Recovered (ঋণ আদায়)', amount: 1500, description: 'Recovery of Given loan to Abdur Rahman', recordedBy: 'Accountant' }
];

const INITIAL_PAYMENTS: FeePayment[] = [
  { 
    id: 'PAY-101', 
    date: '2026-07-09', 
    receiptNo: 'REC20260709-1', 
    studentId: 'ST-102', 
    studentName: 'Abu Bakr Siddique', 
    class: 'Class 5', 
    month: 'July', 
    previousDue: 0, 
    currentMonthFee: 1000, 
    examFee: 0, 
    transport: 0, 
    electricity: 100, 
    water: 50, 
    waiver: 0, 
    advancePaid: 200, 
    totalPayable: 950, 
    amountPaid: 950, 
    recordedBy: 'Accountant' 
  },
  { 
    id: 'PAY-102', 
    date: '2026-07-10', 
    receiptNo: 'REC20260710-1', 
    studentId: 'ST-104', 
    studentName: 'Usman Ibn Affan', 
    class: 'Kitab', 
    month: 'July', 
    previousDue: 0, 
    currentMonthFee: 1500, 
    examFee: 500, 
    transport: 500, 
    electricity: 100, 
    water: 50, 
    waiver: 500, 
    advancePaid: 100, 
    totalPayable: 2050, 
    amountPaid: 2050, 
    recordedBy: 'Accountant' 
  }
];

const INITIAL_TEACHERS_STAFF: TeacherStaff[] = [
  { id: 'STF-101', name: 'Hafiz Mawlana Masood', role: 'Teacher', designation: 'Head Hifz Muallim', baseSalary: 12000, contact: '01711223344' },
  { id: 'STF-102', name: 'Mufti Shabbir Ahmed', role: 'Teacher', designation: 'Senior Kitab Lecturer', baseSalary: 15000, contact: '01855667788' },
  { id: 'STF-103', name: 'Qari Muhammad Anas', role: 'Teacher', designation: 'Tajweed Specialist', baseSalary: 10000, contact: '01911335577' },
  { id: 'STF-104', name: 'Abdur Rahman', role: 'Staff', designation: 'Chef / Kitchen Head', baseSalary: 8000, contact: '01533445566' },
  { id: 'STF-105', name: 'Abu Bakr Siddiq', role: 'Staff', designation: 'Security & Maintenance', baseSalary: 7500, contact: '01677889900' }
];

const INITIAL_SALARY_PAYMENTS: SalaryPayment[] = [
  { id: 'SP-101', teacherStaffId: 'STF-101', teacherStaffName: 'Hafiz Mawlana Masood', month: 'June', year: 2026, date: '2026-06-30', amount: 12000, allowance: 1000, deduction: 0, netPaid: 13000, paymentMode: 'Cash', recordedBy: 'Mawlana Samdani' },
  { id: 'SP-102', teacherStaffId: 'STF-104', teacherStaffName: 'Abdur Rahman', month: 'June', year: 2026, date: '2026-06-30', amount: 8000, allowance: 0, deduction: 500, netPaid: 7500, paymentMode: 'Bkash/Nagad', recordedBy: 'Mawlana Samdani' }
];

const INITIAL_STUDENT_RESULTS: StudentResult[] = [
  {
    id: 'RES-101',
    studentId: 'ST-101',
    studentName: 'Salman Al-Farsi',
    class: 'Hifz',
    examType: 'First Term',
    year: 2026,
    marks: [
      { subjectName: 'Al-Quran & Tajweed', marksObtained: 88, maxMarks: 100 },
      { subjectName: 'Arabic & Grammer', marksObtained: 75, maxMarks: 100 },
      { subjectName: 'Hadith & Fiqh', marksObtained: 82, maxMarks: 100 },
      { subjectName: 'Bengali (বাংলা)', marksObtained: 68, maxMarks: 100 },
      { subjectName: 'Mathematics (গণিত)', marksObtained: 70, maxMarks: 100 },
      { subjectName: 'English (ইংরেজি)', marksObtained: 64, maxMarks: 100 }
    ],
    grade: 'A',
    gpa: 4.0,
    status: 'Pass',
    remarks: 'Masha-Allah, excellent memorization and grammar retention. Keep up the focus!',
    recordedBy: 'Mawlana Samdani',
    date: '2026-07-05'
  },
  {
    id: 'RES-102',
    studentId: 'ST-103',
    studentName: 'Umar Ibn Khattab',
    class: 'Class 3',
    examType: 'First Term',
    year: 2026,
    marks: [
      { subjectName: 'Al-Quran & Tajweed', marksObtained: 95, maxMarks: 100 },
      { subjectName: 'Arabic & Grammer', marksObtained: 84, maxMarks: 100 },
      { subjectName: 'Hadith & Fiqh', marksObtained: 90, maxMarks: 100 },
      { subjectName: 'Bengali (বাংলা)', marksObtained: 82, maxMarks: 100 },
      { subjectName: 'Mathematics (গণিত)', marksObtained: 88, maxMarks: 100 },
      { subjectName: 'English (ইংরেজি)', marksObtained: 80, maxMarks: 100 }
    ],
    grade: 'A+',
    gpa: 5.0,
    status: 'Pass',
    remarks: 'Outstanding effort. Exceptional in both religious and general curriculum streams.',
    recordedBy: 'Mawlana Samdani',
    date: '2026-07-05'
  }
];

const INITIAL_LOANS: LoanRecord[] = [
  { id: 'LN-101', date: '2026-07-01', type: 'Taken', personName: 'Haji Masood (Committee)', contact: '01722334455', amount: 50000, repaidAmount: 20000, status: 'Active', description: 'Emergency interest-free loan to bridge construction materials purchase.', recordedBy: 'Mawlana Samdani' },
  { id: 'LN-102', date: '2026-07-05', type: 'Given', personName: 'Abdur Rahman (Chef)', contact: '01533445566', amount: 5000, repaidAmount: 1500, status: 'Active', description: 'Advance loan for personal family medical needs. Repayable via monthly salary deduction.', recordedBy: 'Mawlana Samdani' }
];

const INITIAL_LOAN_PAYMENTS: LoanPayment[] = [
  { id: 'LNP-201', loanId: 'LN-101', date: '2026-07-08', amount: 20000, type: 'Repayment', recordedBy: 'Mawlana Samdani' },
  { id: 'LNP-202', loanId: 'LN-102', date: '2026-07-10', amount: 1500, type: 'Recovery', recordedBy: 'Mawlana Samdani' }
];

export default function App() {
  
  // Navigation tab state
  const [activeTab, setActiveTab] = useState<'dashboard' | 'finance' | 'fees' | 'salaries' | 'results' | 'loans'>('dashboard');

  // Multi-role Auth profiles state
  const [userProfile, setUserProfile] = useState<UserProfile>({
    email: 'samdaniamadrasha@gmail.com',
    name: 'Mawlana Samdani',
    role: 'Admin',
    isGoogleLinked: false,
  });

  // Core records database state
  const [students, setStudents] = useState<Student[]>(INITIAL_STUDENTS);
  const [ledger, setLedger] = useState<LedgerTransaction[]>(INITIAL_LEDGER);
  const [payments, setPayments] = useState<FeePayment[]>(INITIAL_PAYMENTS);

  // Teachers, Salaries, Results, and Loans state with local persistence
  const [teachersStaff, setTeachersStaff] = useState<TeacherStaff[]>(() => {
    const local = localStorage.getItem('samdani_teachers_staff');
    return local ? JSON.parse(local) : INITIAL_TEACHERS_STAFF;
  });

  const [salaryPayments, setSalaryPayments] = useState<SalaryPayment[]>(() => {
    const local = localStorage.getItem('samdani_salary_payments');
    return local ? JSON.parse(local) : INITIAL_SALARY_PAYMENTS;
  });

  const [studentResults, setStudentResults] = useState<StudentResult[]>(() => {
    const local = localStorage.getItem('samdani_student_results');
    return local ? JSON.parse(local) : INITIAL_STUDENT_RESULTS;
  });

  const [loans, setLoans] = useState<LoanRecord[]>(() => {
    const local = localStorage.getItem('samdani_loans');
    return local ? JSON.parse(local) : INITIAL_LOANS;
  });

  const [loanPayments, setLoanPayments] = useState<LoanPayment[]>(() => {
    const local = localStorage.getItem('samdani_loan_payments');
    return local ? JSON.parse(local) : INITIAL_LOAN_PAYMENTS;
  });

  // Persist new modular states
  useEffect(() => {
    localStorage.setItem('samdani_teachers_staff', JSON.stringify(teachersStaff));
  }, [teachersStaff]);

  useEffect(() => {
    localStorage.setItem('samdani_salary_payments', JSON.stringify(salaryPayments));
  }, [salaryPayments]);

  useEffect(() => {
    localStorage.setItem('samdani_student_results', JSON.stringify(studentResults));
  }, [studentResults]);

  useEffect(() => {
    localStorage.setItem('samdani_loans', JSON.stringify(loans));
  }, [loans]);

  useEffect(() => {
    localStorage.setItem('samdani_loan_payments', JSON.stringify(loanPayments));
  }, [loanPayments]);

  // Synchronization and loading flags
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Form toggles
  const [isAddTxOpen, setIsAddTxOpen] = useState(false);
  const [isCollectOpen, setIsCollectOpen] = useState(false);

  // Listen to Google Sign-In Auth State Changes
  useEffect(() => {
    initAuth(
      async (firebaseUser, token) => {
        setUserProfile((prev) => ({
          ...prev,
          email: firebaseUser.email,
          name: firebaseUser.displayName || prev.name,
          photoURL: firebaseUser.photoURL || undefined,
          isGoogleLinked: true,
        }));
        setSyncError(null);
        await linkGoogleSpreadsheet(token);
      },
      () => {
        // Not linked or logged out, keep using local sandbox
        setUserProfile((prev) => ({
          ...prev,
          isGoogleLinked: false,
        }));
      }
    );
  }, []);

  // Connect Google Sheets flow
  const linkGoogleSpreadsheet = async (accessToken: string) => {
    setIsSyncing(true);
    setSyncError(null);
    try {
      const sheetId = await findSpreadsheet(accessToken);
      if (sheetId) {
        setSpreadsheetId(sheetId);
        // Fetch remote spreadsheet data and merge
        const remoteData = await fetchSpreadsheetData(accessToken, sheetId);
        
        // If sheet is initialized and contains real data, update local state
        if (remoteData.students.length > 0 || remoteData.ledger.length > 0) {
          setStudents(remoteData.students.length > 0 ? remoteData.students : INITIAL_STUDENTS);
          setLedger(remoteData.ledger.length > 0 ? remoteData.ledger : INITIAL_LEDGER);
          setPayments(remoteData.payments.length > 0 ? remoteData.payments : INITIAL_PAYMENTS);
        } else {
          // If sheets are empty, upload current gorgeous mock data so user has starting state in Google Sheets!
          await saveAllToSheets(accessToken, sheetId, {
            students: INITIAL_STUDENTS,
            ledger: INITIAL_LEDGER,
            payments: INITIAL_PAYMENTS,
          });
        }
      } else {
        // Create new spreadsheet
        const newSheetId = await createSpreadsheet(accessToken);
        setSpreadsheetId(newSheetId);
        // Upload initial state
        await saveAllToSheets(accessToken, newSheetId, {
          students,
          ledger,
          payments,
        });
      }
    } catch (err: any) {
      console.error(err);
      setSyncError(err.message || 'Error connecting to Google Sheets');
    } finally {
      setIsSyncing(false);
    }
  };

  // Google Login and Sign-Out triggers
  const handleGoogleSignIn = async () => {
    setIsSyncing(true);
    try {
      const result = await googleSignIn();
      if (result) {
        await linkGoogleSpreadsheet(result.accessToken);
      }
    } catch (err: any) {
      setSyncError(err.message || 'Login failed');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleGoogleSignOut = async () => {
    setIsSyncing(true);
    try {
      await logout();
      setSpreadsheetId(null);
      setUserProfile((prev) => ({
        ...prev,
        isGoogleLinked: false,
      }));
    } catch (err: any) {
      setSyncError(err.message || 'Logout failed');
    } finally {
      setIsSyncing(false);
    }
  };

  // Manual Full Sync pulling/pushing
  const handleForceSync = async () => {
    const token = getAccessToken();
    if (!token || !spreadsheetId) return;

    setIsSyncing(true);
    setSyncError(null);
    try {
      // Pull latest from sheets
      const remoteData = await fetchSpreadsheetData(token, spreadsheetId);
      if (remoteData.students.length > 0 || remoteData.ledger.length > 0) {
        setStudents(remoteData.students);
        setLedger(remoteData.ledger);
        setPayments(remoteData.payments);
      } else {
        // Push local if sheet somehow empty
        await saveAllToSheets(token, spreadsheetId, { students, ledger, payments });
      }
    } catch (err: any) {
      setSyncError(err.message || 'Sync error');
    } finally {
      setIsSyncing(false);
    }
  };

  // ----------------------------------------------------
  // MODULE ACTION: FINANCE LEDGER
  // ----------------------------------------------------
  const handleAddTransaction = async (txData: Omit<LedgerTransaction, 'id' | 'recordedBy'>) => {
    const newTx: LedgerTransaction = {
      ...txData,
      id: `TX-${Date.now().toString().slice(-4)}`,
      recordedBy: userProfile.name,
    };

    const updatedLedger = [newTx, ...ledger];
    setLedger(updatedLedger);

    // Live background sync to Google Sheets if linked
    const token = getAccessToken();
    if (token && spreadsheetId) {
      try {
        await appendLedgerRow(token, spreadsheetId, newTx);
      } catch (err) {
        console.warn('Sync failed, trying full save backup...', err);
        saveAllToSheets(token, spreadsheetId, { students, ledger: updatedLedger, payments }).catch(e => console.error(e));
      }
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    const updatedLedger = ledger.filter((t) => t.id !== id);
    setLedger(updatedLedger);

    // Full overwrite because of deletion
    const token = getAccessToken();
    if (token && spreadsheetId) {
      saveAllToSheets(token, spreadsheetId, { students, ledger: updatedLedger, payments }).catch((e) => {
        console.error('Delete sync failed:', e);
        setSyncError('Failed to sync transaction deletion to sheets.');
      });
    }
  };

  // ----------------------------------------------------
  // MODULE ACTION: STUDENT DIRECTORY
  // ----------------------------------------------------
  const handleAddStudent = async (studentData: Omit<Student, 'id'>) => {
    const newStudent: Student = {
      ...studentData,
      id: `ST-${Math.floor(100 + Math.random() * 900)}`, // Generate elegant ST ID
    };

    const updatedStudents = [...students, newStudent];
    setStudents(updatedStudents);

    // Sync to Sheets
    const token = getAccessToken();
    if (token && spreadsheetId) {
      rewriteStudentsSheet(token, spreadsheetId, updatedStudents).catch((e) => {
        console.error('Add student sync failed:', e);
      });
    }
  };

  const handleEditStudent = async (editedStudent: Student) => {
    const updatedStudents = students.map((s) => (s.id === editedStudent.id ? editedStudent : s));
    setStudents(updatedStudents);

    // Sync to Sheets
    const token = getAccessToken();
    if (token && spreadsheetId) {
      rewriteStudentsSheet(token, spreadsheetId, updatedStudents).catch((e) => {
        console.error('Edit student sync failed:', e);
      });
    }
  };

  const handleDeleteStudent = async (id: string) => {
    const updatedStudents = students.filter((s) => s.id !== id);
    setStudents(updatedStudents);

    // Sync to Sheets
    const token = getAccessToken();
    if (token && spreadsheetId) {
      rewriteStudentsSheet(token, spreadsheetId, updatedStudents).catch((e) => {
        console.error('Delete student sync failed:', e);
      });
    }
  };

  // ----------------------------------------------------
  // MODULE ACTION: FEE PAYMENT COLLECTION (BREAKDOWNS)
  // ----------------------------------------------------
  const handleCollectPayment = async (paymentData: Omit<FeePayment, 'id' | 'receiptNo' | 'recordedBy'>) => {
    const receiptNo = `REC${new Date().toISOString().slice(0,10).replace(/-/g, '')}-${payments.length + 1}`;
    const newPayment: FeePayment = {
      ...paymentData,
      id: `PAY-${Date.now().toString().slice(-4)}`,
      receiptNo,
      recordedBy: userProfile.name,
    };

    // Update payments list
    const updatedPayments = [newPayment, ...payments];
    setPayments(updatedPayments);

    // Crucial: Update the target student's outstanding balances!
    // The outstanding balance is adjusted. If they paid more than total, it contributes to advancePaid.
    // If they paid partially, the remainder becomes their new previousDue! This is extremely logical.
    const remainingBalance = paymentData.totalPayable - paymentData.amountPaid;
    const updatedStudents = students.map((s) => {
      if (s.id === paymentData.studentId) {
        return {
          ...s,
          previousDue: remainingBalance > 0 ? remainingBalance : 0,
          advancePaid: remainingBalance < 0 ? Math.abs(remainingBalance) : 0,
          // Reset monthly charge fields for the new cycle
          currentMonthFee: s.currentMonthFee,
          examFee: 0,
          transport: s.transport,
          electricity: s.electricity,
          water: s.water,
          waiver: 0,
        };
      }
      return s;
    });
    setStudents(updatedStudents);

    // Automatically log this as an Income transaction in the ledger under general fund (Tuition Fee Category)!
    // This connects fee collections directly into the finance system for absolute accuracy.
    const linkedTx: LedgerTransaction = {
      id: `TX-${Date.now().toString().slice(-4)}`,
      date: paymentData.date,
      type: 'Income',
      fund: 'General',
      category: 'Monthly Tuition',
      amount: paymentData.amountPaid,
      description: `Fees collected: ${paymentData.studentName} (${paymentData.class} - ${paymentData.month})`,
      recordedBy: userProfile.name,
    };
    const updatedLedger = [linkedTx, ...ledger];
    setLedger(updatedLedger);

    // Push everything to Google Sheets live
    const token = getAccessToken();
    if (token && spreadsheetId) {
      try {
        await appendPaymentRow(token, spreadsheetId, newPayment);
        await appendLedgerRow(token, spreadsheetId, linkedTx);
        await rewriteStudentsSheet(token, spreadsheetId, updatedStudents);
      } catch (err) {
        console.warn('Live fee append failed, trigger backup full save...', err);
        saveAllToSheets(token, spreadsheetId, { 
          students: updatedStudents, 
          ledger: updatedLedger, 
          payments: updatedPayments 
        }).catch(e => console.error(e));
      }
    }
  };

  // ----------------------------------------------------
  // MODULE ACTION: TEACHER & STAFF SALARIES
  // ----------------------------------------------------
  const handleAddTeacherStaff = (teacherData: Omit<TeacherStaff, 'id'>) => {
    const newTeacher: TeacherStaff = {
      ...teacherData,
      id: `STF-${Math.floor(100 + Math.random() * 900)}`,
    };
    setTeachersStaff([...teachersStaff, newTeacher]);
  };

  const handleDeleteTeacherStaff = (id: string) => {
    setTeachersStaff(teachersStaff.filter(t => t.id !== id));
  };

  const handlePaySalary = (paymentData: Omit<SalaryPayment, 'id' | 'recordedBy'>) => {
    const newPayment: SalaryPayment = {
      ...paymentData,
      id: `SP-${Date.now().toString().slice(-4)}`,
      recordedBy: userProfile.name,
    };
    setSalaryPayments([newPayment, ...salaryPayments]);

    // Create a transaction in the general ledger representing this salary outlay
    const linkedTx: LedgerTransaction = {
      id: `TX-${Date.now().toString().slice(-4)}`,
      date: paymentData.date,
      type: 'Expense',
      fund: 'General',
      category: paymentData.netPaid > 10000 ? 'Teacher Salary' : 'Staff Salary',
      amount: paymentData.netPaid,
      description: `Salary paid: ${paymentData.teacherStaffName} (${paymentData.month} ${paymentData.year})`,
      recordedBy: userProfile.name,
    };
    setLedger([linkedTx, ...ledger]);
  };

  const handleDeleteSalaryPayment = (id: string) => {
    const payment = salaryPayments.find(p => p.id === id);
    if (!payment) return;

    const updatedPayments = salaryPayments.filter(p => p.id !== id);
    setSalaryPayments(updatedPayments);

    const descriptionTarget = `Salary paid: ${payment.teacherStaffName} (${payment.month} ${payment.year})`;
    const updatedLedger = ledger.filter(tx => tx.description !== descriptionTarget);
    setLedger(updatedLedger);
  };

  // ----------------------------------------------------
  // MODULE ACTION: STUDENT ACADEMIC RESULTS
  // ----------------------------------------------------
  const handleAddResult = (resultData: Omit<StudentResult, 'id' | 'recordedBy'>) => {
    const newResult: StudentResult = {
      ...resultData,
      id: `RES-${Date.now().toString().slice(-4)}`,
      recordedBy: userProfile.name,
    };
    setStudentResults([newResult, ...studentResults]);
  };

  const handleDeleteResult = (id: string) => {
    setStudentResults(studentResults.filter(r => r.id !== id));
  };

  // ----------------------------------------------------
  // MODULE ACTION: LOAN FUND & ACCOUNT BOOK
  // ----------------------------------------------------
  const handleAddLoan = (loanData: Omit<LoanRecord, 'id' | 'repaidAmount' | 'status' | 'recordedBy'>) => {
    const newLoan: LoanRecord = {
      ...loanData,
      id: `LN-${Math.floor(100 + Math.random() * 900)}`,
      repaidAmount: 0,
      status: 'Active',
      recordedBy: userProfile.name,
    };
    
    // Optimistic state updates
    const updatedLoans = [...loans, newLoan];
    setLoans(updatedLoans);

    // Automatically log ledger transaction in the 'Loan' fund!
    const linkedTx: LedgerTransaction = {
      id: `TX-${Date.now().toString().slice(-4)}`,
      date: loanData.date,
      type: loanData.type === 'Taken' ? 'Income' : 'Expense',
      fund: 'Loan',
      category: loanData.type === 'Taken' ? 'Loan Received (ঋণ গ্রহণ)' : 'Loan Given (ঋণ প্রদান)',
      amount: loanData.amount,
      description: `${loanData.type === 'Taken' ? 'Taken' : 'Given'} loan: ${loanData.personName}`,
      recordedBy: userProfile.name,
    };
    setLedger([linkedTx, ...ledger]);
  };

  const handleRecordLoanPayment = (paymentData: Omit<LoanPayment, 'id' | 'recordedBy'>) => {
    const newPayment: LoanPayment = {
      ...paymentData,
      id: `LNP-${Date.now().toString().slice(-4)}`,
      recordedBy: userProfile.name,
    };
    setLoanPayments([newPayment, ...loanPayments]);

    // Update the matching loan's outstanding balance & status
    const updatedLoans = loans.map(l => {
      if (l.id === paymentData.loanId) {
        const updatedRepaid = l.repaidAmount + paymentData.amount;
        const isSettled = updatedRepaid >= l.amount - 0.01;
        return {
          ...l,
          repaidAmount: updatedRepaid,
          status: isSettled ? 'Settled' as const : 'Active' as const,
        };
      }
      return l;
    });
    setLoans(updatedLoans);

    // Find the loan record to describe the transaction correctly
    const parentLoan = loans.find(l => l.id === paymentData.loanId);
    const personName = parentLoan ? parentLoan.personName : 'Unknown';

    // Log corresponding transaction in the central finance ledger under 'Loan' fund!
    const linkedTx: LedgerTransaction = {
      id: `TX-${Date.now().toString().slice(-4)}`,
      date: paymentData.date,
      type: paymentData.type === 'Repayment' ? 'Expense' : 'Income',
      fund: 'Loan',
      category: paymentData.type === 'Repayment' ? 'Loan Repaid (ঋণ পরিশোধ)' : 'Loan Repayment Recovered (ঋণ আদায়)',
      amount: paymentData.amount,
      description: `${paymentData.type === 'Repayment' ? 'Repayment of taken loan from' : 'Recovery of given loan to'} ${personName}`,
      recordedBy: userProfile.name,
    };
    setLedger([linkedTx, ...ledger]);
  };

  const handleDeleteLoan = (id: string) => {
    setLoans(loans.filter(l => l.id !== id));
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-between">
      
      {/* Navbar branding and controls */}
      <Navbar
        user={userProfile}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onRoleChange={(role) => setUserProfile((prev) => ({ ...prev, role }))}
        onGoogleSignIn={handleGoogleSignIn}
        onGoogleSignOut={handleGoogleSignOut}
        isSyncing={isSyncing}
        sheetsLinked={!!spreadsheetId}
        onForceSync={handleForceSync}
        syncError={syncError}
      />

      {/* Main Workspace Frame */}
      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {activeTab === 'dashboard' && (
          <Dashboard
            students={students}
            ledger={ledger}
            payments={payments}
            onNavigate={(tab) => setActiveTab(tab)}
            openAddTransaction={() => {
              setActiveTab('finance');
              setIsAddTxOpen(true);
            }}
            openCollectPayment={() => {
              setActiveTab('fees');
              setIsCollectOpen(true);
            }}
          />
        )}

        {activeTab === 'finance' && (
          <FinanceModule
            ledger={ledger}
            onAddTransaction={handleAddTransaction}
            onDeleteTransaction={handleDeleteTransaction}
            userRole={userProfile.role}
            isFormOpen={isAddTxOpen}
            setIsFormOpen={setIsAddTxOpen}
          />
        )}

        {activeTab === 'fees' && (
          <FeesModule
            students={students}
            payments={payments}
            onAddStudent={handleAddStudent}
            onEditStudent={handleEditStudent}
            onDeleteStudent={handleDeleteStudent}
            onCollectPayment={handleCollectPayment}
            userRole={userProfile.role}
            isCollectOpen={isCollectOpen}
            setIsCollectOpen={setIsCollectOpen}
          />
        )}

        {activeTab === 'salaries' && (
          <SalariesModule
            teachersStaff={teachersStaff}
            salaryPayments={salaryPayments}
            onAddTeacherStaff={handleAddTeacherStaff}
            onDeleteTeacherStaff={handleDeleteTeacherStaff}
            onPaySalary={handlePaySalary}
            onDeleteSalaryPayment={handleDeleteSalaryPayment}
            userRole={userProfile.role}
          />
        )}

        {activeTab === 'results' && (
          <ResultsModule
            students={students}
            results={studentResults}
            onAddResult={handleAddResult}
            onDeleteResult={handleDeleteResult}
            userRole={userProfile.role}
          />
        )}

        {activeTab === 'loans' && (
          <LoansModule
            loans={loans}
            loanPayments={loanPayments}
            ledger={ledger}
            onAddLoan={handleAddLoan}
            onRecordLoanPayment={handleRecordLoanPayment}
            onDeleteLoan={handleDeleteLoan}
            userRole={userProfile.role}
          />
        )}
      </main>

      {/* Institutional Footer */}
      <footer className="bg-white border-t border-gray-100 py-6 text-center text-xs text-gray-400">
        <div className="max-w-7xl mx-auto px-4">
          <p>© {new Date().getFullYear()} Samdania Talimul Islam Madrasah. All rights reserved.</p>
          <p className="mt-1 font-mono text-[10px] text-gray-300">
            Powered by Google Sheets Cloud Core • Security: {userProfile.role} Session Active
          </p>
        </div>
      </footer>

    </div>
  );
}
