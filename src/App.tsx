import React, { useState, useEffect, useCallback } from 'react';
import { Eye } from 'lucide-react';
import {
  LedgerTransaction, 
  Student, 
  FeePayment, 
  TeacherStaff,
  SalaryPayment,
  StudentResult,
  LoanRecord,
  LoanPayment,
  DEFAULT_ACADEMIC_CLASSES,
  TeacherAccount,
  TeacherRoutine,
  TeacherLeave,
  AttendanceQRSet,
  AttendanceRecord,
  TeacherPortalSession,
  StudentAttendanceRecord,
  StudentAttendanceStatus,
  TeacherResignationRequest
} from './types';
import { initDatabase, dbGet, dbSet, dbDelete, onDbChange } from './lib/localDb';
import { pushNotification } from './lib/notifications';
import { getSession, logoutAdmin, setAdminReadOnlyFlag, getAdminReadOnlyFlag, ensureAdminCredentials } from './lib/auth';
import { verifyScanned, generateQRSet, todayISO, type AttendanceScanResult } from './lib/attendance';
import { clearTeacherPortalSession, createTeacherPortalSession, persistTeacherPortalSession, validateTeacherPortalSession, loadTeacherPortalSession } from './lib/teacherSessions';

import LoginPage from './components/LoginPage';
import AdminRoleSelect from './components/AdminRoleSelect';
import ViewerGate from './components/ViewerGate';
import Navbar from './components/Navbar';
import Dashboard from './components/Dashboard';
import FinanceModule from './components/FinanceModule';
import FeesModule from './components/FeesModule';
import SalariesModule from './components/SalariesModule';
import ResultsModule from './components/ResultsModule';
import LoansModule from './components/LoansModule';
import SettingsPage from './components/SettingsPage';
import SettingsGate from './components/SettingsGate';
import ClosingModule from './components/ClosingModule';
import HifzModule from './components/HifzModule';
import StudentSummaryModule from './components/StudentSummaryModule';
import Onboarding from './components/Onboarding';
import TeacherAuth from './components/TeacherAuth';
import TeacherDashboard from './components/TeacherDashboard';
import TeacherSettings from './components/TeacherSettings';
import TeacherProfileCompletion from './components/TeacherProfileCompletion';
import AttendanceSection from './components/AttendanceSection';
import QrGenerateSection from './components/QrGenerateSection';
import AttendanceReportTab from './components/AttendanceReportTab';
import PendingOperations from './components/PendingOperations';
import AssistantModule from './components/AssistantModule';
import AppManagementPage from './components/AppManagementPage';
import MissingFilloutsPage from './components/MissingFilloutsPage';
import { tabToPath, pathToTab, type AppTab } from './lib/routes';
import type { AgentActions } from './lib/aiTools';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  // When true the whole admin console is rendered read-only (Viewer Admin role).
  const [adminReadOnly, setAdminReadOnly] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  // Navigation tab state — initialised from the real URL path so a page like
  // /students opens directly on the Students tab and is shareable/refreshable.
  const [activeTab, setActiveTab] = useState<AppTab>(() => {
    const fromPath = typeof window !== 'undefined' ? pathToTab(window.location.pathname) : null;
    return fromPath ?? 'dashboard';
  });

  // Navigate between top-level sections, pushing a real, shareable URL onto the
  // browser history so the address bar reflects the current page (e.g. /students).
  const navigate = React.useCallback((tab: AppTab) => {
    const path = tabToPath(tab);
    if (window.location.pathname !== path) {
      window.history.pushState({ tab }, '', path);
    }
    setActiveTab(tab);
  }, []);

  // Keep the active tab in sync when the user uses the browser back/forward buttons.
  useEffect(() => {
    const onPop = () => {
      const fromPath = pathToTab(window.location.pathname);
      if (fromPath) setActiveTab(fromPath);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const adminName = 'samdaniaa madrasah';

  // ── LOCAL SQL DATABASE (SQLite/WASM persisted to IndexedDB) ──
  const [dbReady, setDbReady] = useState(false);
  useEffect(() => {
    let mounted = true;
    initDatabase()
      .then(() => { if (mounted) setDbReady(true); })
      .catch(() => { if (mounted) setDbReady(true); }); // proceed with in-memory fallback
    return () => { mounted = false; };
  }, []);

  // Core records database state — loaded from the local SQL db once it is ready
  const [students, setStudents] = useState<Student[]>([]);
  const [ledger, setLedger] = useState<LedgerTransaction[]>([]);
  const [payments, setPayments] = useState<FeePayment[]>([]);

  // ── HIFZ MODULE: fully independent data (separate school, no relation to Fees) ──
  const [hifzStudents, setHifzStudents] = useState<Student[]>([]);
  const [hifzPayments, setHifzPayments] = useState<FeePayment[]>([]);
  const [hifzAcademicClasses, setHifzAcademicClasses] = useState<string[]>(['Hifz']);
  const [hifzInvoiceCounter, setHifzInvoiceCounter] = useState<number>(101);

  // ── HIFZ FINANCE LEDGER (independent of Fees ledger) ──
  const [hifzLedger, setHifzLedger] = useState<LedgerTransaction[]>([]);

  // Teachers, Salaries, Results, and Loans state
  const [teachersStaff, setTeachersStaff] = useState<TeacherStaff[]>([]);
  const [salaryPayments, setSalaryPayments] = useState<SalaryPayment[]>([]);
  const [studentResults, setStudentResults] = useState<StudentResult[]>([]);
  const [loans, setLoans] = useState<LoanRecord[]>([]);
  const [loanPayments, setLoanPayments] = useState<LoanPayment[]>([]);

  // ── TEACHER ACCOUNTS (created via onboarding) & teacher session ──
  const [teacherAccounts, setTeacherAccounts] = useState<TeacherAccount[]>([]);
  const [teacherRoutines, setTeacherRoutines] = useState<TeacherRoutine[]>([]);
  // Teacher leave records (ছুটি) — managed by admin, viewed by teacher
  const [teacherLeaves, setTeacherLeaves] = useState<TeacherLeave[]>([]);
  // Teacher resignation requests (pending school exit)
  const [teacherResignations, setTeacherResignations] = useState<TeacherResignationRequest[]>([]);
  // ── TEACHER ATTENDANCE (উপস্থিতি): 12-day QR set + per-day records ──
  const [attendanceQRSet, setAttendanceQRSet] = useState<AttendanceQRSet | null>(null);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [studentAttendanceRecords, setStudentAttendanceRecords] = useState<StudentAttendanceRecord[]>([]);
  // Per-teacher salary-reveal preference (persisted so it survives refresh)
  const [salaryVisibleTeachers, setSalaryVisibleTeachers] = useState<string[]>([]);
  const [teacherSession, setTeacherSession] = useState<TeacherPortalSession | null>(null);
  const [preAuthView, setPreAuthView] = useState<'onboarding' | 'adminRole' | 'adminLogin' | 'viewerGate' | 'teacherAuth'>('onboarding');
  const [teacherView, setTeacherView] = useState<'dashboard' | 'settings'>('dashboard');
  const [settingsUnlocked, setSettingsUnlocked] = useState(false);
  const [attendanceRouteToken, setAttendanceRouteToken] = useState<string | null>(null);

  const [academicClasses, setAcademicClasses] = useState<string[]>(DEFAULT_ACADEMIC_CLASSES);
  const [paymentMethods, setPaymentMethods] = useState<string[]>([]);
  const [admins, setAdmins] = useState<string[]>([]); // Names of admins authorized to receive fees

  // Persistent invoice counter — never decrements, survives deletes
  const [invoiceCounter, setInvoiceCounter] = useState<number>(101);

  // Prevents the initial empty React state from being written back to Supabase
  // before the first hydrate completes (that race was wiping student data).
  const [dbHydrated, setDbHydrated] = useState(false);

  // ── REAL-TIME SYNC ──
  // Re-hydrate all data state from the db. Called on initial load AND on every
  // live db change (another tab/device wrote), so the UI updates instantly
  // with no manual refresh. Auth/session/navigation state is intentionally
  // excluded so a remote change never disrupts the current user's session.
  const syncFromDb = useCallback(() => {
    if (!dbReady) return;
    const load = <T,>(key: string, fallback: T, transform?: (v: any) => T): T => {
      const v = dbGet(key);
      if (v == null) return fallback;
      try {
        return transform ? transform(v) : (v as T);
      } catch {
        return fallback;
      }
    };

    // Seed / migrate admin credentials into Supabase so login works on every device.
    ensureAdminCredentials();

    const sharedStudents = dbGet('students');
    setStudents(sharedStudents != null ? load('students', [], (value: any[]) => value.map((student) => ({
      ...student,
      id: student.id || student.studentId || `ST-${Date.now().toString(36)}`,
      name: student.name || student.banglaName || '',
      roll: String(student.roll ?? student.rollNumber ?? ''),
      class: student.class || student.className || '',
      contact: student.contact || student.phone || '',
      photoUrl: student.photoUrl || student.photo_url || '',
      photo_url: student.photo_url || student.photoUrl || '',
      fatherName: student.fatherName || '',
      motherName: student.motherName || '',
      extraInfo: student.extraInfo || '',
      previousDue: Number(student.previousDue) || 0,
      currentMonthFee: Number(student.currentMonthFee) || 0,
      examFee: Number(student.examFee) || 0,
      transport: Number(student.transport) || 0,
      electricity: Number(student.electricity) || 0,
      water: Number(student.water) || 0,
      waiver: Number(student.waiver) || 0,
      advancePaid: Number(student.advancePaid) || 0,
    }))) : load('samdani_students', []));
    setLedger(load('samdani_ledger', []));
    setPayments(load('samdani_payments', [], (v: any[]) =>
      v.map((p, i) => ({ ...p, invoiceNo: p.invoiceNo ?? (101 + i) }))
    ));
    setHifzStudents(load('samdani_hifz_students', []));
    setHifzPayments(load('samdani_hifz_payments', [], (v: any[]) =>
      v.map((p, i) => ({ ...p, invoiceNo: p.invoiceNo ?? (101 + i) }))
    ));
    setHifzAcademicClasses(load('samdani_hifz_academic_classes', ['Hifz']));
    const hifzLoaded = load<FeePayment[]>('samdani_hifz_payments', []);
    const hifzMax = hifzLoaded.reduce((max, p) => Math.max(max, p.invoiceNo || 0), 100);
    const storedHifz = dbGet('samdani_hifz_invoice_counter');
    setHifzInvoiceCounter(storedHifz != null ? storedHifz : hifzMax + 1);
    setHifzLedger(load('samdani_hifz_ledger', []));
    setTeachersStaff(load('samdani_teachers_staff', []));
    setSalaryPayments(load('samdani_salary_payments', []));
    setStudentResults(load('samdani_student_results', []));
    setLoans(load('samdani_loans', []));
    setLoanPayments(load('samdani_loan_payments', []));
    setAcademicClasses(load('samdani_academic_classes', DEFAULT_ACADEMIC_CLASSES));
    setPaymentMethods(load('samdani_payment_methods', []));
    setAdmins(load('samdani_admins', []));
    setTeacherAccounts(load('samdani_teacher_accounts', [], (v: any[]) =>
      v.map((a) => ({ ...a, status: a.status || (a.registered ? 'verified' : 'unverified') }))
    ));
    setTeacherRoutines(load('samdani_teacher_routines', []));
    setTeacherLeaves(load('samdani_teacher_leaves', []));
    setTeacherResignations(load('samdani_teacher_resignations', []));
    setSalaryVisibleTeachers(load('samdani_salary_visible', []));
    setAttendanceQRSet(load<AttendanceQRSet | null>('samdani_attendance_qrset', null));
    setAttendanceRecords(load('samdani_attendance_records', []));
    setStudentAttendanceRecords(load('samdani_student_attendance_records', [], (v: any[]) =>
      v.map((rec: any) => ({
        ...rec,
        statuses: (rec.statuses || []).map((s: any) => ({
          ...s,
          present: typeof s.present === 'boolean' ? s.present : s.status !== 'absent',
          late: typeof s.late === 'boolean' ? s.late : s.status === 'late',
          dairy: typeof s.dairy === 'boolean' ? s.dairy : s.status === 'dairy',
          uniform: typeof s.uniform === 'boolean' ? s.uniform : s.status === 'uniform',
        })),
      }))
    ));

    const loadedPayments = load<FeePayment[]>('samdani_payments', []);
    const maxInvoice = loadedPayments.reduce((max, p) => Math.max(max, p.invoiceNo || 0), 100);
    const storedCounter = dbGet('samdani_invoice_counter');
    setInvoiceCounter(storedCounter != null ? storedCounter : maxInvoice + 1);
    setDbHydrated(true);
  }, [dbReady]);

  // Initial load once the db is ready.
  useEffect(() => { syncFromDb(); }, [syncFromDb]);

  // Live re-sync on every db change coming from another tab or device.
  // Debounced so a burst of writes coalesces into a single refresh.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsub = onDbChange(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => syncFromDb(), 120);
    });
    return () => {
      if (timer) clearTimeout(timer);
      unsub();
    };
  }, [syncFromDb]);

  // ── PERSISTENCE: write back only AFTER the first hydrate ──
  // Writing before hydrate would push empty [] arrays and wipe Supabase.
  const canPersist = dbReady && dbHydrated;
  useEffect(() => {
    if (!canPersist) return;
    [
      'samdani_students',
      'samdani_notifications',
      'samdani_student_attendance_records',
      'samdani_teacher_routines',
      'samdani_student_results',
      'samdani_academic_info',
      'samdani_homework',
    ].forEach((key) => {
      if (dbGet(key) == null) dbSet(key, []);
    });
  }, [canPersist]);
  useEffect(() => { if (canPersist) dbSet('samdani_invoice_counter', invoiceCounter); }, [invoiceCounter, canPersist]);
  useEffect(() => {
    if (canPersist) dbSet('samdani_students', students.map((student) => ({
      ...student,
      photo_url: student.photoUrl || student.photo_url || '',
    })));
  }, [students, canPersist]);
  useEffect(() => {
    if (!canPersist) return;
    dbSet('students', students.map((student) => ({
      ...student,
      rollNumber: student.roll,
      className: student.class,
      phone: student.contact,
      photoUrl: student.photoUrl || '',
      photo_url: student.photoUrl || student.photo_url || '',
    })));
  }, [students, canPersist]);
  useEffect(() => { if (canPersist) dbSet('samdani_ledger', ledger); }, [ledger, canPersist]);
  useEffect(() => { if (canPersist) dbSet('samdani_payments', payments); }, [payments, canPersist]);
  useEffect(() => { if (canPersist) dbSet('samdani_hifz_students', hifzStudents); }, [hifzStudents, canPersist]);
  useEffect(() => { if (canPersist) dbSet('samdani_hifz_payments', hifzPayments); }, [hifzPayments, canPersist]);
  useEffect(() => { if (canPersist) dbSet('samdani_hifz_academic_classes', hifzAcademicClasses); }, [hifzAcademicClasses, canPersist]);
  useEffect(() => { if (canPersist) dbSet('samdani_hifz_invoice_counter', hifzInvoiceCounter); }, [hifzInvoiceCounter, canPersist]);
  useEffect(() => { if (canPersist) dbSet('samdani_hifz_ledger', hifzLedger); }, [hifzLedger, canPersist]);
  useEffect(() => { if (canPersist) dbSet('samdani_teachers_staff', teachersStaff); }, [teachersStaff, canPersist]);
  useEffect(() => { if (canPersist) dbSet('samdani_salary_payments', salaryPayments); }, [salaryPayments, canPersist]);
  useEffect(() => { if (canPersist) dbSet('samdani_student_results', studentResults); }, [studentResults, canPersist]);
  useEffect(() => { if (canPersist) dbSet('samdani_loans', loans); }, [loans, canPersist]);
  useEffect(() => { if (canPersist) dbSet('samdani_loan_payments', loanPayments); }, [loanPayments, canPersist]);
  useEffect(() => { if (canPersist) dbSet('samdani_academic_classes', academicClasses); }, [academicClasses, canPersist]);
  useEffect(() => { if (canPersist) dbSet('samdani_payment_methods', paymentMethods); }, [paymentMethods, canPersist]);
  useEffect(() => { if (canPersist) dbSet('samdani_admins', admins); }, [admins, canPersist]);
  useEffect(() => { if (canPersist) dbSet('samdani_teacher_accounts', teacherAccounts); }, [teacherAccounts, canPersist]);
  useEffect(() => { if (canPersist) dbSet('samdani_teacher_routines', teacherRoutines); }, [teacherRoutines, canPersist]);
  useEffect(() => { if (canPersist) dbSet('samdani_teacher_leaves', teacherLeaves); }, [teacherLeaves, canPersist]);
  useEffect(() => { if (canPersist) dbSet('samdani_teacher_resignations', teacherResignations); }, [teacherResignations, canPersist]);
  useEffect(() => { if (canPersist) dbSet('samdani_salary_visible', salaryVisibleTeachers); }, [salaryVisibleTeachers, canPersist]);
  useEffect(() => { if (canPersist) dbSet('samdani_attendance_qrset', attendanceQRSet); }, [attendanceQRSet, canPersist]);
  useEffect(() => { if (canPersist) dbSet('samdani_attendance_records', attendanceRecords); }, [attendanceRecords, canPersist]);
  useEffect(() => { if (canPersist) dbSet('samdani_student_attendance_records', studentAttendanceRecords); }, [studentAttendanceRecords, canPersist]);

  useEffect(() => {
    if (!dbReady) return;
    // Only write the session when one exists. We must NOT clear here when
    // teacherSession is null — on mount the restore effect hasn't run yet, and
    // clearing would wipe a perfectly good persisted session (logging the
    // teacher out on every refresh). Explicit logout clears storage instead.
    if (teacherSession) persistTeacherPortalSession(teacherSession);
  }, [teacherSession, dbReady]);

  useEffect(() => {
    if (!dbReady || !teacherSession) return;
    const currentAccount = teacherAccounts.find((a) => a.id === teacherSession.accountId);
    // Don't invalidate until the account list has actually loaded — otherwise a
    // restored session would be wrongly cleared on the first render after refresh.
    if (!currentAccount) {
      if (teacherAccounts.length > 0) {
        setTeacherSession(null);
        clearTeacherPortalSession();
      }
      return;
    }
    if (!validateTeacherPortalSession(teacherSession, currentAccount)) {
      setTeacherSession(null);
      clearTeacherPortalSession();
    }
  }, [dbReady, teacherAccounts, teacherSession]);

  // Restore a previously persisted teacher portal session so a page refresh
  // does NOT log the teacher out. Runs once the db + accounts are available.
  const [teacherRestored, setTeacherRestored] = useState(false);
  useEffect(() => {
    if (!dbReady || teacherRestored) return;
    setTeacherRestored(true);
    const restored = loadTeacherPortalSession();
    if (restored) setTeacherSession(restored);
  }, [dbReady, teacherRestored]);

  // Auto-cleanup: permanently delete rejected teacher accounts that have not been
  // visited for more than 1 day (24h) since they were rejected.
  useEffect(() => {
    if (!dbReady) return;
    const DAY_MS = 24 * 60 * 60 * 1000;
    const stale = teacherAccounts.filter(
      (a) => a.status === 'rejected' && a.rejectedAt && Date.now() - new Date(a.rejectedAt).getTime() > DAY_MS
    );
    if (stale.length > 0) {
      const staleIds = new Set(stale.map((a) => a.id));
      setTeacherAccounts((prev) => prev.filter((a) => !staleIds.has(a.id)));
      setTeacherRoutines((prev) => prev.filter((r) => !staleIds.has(r.teacherId)));
      setTeacherLeaves((prev) => prev.filter((l) => !staleIds.has(l.teacherId)));
    }
  }, [teacherAccounts, dbReady]);

  // Check for existing admin session on mount
  useEffect(() => {
    const session = getSession();
    if (session) {
      setIsAuthenticated(true);
      setAdminReadOnly(getAdminReadOnlyFlag());
    }
    setAuthLoading(false);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const path = window.location.pathname;
    const match = path.match(/^\/attend\/(.+)$/i);
    if (match?.[1]) {
      setAttendanceRouteToken(match[1]);
      if (teacherSession) {
        setTeacherView('dashboard');
      }
    }
  }, [teacherSession]);

  // Re-lock the Settings area whenever the admin navigates away from it,
  // so the settings password is required again each time it is opened.
  useEffect(() => {
    if (activeTab !== 'settings') setSettingsUnlocked(false);
  }, [activeTab]);

  // Synchronization and loading flags
  const [isLoading, setIsLoading] = useState(false);

  // Form toggles
  const [isAddTxOpen, setIsAddTxOpen] = useState(false);
  const [isCollectOpen, setIsCollectOpen] = useState(false);
  const [isHifzCollectOpen, setIsHifzCollectOpen] = useState(false);

  // Pending student targeting (from Student Summary quick actions → Fees module)
  const [pendingCollectStudentId, setPendingCollectStudentId] = useState<string | null>(null);
  const [pendingEditStudentId, setPendingEditStudentId] = useState<string | null>(null);

  // ----------------------------------------------------
  // MODULE ACTION: FINANCE LEDGER
  // ----------------------------------------------------
  const handleAddTransaction = async (txData: Omit<LedgerTransaction, 'id' | 'recordedBy'>) => {
    const newTx: LedgerTransaction = {
      ...txData,
      id: `TX-${Date.now().toString().slice(-4)}`,
      recordedBy: adminName,
    };

    const updatedLedger = [newTx, ...ledger];
    setLedger(updatedLedger);

    pushNotification({
      type: 'ledger',
      title: `${txData.type === 'Income' ? 'Income' : 'Expense'} recorded`,
      message: `${txData.category} · ৳${txData.amount.toLocaleString()} (${txData.fund} fund)`,
    });
  };

  const handleDeleteTransaction = async (id: string) => {
    const updatedLedger = ledger.filter((t) => t.id !== id);
    setLedger(updatedLedger);
  };

  // ----------------------------------------------------
  // MODULE ACTION: STUDENT DIRECTORY
  // ----------------------------------------------------
  const handleAddStudent = async (studentData: Omit<Student, 'id'>) => {
    const newStudent: Student = {
      ...studentData,
      // Unique ID — old ST-100..999 scheme collided and broke live search re-renders
      id: `ST-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`,
    };

    const updatedStudents = [...students, newStudent];
    setStudents(updatedStudents);

    pushNotification({
      type: 'student',
      title: 'New student admitted',
      message: `${studentData.name} joined class ${studentData.class}`,
    });
  };

  const handleEditStudent = async (editedStudent: Student) => {
    const updatedStudents = students.map((s) => (s.id === editedStudent.id ? editedStudent : s));
    setStudents(updatedStudents);
  };

  const handleDeleteStudent = async (id: string) => {
    const updatedStudents = students.filter((s) => s.id !== id);
    setStudents(updatedStudents);
  };

  // Jump from Student Summary → Fees and open the Collect Fee form for a student
  const handlePayStudentFees = (id: string) => {
    setPendingCollectStudentId(id);
    navigate('fees');
    setIsCollectOpen(true);
  };

  // Jump from Student Summary → Fees and open the Edit Profile form for a student
  const handleEditStudentFromSummary = (id: string) => {
    setPendingEditStudentId(id);
    navigate('fees');
  };

  // ----------------------------------------------------
  // MODULE ACTION: FEE PAYMENT COLLECTION (BREAKDOWNS)
  // ----------------------------------------------------
  const handleCollectPayment = async (paymentData: Omit<FeePayment, 'id' | 'receiptNo' | 'invoiceNo' | 'recordedBy'>) => {
    const nextInvoice = invoiceCounter;
    setInvoiceCounter(prev => prev + 1);
    const receiptNo = `REC${new Date().toISOString().slice(0,10).replace(/-/g, '')}-${nextInvoice}`;
    const newPayment: FeePayment = {
      ...paymentData,
      id: `PAY-${Date.now().toString().slice(-4)}`,
      receiptNo,
      invoiceNo: nextInvoice,
      recordedBy: adminName,
    };

    // Update payments list
    const updatedPayments = [newPayment, ...payments];
    setPayments(updatedPayments);

    pushNotification({
      type: 'payment',
      title: 'Fee payment received',
      message: `${paymentData.studentName} paid ৳${paymentData.amountPaid.toLocaleString()} (${paymentData.month})`,
    });

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
          currentMonthFee: 0,
          examFee: 0,
          transport: 0,
          electricity: 0,
          water: 0,
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
      recordedBy: adminName,
    };
    const updatedLedger = [linkedTx, ...ledger];
    setLedger(updatedLedger);
  };

  // ----------------------------------------------------
  // MODULE ACTION: HIFZ STUDENT DIRECTORY (fully independent of Fees)
  // ----------------------------------------------------
  const handleAddHifzStudent = (studentData: Omit<Student, 'id'>) => {
    const newStudent: Student = {
      ...studentData,
      id: `HF-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`,
    };
    setHifzStudents([...hifzStudents, newStudent]);

    pushNotification({
      type: 'student',
      title: 'New Hifz student admitted',
      message: `${studentData.name} joined ${studentData.class}`,
    });
  };

  const handleEditHifzStudent = (editedStudent: Student) => {
    setHifzStudents(hifzStudents.map((s) => (s.id === editedStudent.id ? editedStudent : s)));
  };

  const handleDeleteHifzStudent = (id: string) => {
    setHifzStudents(hifzStudents.filter((s) => s.id !== id));
  };

  // Collect payment for HIFZ students — does NOT touch the finance ledger
  // and does NOT sync to the Fees Google Sheet (separate school).
  const handleCollectHifzPayment = (paymentData: Omit<FeePayment, 'id' | 'receiptNo' | 'invoiceNo' | 'recordedBy'>) => {
    const nextInvoice = hifzInvoiceCounter;
    setHifzInvoiceCounter(prev => prev + 1);
    const receiptNo = `HREC${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${nextInvoice}`;
    const newPayment: FeePayment = {
      ...paymentData,
      id: `HPAY-${Date.now().toString().slice(-4)}`,
      receiptNo,
      invoiceNo: nextInvoice,
      recordedBy: adminName,
    };

    const updatedPayments = [newPayment, ...hifzPayments];
    setHifzPayments(updatedPayments);

    pushNotification({
      type: 'payment',
      title: 'Hifz fee received',
      message: `${paymentData.studentName} paid ৳${paymentData.amountPaid.toLocaleString()} (${paymentData.month})`,
    });

    // Update the target HIFZ student's outstanding balances only
    const remainingBalance = paymentData.totalPayable - paymentData.amountPaid;
    const updatedStudents = hifzStudents.map((s) => {
      if (s.id === paymentData.studentId) {
        return {
          ...s,
          previousDue: remainingBalance > 0 ? remainingBalance : 0,
          advancePaid: remainingBalance < 0 ? Math.abs(remainingBalance) : 0,
          currentMonthFee: 0,
          examFee: 0,
          transport: 0,
          electricity: 0,
          water: 0,
          waiver: 0,
        };
      }
      return s;
    });
    setHifzStudents(updatedStudents);

    // Log this hifz fee collection into the SEPARATE hifz ledger (never the fees ledger)
    const linkedTx: LedgerTransaction = {
      id: `HTX-${Date.now().toString().slice(-4)}`,
      date: paymentData.date,
      type: 'Income',
      fund: 'General',
      category: 'Hifz Fee Collection',
      amount: paymentData.amountPaid,
      description: `Hifz fees collected: ${paymentData.studentName} (${paymentData.class} - ${paymentData.month})`,
      recordedBy: adminName,
    };
    setHifzLedger([linkedTx, ...hifzLedger]);
  };

  // Manual transaction entry for the HIFZ finance ledger (income / expense)
  const handleAddHifzTransaction = (txData: Omit<LedgerTransaction, 'id' | 'recordedBy'>) => {
    const newTx: LedgerTransaction = {
      ...txData,
      id: `HTX-${Date.now().toString().slice(-4)}`,
      recordedBy: adminName,
    };
    setHifzLedger([newTx, ...hifzLedger]);

    pushNotification({
      type: 'ledger',
      title: `Hifz ${txData.type === 'Income' ? 'income' : 'expense'} recorded`,
      message: `${txData.category} · ৳${txData.amount.toLocaleString()}`,
    });
  };

  // ----------------------------------------------------
  // MODULE ACTION: TEACHER & STAFF SALARIES
  // ----------------------------------------------------
  const handleDeleteTeacherStaff = (id: string) => {
    setTeachersStaff(teachersStaff.filter(t => t.id !== id));
  };

  // ── TEACHER PORTAL (onboarding) handlers ──
  const handleCreateTeacherAccount = (acc: Omit<TeacherAccount, 'registered' | 'createdAt' | 'status'>): TeacherAccount => {
    const newAccount: TeacherAccount = {
      ...acc,
      registered: false,
      status: 'unverified',
      createdAt: new Date().toISOString(),
    };
    setTeacherAccounts((prev) => {
      const next = [...prev, newAccount];
      dbSet('samdani_teacher_accounts', next);
      return next;
    });
    pushNotification({
      type: 'teacher',
      title: 'New teacher account created',
      message: `${acc.fullName} (${acc.designation || 'Teacher'}) is awaiting verification`,
    });
    return newAccount;
  };

  const handleTeacherLogin = (session: TeacherPortalSession) => {
    // Look up from the live db as well: handleCreateTeacherAccount writes the
    // new account to the db synchronously, but React state re-render is async,
    // so a just-created account may not yet be in `teacherAccounts` when this
    // runs. Reading the db (cache) guarantees we find it immediately.
    const fromDb: TeacherAccount[] = dbGet('samdani_teacher_accounts') ?? [];
    const account =
      teacherAccounts.find((a) => a.id === session.accountId) ??
      fromDb.find((a) => a.id === session.accountId);
    if (!account) {
      alert('This teacher account could not be found. Please try again.');
      return;
    }
    const portalSession = createTeacherPortalSession(account);
    setTeacherSession(portalSession);
  };

  const handleTeacherLogout = () => {
    clearTeacherPortalSession();
    setTeacherSession(null);
    setTeacherView('dashboard');
    setPreAuthView('onboarding');
  };

  // Register a teacher who created an account into the salary roster
  const handleRegisterTeacherAccount = (accountId: string, monthlySalary: number) => {
    const acc = teacherAccounts.find(a => a.id === accountId);
    if (!acc) {
      alert('Unable to verify teacher account. Please reload and try again.');
      return;
    }
    const newTeacher: TeacherStaff = {
      id: `STF-${Math.floor(100 + Math.random() * 900)}`,
      name: acc.fullName,
      role: 'Teacher',
      designation: acc.designation,
      baseSalary: monthlySalary,
      contact: '',
      email: acc.email,
      bio: acc.bio,
    };
    setTeachersStaff([...teachersStaff, newTeacher]);
    setTeacherAccounts((prev) => prev.map(a =>
      a.id === accountId
        ? { ...a, registered: true, status: 'verified' }
        : a
    ));
    pushNotification({
      type: 'teacher',
      title: 'Teacher verified & registered',
      message: `${acc.fullName} is now part of the staff roster`,
    });
    alert(`Teacher ${acc.fullName} has been verified and registered successfully.`);
  };

  // Reject a pending teacher account (with a reason shown on their portal)
  const handleRejectTeacherAccount = (accountId: string, reason: string) => {
    setTeacherAccounts((prev) => prev.map(a =>
      a.id === accountId
        ? { ...a, registered: false, status: 'rejected', rejectionReason: reason, rejectedAt: new Date().toISOString() }
        : a
    ));
    const acc = teacherAccounts.find((a) => a.id === accountId);
    if (acc) {
      pushNotification({
        type: 'teacher',
        title: 'Teacher application rejected',
        message: `${acc.fullName}'s registration was rejected`,
      });
    }
  };

  // Permanently delete a rejected teacher account (from the portal countdown / auto-cleanup)
  const handleDeleteTeacherAccount = (accountId: string) => {
    setTeacherAccounts((prev) => prev.filter((a) => a.id !== accountId));
    setTeacherRoutines((prev) => prev.filter((r) => r.teacherId !== accountId));
    setTeacherLeaves((prev) => prev.filter((l) => l.teacherId !== accountId));
  };

  // Teacher resignation flow: a teacher asks to leave; the admin approves/rejects.
  const handleSubmitResignation = (teacherId: string, reason?: string) => {
    const acc = teacherAccounts.find((a) => a.id === teacherId);
    if (!acc) return;
    const req: TeacherResignationRequest = {
      id: `RES-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 900 + 100)}`,
      teacherId,
      teacherName: acc.fullName,
      teacherEmail: acc.email,
      reason: reason?.trim() || undefined,
      requestedAt: new Date().toISOString(),
      status: 'pending',
    };
    setTeacherResignations((prev) => [req, ...prev]);
    pushNotification({
      type: 'resignation',
      title: 'Resignation requested',
      message: `${req.teacherName} has requested to leave the madrasah`,
    });
  };

  const handleResolveResignation = (requestId: string, approve: boolean) => {
    const req = teacherResignations.find((r) => r.id === requestId);
    if (!req) return;
    setTeacherResignations((prev) =>
      prev.map((r) =>
        r.id === requestId
          ? { ...r, status: approve ? 'approved' : 'rejected', resolvedAt: new Date().toISOString() }
          : r
      )
    );
    pushNotification({
      type: 'resignation',
      title: `Resignation ${approve ? 'approved' : 'rejected'}`,
      message: `${req.teacherName}'s resignation request was ${approve ? 'approved' : 'rejected'}`,
    });
    if (approve) {
      const acc = teacherAccounts.find((a) => a.id === req.teacherId);
      setTeacherAccounts((prev) => prev.filter((a) => a.id !== req.teacherId));
      setTeacherRoutines((prev) => prev.filter((r) => r.teacherId !== req.teacherId));
      setTeacherLeaves((prev) => prev.filter((l) => l.teacherId !== req.teacherId));
      if (acc) setTeachersStaff((prev) => prev.filter((s) => s.email !== acc.email));
    }
  };

  // Full deletion of a teacher by the admin (account + staff roster + related data).
  const handleAdminDeleteTeacher = (teacherId: string) => {
    const acc = teacherAccounts.find((a) => a.id === teacherId);
    setTeacherAccounts((prev) => prev.filter((a) => a.id !== teacherId));
    setTeacherRoutines((prev) => prev.filter((r) => r.teacherId !== teacherId));
    setTeacherLeaves((prev) => prev.filter((l) => l.teacherId !== teacherId));
    if (acc) setTeachersStaff((prev) => prev.filter((s) => s.email !== acc.email));
    setTeacherResignations((prev) => prev.filter((r) => r.teacherId !== teacherId));
  };

  // Patch any teacher-account fields (e.g. photoUrl/role after profile completion)
  const handleUpdateTeacherAccount = (id: string, patch: Partial<TeacherAccount>) => {
    setTeacherAccounts((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  };

  const handleUpdateTeacherProfile = (accountId: string, patch: { fullName: string; designation: string; contact: string; email: string; bio: string; photoUrl?: string }) => {
    const account = teacherAccounts.find((item) => item.id === accountId);
    setTeacherAccounts((prev) => prev.map((item) => item.id === accountId ? { ...item, ...patch } : item));
    if (account) {
      setTeachersStaff((prev) => prev.map((staff) => staff.email === account.email ? {
        ...staff,
        name: patch.fullName,
        designation: patch.designation,
        contact: patch.contact,
        email: patch.email,
        bio: patch.bio,
      } : staff));
    }
  };

  // Teacher class-routine (ক্লাস রুটিন) handlers — managed by admin, viewed by teacher
  const handleAddTeacherRoutine = (entry: Omit<TeacherRoutine, 'id'>) => {
    const newRoutine: TeacherRoutine = {
      ...entry,
      id: `TR-${Date.now().toString().slice(-5)}-${Math.floor(Math.random() * 900 + 100)}`,
    };
    setTeacherRoutines((prev) => [...prev, newRoutine]);
  };

  const handleDeleteTeacherRoutine = (id: string) => {
    setTeacherRoutines((prev) => prev.filter((r) => r.id !== id));
  };

  // Teacher leave (ছুটি) handlers — managed by admin, viewed/cancelled by teacher
  const handleAddTeacherLeave = (entry: Omit<TeacherLeave, 'id'>) => {
    const newLeave: TeacherLeave = {
      ...entry,
      id: `TL-${Date.now().toString().slice(-5)}-${Math.floor(Math.random() * 900 + 100)}`,
    };
    setTeacherLeaves((prev) => [...prev, newLeave]);
    const leaveTeacher =
      teachersStaff.find((s) => s.id === entry.teacherId) ||
      teacherAccounts.find((a) => a.id === entry.teacherId);
    const leaveName = leaveTeacher
      ? ('name' in leaveTeacher ? leaveTeacher.name : (leaveTeacher as any).fullName)
      : 'A teacher';
    pushNotification({
      type: 'leave',
      title: 'Leave applied',
      message: `${leaveName} requested leave (${entry.startDate} → ${entry.endDate})`,
    });
  };

  const handleDeleteTeacherLeave = (id: string) => {
    setTeacherLeaves((prev) => prev.filter((l) => l.id !== id));
  };

  // Toggle whether a teacher's monthly salary is revealed on their dashboard
  const handleToggleSalaryVisible = (teacherId: string) => {
    setSalaryVisibleTeachers((prev) =>
      prev.includes(teacherId) ? prev.filter((id) => id !== teacherId) : [...prev, teacherId]
    );
  };

  // ── TEACHER ATTENDANCE (উপস্থিতি) handlers ──
  const handleGenerateAttendanceQRSet = (startDate: string) => {
    setAttendanceQRSet(generateQRSet(startDate));
  };

  const handleDeleteAttendanceQRSet = () => {
    setAttendanceQRSet(null);
  };

  // Called by the teacher portal scanner. Verifies the scanned token, then
  // records arrival (1st scan) / departure (2nd scan) for the logged-in teacher.
  const handleAttendanceScan = (
    teacherId: string,
    teacherName: string,
    raw: string
  ): AttendanceScanResult => {
    const v = verifyScanned(attendanceQRSet, raw);
    if (!v.ok) return { status: 'invalid' };
    const today = todayISO();
    if (v.date !== today) return { status: 'wrongday', qrDate: v.date };

    const id = `${teacherId}_${today}`;
    const existing = attendanceRecords.find((r) => r.id === id);
    const now = new Date().toISOString();

    if (!existing) {
      const rec: AttendanceRecord = { id, teacherId, teacherName, date: today, entryTime: now, exitTime: null };
      setAttendanceRecords((prev) => [rec, ...prev]);
      pushNotification({
        type: 'attendance',
        title: 'Teacher arrived',
        message: `${teacherName} marked attendance at ${new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      });
      return { status: 'arrived', time: now };
    }
    if (!existing.entryTime) {
      const updated = { ...existing, entryTime: now };
      setAttendanceRecords((prev) => prev.map((r) => (r.id === id ? updated : r)));
      pushNotification({
        type: 'attendance',
        title: 'Teacher arrived',
        message: `${teacherName} marked attendance at ${new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      });
      return { status: 'arrived', time: now };
    }
    if (!existing.exitTime) {
      const updated = { ...existing, exitTime: now };
      setAttendanceRecords((prev) => prev.map((r) => (r.id === id ? updated : r)));
      pushNotification({
        type: 'attendance',
        title: 'Teacher departed',
        message: `${teacherName} left at ${new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      });
      return { status: 'departed', time: now };
    }
    // Already fully recorded → 3rd scan is rejected
    return { status: 'already', entryTime: existing.entryTime, exitTime: existing.exitTime };
  };

  const handleSubmitStudentAttendance = (payload: {
    teacherId: string;
    teacherName: string;
    className: string;
    date: string;
    statuses: StudentAttendanceStatus[];
  }) => {
    const id = `${payload.teacherId}_${payload.className}_${payload.date}`;
    const record: StudentAttendanceRecord = {
      id,
      teacherId: payload.teacherId,
      teacherName: payload.teacherName,
      className: payload.className,
      date: payload.date,
      createdAt: new Date().toISOString(),
      statuses: payload.statuses,
    };
    setStudentAttendanceRecords((prev) => {
      // A class is marked at most ONCE per day — by whichever teacher submits.
      // Dedup on (className, date) so the same class never shows two records
      // for the same day (previously separate teacherIds produced duplicates).
      const filtered = prev.filter(
        (item) => !(item.className === payload.className && item.date === payload.date)
      );
      return [record, ...filtered];
    });
    pushNotification({
      type: 'attendance',
      title: 'Class attendance submitted',
      message: `${payload.teacherName} marked ${payload.className} (${payload.statuses.length} students)`,
    });
  };

  useEffect(() => {
    if (!attendanceRouteToken || !teacherSession) return;
    const currentAccount = teacherAccounts.find((a) => a.id === teacherSession.accountId);
    if (!currentAccount || !validateTeacherPortalSession(teacherSession, currentAccount)) {
      window.dispatchEvent(new CustomEvent('attendance-route-result', { detail: { status: 'invalid' } }));
      setAttendanceRouteToken(null);
      return;
    }
    const result = handleAttendanceScan(teacherSession.accountId, teacherSession.fullName, attendanceRouteToken);
    if (result.status === 'invalid') {
      window.dispatchEvent(new CustomEvent('attendance-route-result', { detail: { status: 'invalid' } }));
    } else if (result.status === 'arrived' || result.status === 'departed') {
      window.dispatchEvent(new CustomEvent('attendance-route-result', { detail: { status: result.status, time: result.time } }));
    } else {
      window.dispatchEvent(new CustomEvent('attendance-route-result', { detail: { status: result.status } }));
    }
    setAttendanceRouteToken(null);
  }, [attendanceRouteToken, teacherSession]);

  const handlePaySalary = (paymentData: Omit<SalaryPayment, 'id' | 'recordedBy'>) => {
    const newPayment: SalaryPayment = {
      ...paymentData,
      id: `SP-${Date.now().toString().slice(-4)}`,
      recordedBy: adminName,
    };
    setSalaryPayments([newPayment, ...salaryPayments]);

    pushNotification({
      type: 'salary',
      title: 'Salary paid',
      message: `${paymentData.teacherStaffName} received ৳${paymentData.netPaid.toLocaleString()} (${paymentData.month} ${paymentData.year})`,
    });

    // Create a transaction in the general ledger representing this salary outlay
    const linkedTx: LedgerTransaction = {
      id: `TX-${Date.now().toString().slice(-4)}`,
      date: paymentData.date,
      type: 'Expense',
      fund: 'General',
      category: paymentData.netPaid > 10000 ? 'Teacher Salary' : 'Staff Salary',
      amount: paymentData.netPaid,
      description: `Salary paid: ${paymentData.teacherStaffName} (${paymentData.month} ${paymentData.year})`,
      recordedBy: adminName,
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
      recordedBy: adminName,
    };
    setStudentResults([newResult, ...studentResults]);
    pushNotification({
      type: 'result',
      title: 'Result published',
      message: `${resultData.studentName} (${resultData.class}) — ${resultData.examType}`,
    });
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
      recordedBy: adminName,
    };
    
    // Optimistic state updates
    const updatedLoans = [...loans, newLoan];
    setLoans(updatedLoans);

    pushNotification({
      type: 'loan',
      title: loanData.type === 'Given' ? 'Loan given' : loanData.type === 'Taken' ? 'Loan received' : 'Zakat & Lillah recorded',
      message: `${loanData.personName} · ৳${loanData.amount.toLocaleString()}`,
    });

    // Automatically log ledger transaction — Zakat & Lillah loans feed the Lillah fund.
    const linkedTx: LedgerTransaction = {
      id: `TX-${Date.now().toString().slice(-4)}`,
      date: loanData.date,
      type: loanData.type === 'Given' ? 'Expense' : 'Income',
      fund: loanData.type === 'ZakatLillah' ? 'Lillah' : 'Loan',
      category: loanData.type === 'ZakatLillah'
        ? 'Zakat & Lillah Loan (যাকাত ও লিল্লাহ ঋণ)'
        : loanData.type === 'Taken' ? 'Loan Received (ঋণ গ্রহণ)' : 'Loan Given (ঋণ প্রদান)',
      amount: loanData.amount,
      description: `${loanData.type === 'ZakatLillah' ? 'Zakat & Lillah' : loanData.type === 'Taken' ? 'Taken' : 'Given'} loan: ${loanData.personName}`,
      recordedBy: adminName,
    };
    setLedger([linkedTx, ...ledger]);
  };

  const handleRecordLoanPayment = (paymentData: Omit<LoanPayment, 'id' | 'recordedBy'>) => {
    const newPayment: LoanPayment = {
      ...paymentData,
      id: `LNP-${Date.now().toString().slice(-4)}`,
      recordedBy: adminName,
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
    const isZakatLillah = parentLoan?.type === 'ZakatLillah';
    const personName = parentLoan ? parentLoan.personName : 'Unknown';

    pushNotification({
      type: 'loan',
      title: paymentData.type === 'Repayment' ? 'Loan repayment' : 'Loan payment received',
      message: `${personName} · ৳${paymentData.amount.toLocaleString()}`,
    });

    // Log corresponding transaction in the central finance ledger.
    // Zakat & Lillah loans post to the Lillah fund so they appear in the combined fund.
    const linkedTx: LedgerTransaction = {
      id: `TX-${Date.now().toString().slice(-4)}`,
      date: paymentData.date,
      type: paymentData.type === 'Repayment' ? 'Expense' : 'Income',
      fund: isZakatLillah ? 'Lillah' : 'Loan',
      category: isZakatLillah
        ? 'Zakat & Lillah Repaid (যাকাত ও লিল্লাহ পরিশোধ)'
        : paymentData.type === 'Repayment' ? 'Loan Repaid (ঋণ পরিশোধ)' : 'Loan Repayment Recovered (ঋণ আদায়)',
      amount: paymentData.amount,
      description: `${isZakatLillah ? 'Repayment of Zakat & Lillah loan from' : paymentData.type === 'Repayment' ? 'Repayment of taken loan from' : 'Recovery of given loan to'} ${personName}`,
      recordedBy: adminName,
    };
    setLedger([linkedTx, ...ledger]);
  };

  const handleEditLoan = (editedLoan: LoanRecord) => {
    const updatedLoans = loans.map((l) => (l.id === editedLoan.id ? editedLoan : l));
    setLoans(updatedLoans);
  };

  const handleDeleteLoan = (id: string) => {
    setLoans(loans.filter(l => l.id !== id));
  };

  // ----------------------------------------------------
  // MODULE ACTION: TARGETED DATA RESET (clears both localStorage + Supabase)
  // Calling dbDelete on each key removes the entry from the in-memory cache,
  // the localStorage mirror, AND schedules a remote delete to Supabase so
  // every other device/tab sees zero immediately via Realtime.
  // ----------------------------------------------------
  const handleClearFeePayments = () => {
    // Wipe fee payments and reset the invoice counter
    dbDelete('samdani_payments');
    dbDelete('samdani_invoice_counter');
    // Reset in-memory state so the UI shows 0 right away (no reload needed)
    setPayments([]);
    setInvoiceCounter(101);
  };

  const handleClearLoanData = () => {
    // Wipe loan records and all repayment entries
    dbDelete('samdani_loans');
    dbDelete('samdani_loan_payments');
    setLoans([]);
    setLoanPayments([]);
  };

  const handleDeletePayment = (id: string) => {
    const payment = payments.find((p) => p.id === id);
    if (!payment) return;

    // Filter out payment
    const updatedPayments = payments.filter((p) => p.id !== id);
    setPayments(updatedPayments);

    // Delete central ledger entry
    const descriptionTarget = `Fees collected: ${payment.studentName} (${payment.class} - ${payment.month})`;
    const updatedLedger = ledger.filter((tx) => tx.description !== descriptionTarget);
    setLedger(updatedLedger);

    // Restore student dues to their original state
    const updatedStudents = students.map((s) => {
      if (s.id === payment.studentId) {
        return {
          ...s,
          previousDue: payment.previousDue,
          currentMonthFee: payment.currentMonthFee,
          examFee: payment.examFee,
          transport: payment.transport,
          electricity: payment.electricity,
          water: payment.water,
          waiver: payment.waiver,
          advancePaid: payment.advancePaid,
        };
      }
      return s;
    });
    setStudents(updatedStudents);
  };

  const handleDeleteHifzPayment = (id: string) => {
    const payment = hifzPayments.find((p) => p.id === id);
    if (!payment) return;

    // Filter out payment
    const updatedPayments = hifzPayments.filter((p) => p.id !== id);
    setHifzPayments(updatedPayments);

    // Delete corresponding transaction in Hifz ledger
    const descriptionTarget = `Hifz fees collected: ${payment.studentName} (${payment.class} - ${payment.month})`;
    const updatedLedger = hifzLedger.filter((tx) => tx.description !== descriptionTarget);
    setHifzLedger(updatedLedger);

    // Restore student dues
    const updatedStudents = hifzStudents.map((s) => {
      if (s.id === payment.studentId) {
        return {
          ...s,
          previousDue: payment.previousDue,
          currentMonthFee: payment.currentMonthFee,
          examFee: payment.examFee,
          transport: payment.transport,
          electricity: payment.electricity,
          water: payment.water,
          waiver: payment.waiver,
          advancePaid: payment.advancePaid,
        };
      }
      return s;
    });
    setHifzStudents(updatedStudents);
  };

  const handleClearAttendance = () => {
    dbDelete('samdani_attendance_records');
    dbDelete('samdani_student_attendance_records');
    dbDelete('samdani_attendance_qrset');
    setAttendanceRecords([]);
    setStudentAttendanceRecords([]);
    setAttendanceQRSet(null);
  };

  // ── MODULE ACTION: AI ASSISTANT (Agent mode writes) ──
  const assistantActions: AgentActions = {
    addStudent: handleAddStudent,
    editStudent: handleEditStudent,
    deleteStudent: handleDeleteStudent,
    collectPayment: handleCollectPayment,
    addLoan: handleAddLoan,
  };

  if (!dbReady) {
    return (
      <div className="min-h-screen bg-[#2c332d] flex flex-col items-center justify-center gap-4">
        <div className="animate-spin h-9 w-9 border-4 border-[#d9c5b2]/40 border-t-[#d9c5b2] rounded-full"></div>
        <p className="text-[#d9c5b2] text-xs font-semibold tracking-wide">Opening local database…</p>
      </div>
    );
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#f8f7f4] flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-[#1e2a20] border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Teacher already signed in → teacher dashboard
    if (teacherSession) {
      const currentAccount = teacherAccounts.find(a => a.id === teacherSession.accountId);
      const currentStaff = currentAccount
        ? teachersStaff.find((s) =>
            (currentAccount.email && s.email && s.email.toLowerCase() === currentAccount.email.toLowerCase()) ||
            s.name.toLowerCase() === currentAccount.fullName.toLowerCase()
          )
        : undefined;
      const teacherViewEl = teacherView === 'settings' ? (
        <TeacherSettings
          session={teacherSession}
          account={currentAccount}
          staffRecord={currentStaff}
          onBack={() => setTeacherView('dashboard')}
          onLogout={handleTeacherLogout}
          onRequestResign={handleSubmitResignation}
        />
      ) : (
        <TeacherDashboard
          session={teacherSession}
          account={currentAccount}
          staffRecord={currentStaff}
          routines={teacherRoutines}
          leaves={teacherLeaves}
          salaryPayments={salaryPayments}
          allTeachers={teacherAccounts
            .filter((a) => a.registered)
            .map((a) => ({ id: a.id, fullName: a.fullName, designation: a.designation, photoUrl: a.photoUrl, role: a.role, email: a.email }))}
          students={students}
          academicClasses={academicClasses}
          studentAttendanceRecords={studentAttendanceRecords}
          onSubmitStudentAttendance={handleSubmitStudentAttendance}
          onDeleteTeacherLeave={handleDeleteTeacherLeave}
          salaryVisible={teacherSession ? salaryVisibleTeachers.includes(teacherSession.accountId) : false}
          onToggleSalaryVisible={handleToggleSalaryVisible}
          onOpenSettings={() => setTeacherView('settings')}
          onLogout={handleTeacherLogout}
          onDeleteAccount={handleDeleteTeacherAccount}
          qrSet={attendanceQRSet}
          todayRecord={attendanceRecords.find(
            (r) => teacherSession && r.teacherId === teacherSession.accountId && r.date === todayISO()
          ) || null}
          onScan={(raw: string) => handleAttendanceScan(teacherSession.accountId, teacherSession.fullName, raw)}
        />
      );
      return (
        <>
          {teacherViewEl}
          {currentAccount && !currentAccount.photoUrl && currentAccount.status !== 'rejected' && (
            <TeacherProfileCompletion account={currentAccount} onComplete={handleUpdateTeacherAccount} />
          )}
        </>
      );
    }
    // Admin role selection (Admin vs Viewer Admin) — shown after "I am Admin"
    if (preAuthView === 'adminRole') {
      return (
        <AdminRoleSelect
          onSelectAdmin={() => setPreAuthView('adminLogin')}
          onSelectViewer={() => setPreAuthView('viewerGate')}
          onBack={() => setPreAuthView('onboarding')}
        />
      );
    }
    // Viewer Admin password gate (create first time, then unlock)
    if (preAuthView === 'viewerGate') {
      return (
        <ViewerGate
          onBack={() => setPreAuthView('adminRole')}
          onSuccess={() => { setIsAuthenticated(true); setAdminReadOnly(true); setAdminReadOnlyFlag(true); }}
        />
      );
    }
    // Admin login flow
    if (preAuthView === 'adminLogin') {
      return <LoginPage onLoginSuccess={() => { setIsAuthenticated(true); setAdminReadOnly(false); setAdminReadOnlyFlag(false); }} />;
    }
    // Teacher login / create-account flow
    if (preAuthView === 'teacherAuth') {
      return (
        <TeacherAuth
          accounts={teacherAccounts}
          onCreateAccount={handleCreateTeacherAccount}
          onLogin={handleTeacherLogin}
          onBack={() => setPreAuthView('onboarding')}
        />
      );
    }
    // Default: onboarding / welcome screen
    return (
      <Onboarding
        onSelectTeacher={() => setPreAuthView('teacherAuth')}
        onSelectAdmin={() => setPreAuthView('adminRole')}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f7f4] flex flex-col justify-between">
      
      {/* Navbar branding and controls */}
        <Navbar
          adminName={adminName}
          activeTab={activeTab}
          navigate={navigate}
          onLogout={() => { logoutAdmin(); setIsAuthenticated(false); setAdminReadOnly(false); setAdminReadOnlyFlag(false); setPreAuthView('onboarding'); setSettingsUnlocked(false); }}
          readOnly={adminReadOnly}
        />

        {adminReadOnly && (
          <div className="bg-amber-500 text-white text-[11px] font-medium text-center py-1.5 px-4 flex items-center justify-center gap-2">
            <Eye className="h-3.5 w-3.5 shrink-0" />
            <span>Viewer Admin — শুধু দেখার মোড (View-only). You can see everything, but cannot make any changes.</span>
          </div>
        )}

      {/* Main Workspace Frame */}
      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {activeTab === 'dashboard' && (
          <Dashboard
            students={students}
            ledger={ledger}
            payments={payments}
            onNavigate={(tab) => navigate(tab as AppTab)}
            openAddTransaction={() => {
              navigate('finance');
              setIsAddTxOpen(true);
            }}
            openCollectPayment={() => {
              navigate('fees');
              setIsCollectOpen(true);
            }}
            onDeletePayment={handleDeletePayment}
            readOnly={adminReadOnly}
          />
        )}

        {activeTab === 'finance' && (
          <FinanceModule
            ledger={ledger}
            onAddTransaction={handleAddTransaction}
            onDeleteTransaction={handleDeleteTransaction}
            isFormOpen={isAddTxOpen}
            setIsFormOpen={setIsAddTxOpen}
            readOnly={adminReadOnly}
          />
        )}


        {activeTab === 'fees' && (
          <FeesModule
            students={students}
            payments={payments}
            academicClasses={academicClasses}
            admins={admins}
            studentAttendanceRecords={studentAttendanceRecords}
            onAddStudent={handleAddStudent}
            onEditStudent={handleEditStudent}
            onDeleteStudent={handleDeleteStudent}
            onCollectPayment={handleCollectPayment}
            isCollectOpen={isCollectOpen}
            setIsCollectOpen={setIsCollectOpen}
            pendingCollectStudentId={pendingCollectStudentId}
            onClearPendingCollect={() => setPendingCollectStudentId(null)}
            pendingEditStudentId={pendingEditStudentId}
            onClearPendingEdit={() => setPendingEditStudentId(null)}
            onDeletePayment={handleDeletePayment}
            readOnly={adminReadOnly}
          />
        )}

        {activeTab === 'appManagement' && (
          <AppManagementPage readOnly={adminReadOnly} />
        )}

        {activeTab === 'missingFillouts' && (
          <MissingFilloutsPage
            students={students}
            academicClasses={academicClasses}
            onSaveStudent={handleEditStudent}
            onOpenEditStudent={(student) => { setPendingEditStudentId(student.id); navigate('fees'); }}
            readOnly={adminReadOnly}
          />
        )}

        {activeTab === 'salaries' && (
          <SalariesModule
            teachersStaff={teachersStaff}
            salaryPayments={salaryPayments}
            paymentMethods={paymentMethods}
            teacherAccounts={teacherAccounts}
            onUpdateTeacherProfile={handleUpdateTeacherProfile}
            teacherRoutines={teacherRoutines}
            onDeleteTeacherStaff={handleDeleteTeacherStaff}
            onPaySalary={handlePaySalary}
            onDeleteSalaryPayment={handleDeleteSalaryPayment}
            onRegisterTeacherAccount={handleRegisterTeacherAccount}
            onRejectTeacherAccount={handleRejectTeacherAccount}
            onAddTeacherRoutine={handleAddTeacherRoutine}
            onDeleteTeacherRoutine={handleDeleteTeacherRoutine}
            teacherLeaves={teacherLeaves}
            onAddTeacherLeave={handleAddTeacherLeave}
            onDeleteTeacherLeave={handleDeleteTeacherLeave}
            onAdminDeleteTeacher={handleAdminDeleteTeacher}
            attendanceQRSet={attendanceQRSet}
            attendanceRecords={attendanceRecords}
            readOnly={adminReadOnly}
          />
        )}

        {activeTab === 'results' && (
          <ResultsModule
            students={students}
            results={studentResults}
            academicClasses={academicClasses}
            onAddResult={handleAddResult}
            onDeleteResult={handleDeleteResult}
            readOnly={adminReadOnly}
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
            onEditLoan={handleEditLoan}
            readOnly={adminReadOnly}
          />
        )}

        {activeTab === 'settings' && (
          adminReadOnly ? (
            <SettingsPage
              academicClasses={academicClasses}
              onUpdateAcademicClasses={setAcademicClasses}
              paymentMethods={paymentMethods}
              onUpdatePaymentMethods={setPaymentMethods}
              admins={admins}
              onUpdateAdmins={setAdmins}
              attendanceQRSet={attendanceQRSet}
              attendanceRecords={attendanceRecords}
              onGenerateAttendanceQRSet={handleGenerateAttendanceQRSet}
              onDeleteAttendanceQRSet={handleDeleteAttendanceQRSet}
              onClearFeePayments={handleClearFeePayments}
              onClearLoanData={handleClearLoanData}
              onClearAttendance={handleClearAttendance}
              readOnly={adminReadOnly}
            />
          ) : (
            settingsUnlocked ? (
              <SettingsPage
                academicClasses={academicClasses}
                onUpdateAcademicClasses={setAcademicClasses}
                paymentMethods={paymentMethods}
                onUpdatePaymentMethods={setPaymentMethods}
                admins={admins}
                onUpdateAdmins={setAdmins}
                attendanceQRSet={attendanceQRSet}
                attendanceRecords={attendanceRecords}
                onGenerateAttendanceQRSet={handleGenerateAttendanceQRSet}
                onDeleteAttendanceQRSet={handleDeleteAttendanceQRSet}
                onClearFeePayments={handleClearFeePayments}
                onClearLoanData={handleClearLoanData}
                onClearAttendance={handleClearAttendance}
                readOnly={adminReadOnly}
              />
            ) : (
              <SettingsGate onUnlocked={() => setSettingsUnlocked(true)} />
            )
          )
        )}

        {activeTab === 'pending' && (
          <PendingOperations
            resignations={teacherResignations}
            onResolve={handleResolveResignation}
            readOnly={adminReadOnly}
          />
        )}

        {activeTab === 'closing' && (
          <ClosingModule
            ledger={ledger}
          />
        )}

        {activeTab === 'hifz' && (
          <HifzModule
            students={hifzStudents}
            payments={hifzPayments}
            academicClasses={hifzAcademicClasses}
            admins={admins}
            onAddStudent={handleAddHifzStudent}
            onEditStudent={handleEditHifzStudent}
            onDeleteStudent={handleDeleteHifzStudent}
            onCollectPayment={handleCollectHifzPayment}
            isCollectOpen={isHifzCollectOpen}
            setIsCollectOpen={setIsHifzCollectOpen}
            ledger={hifzLedger}
            onAddTransaction={handleAddHifzTransaction}
            onDeletePayment={handleDeleteHifzPayment}
            readOnly={adminReadOnly}
          />
        )}

        {activeTab === 'summary' && (
          <StudentSummaryModule
            students={students}
            results={studentResults}
            onEditStudent={handleEditStudentFromSummary}
            onPayFees={handlePayStudentFees}
            readOnly={adminReadOnly}
          />
        )}

        {activeTab === 'assistant' && (
          <AssistantModule
            actions={assistantActions}
            readOnly={adminReadOnly}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-stone-200/60 py-4 text-center text-[10px] text-stone-400">
        <p>© {new Date().getFullYear()} Samdania Talimul Islam Madrasah</p>
      </footer>

    </div>
  );
}
