import React, { useState, useEffect, useCallback } from 'react';
import { Eye } from 'lucide-react';
import {
  LedgerTransaction, 
  Student, 
  FeePayment, 
  TeacherStaff,
  SalaryPayment,
  MONTHS,
  StudentResult,
  LoanRecord,
  LoanPayment,
  DEFAULT_ACADEMIC_CLASSES,
  TeacherAccount,
  TeacherRoutine,
  TeacherLeave,
  AttendanceQRSet,
  AttendanceRecord,
  AttendancePolicy,
  TeacherPortalSession,
  StaffAccount,
  StaffPortalSession,
  StudentAttendanceRecord,
  StudentAttendanceStatus,
  TeacherResignationRequest
} from './types';
import { initDatabase, dbGet, dbSet, dbDelete, dbRefreshKey, dbExportAll, onDbChange } from './lib/localDb';
import { DatabaseOfflineScreen, DatabaseStatusBanner, isDbUnavailable, useDbStatus } from './components/DatabaseStatus';
import { pushNotification } from './lib/notifications';
import { getSession, logoutAdmin, setAdminReadOnlyFlag, getAdminReadOnlyFlag, ensureAdminCredentials } from './lib/auth';
import { verifyScanned, generateQRSet, todayISO, classifyArrival, formatAttendanceTime, type AttendanceScanResult } from './lib/attendance';
import { clearTeacherPortalSession, createTeacherPortalSession, persistTeacherPortalSession, validateTeacherPortalSession, loadTeacherPortalSession } from './lib/teacherSessions';
import { clearStaffPortalSession, createStaffPortalSession, persistStaffPortalSession, validateStaffPortalSession, loadStaffPortalSession } from './lib/staffSessions';
import { getSalaryBalance } from './lib/salary';

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
import StaffAuth from './components/StaffAuth';
import StaffDashboard from './components/StaffDashboard';
import TeacherDashboard from './components/TeacherDashboard';
import TeacherSettings from './components/TeacherSettings';
import TeacherProfileCompletion from './components/TeacherProfileCompletion';
import AttendanceSection from './components/AttendanceSection';
import QrGenerateSection from './components/QrGenerateSection';
import AttendanceReportTab from './components/AttendanceReportTab';
import PendingOperations from './components/PendingOperations';
import AssistantModule from './components/AssistantModule';
import MainMadrasahPage from './components/MainMadrasahPage';
import AppManagementPage from './components/AppManagementPage';
import MissingFilloutsPage from './components/MissingFilloutsPage';
import StudentPromotionModule from './components/StudentPromotionModule';
import AppDownloadQrPage from './components/AppDownloadQrPage';
import { tabToPath, pathToTab, type AppTab } from './lib/routes';
import type { AgentActions } from './lib/aiTools';
import { isStudentActive } from './lib/studentEnrollment';

function accountIsNonTeachingStaff(account: TeacherAccount): boolean {
  const roleDescription = `${account.role || ''} ${account.designation || ''}`.toLowerCase();
  return /\b(staff|driver|cleaner|guard|security|accountant|cook|caretaker|peon|janitor|maintenance|office)\b/.test(roleDescription);
}

function AppLoadingSkeleton() {
  return (
    <div className="app-loading-skeleton min-h-screen bg-[#f8f7f4]" role="status" aria-label="Loading school software" aria-busy="true">
      <span className="sr-only">Loading school software…</span>
      <header className="h-16 border-b border-stone-200 bg-white px-4 sm:px-7 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-stone-200 animate-pulse" />
          <div className="space-y-2">
            <div className="h-3 w-36 sm:w-48 rounded bg-stone-200 animate-pulse" />
            <div className="h-2 w-24 rounded bg-stone-100 animate-pulse" />
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-3">
          <div className="h-8 w-24 rounded-lg bg-stone-100 animate-pulse" />
          <div className="h-8 w-8 rounded-full bg-stone-200 animate-pulse" />
        </div>
      </header>
      <div className="mx-auto flex max-w-[1600px]">
        <aside className="hidden w-60 shrink-0 border-r border-stone-200 bg-white p-5 lg:block" aria-hidden="true">
          <div className="mb-6 h-2 w-20 rounded bg-stone-100 animate-pulse" />
          <div className="space-y-3">
            {Array.from({ length: 8 }, (_, index) => (
              <div key={index} className="flex items-center gap-3 rounded-lg px-2 py-2">
                <div className="h-4 w-4 rounded bg-stone-200 animate-pulse" />
                <div className="h-3 rounded bg-stone-100 animate-pulse" style={{ width: `${96 + (index % 3) * 18}px` }} />
              </div>
            ))}
          </div>
        </aside>
        <main className="min-w-0 flex-1 p-4 sm:p-7 lg:p-9" aria-hidden="true">
          <div className="mb-7 space-y-3">
            <div className="h-6 w-48 rounded bg-stone-200 animate-pulse" />
            <div className="h-3 w-64 max-w-full rounded bg-stone-100 animate-pulse" />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-5">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="h-24 rounded-xl border border-stone-200 bg-white p-4 sm:h-28">
                <div className="h-3 w-20 rounded bg-stone-100 animate-pulse" />
                <div className="mt-5 h-6 w-24 max-w-full rounded bg-stone-200 animate-pulse" />
              </div>
            ))}
          </div>
          <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(240px,1fr)]">
            <div className="h-64 rounded-xl border border-stone-200 bg-white p-5 sm:h-80">
              <div className="h-4 w-36 rounded bg-stone-100 animate-pulse" />
              <div className="mt-8 h-48 rounded-lg bg-stone-50 animate-pulse sm:h-64" />
            </div>
            <div className="h-64 rounded-xl border border-stone-200 bg-white p-5 sm:h-80">
              <div className="h-4 w-32 rounded bg-stone-100 animate-pulse" />
              <div className="mt-6 space-y-4">
                {Array.from({ length: 5 }, (_, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-stone-100 animate-pulse" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-3/4 rounded bg-stone-100 animate-pulse" />
                      <div className="h-2 w-1/2 rounded bg-stone-50 animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function SchoolApp() {
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

  // ── DATABASE (Supabase kv_store) ──
  // The app only opens once the real data has been loaded. If loading fails, a
  // "cannot reach the database" screen is shown and loading is retried automatically —
  // never an empty app that could later overwrite the stored records.
  const dbStatus = useDbStatus();
  useEffect(() => { void initDatabase(); }, []);
  const dbReady = dbStatus.state === 'online' || dbStatus.state === 'unconfigured';

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
  const [staffAccounts, setStaffAccounts] = useState<StaffAccount[]>([]);
  const [teacherRoutines, setTeacherRoutines] = useState<TeacherRoutine[]>([]);
  // Teacher leave records (ছুটি) — managed by admin, viewed by teacher
  const [teacherLeaves, setTeacherLeaves] = useState<TeacherLeave[]>([]);
  // Teacher resignation requests (pending school exit)
  const [teacherResignations, setTeacherResignations] = useState<TeacherResignationRequest[]>([]);
  // ── TEACHER ATTENDANCE (উপস্থিতি): 12-day QR set + per-day records ──
  const [attendanceQRSet, setAttendanceQRSet] = useState<AttendanceQRSet | null>(null);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [attendancePolicy, setAttendancePolicy] = useState<AttendancePolicy>({ expectedArrivalTime: '09:00' });
  const [studentAttendanceRecords, setStudentAttendanceRecords] = useState<StudentAttendanceRecord[]>([]);
  // Per-teacher salary-reveal preference (persisted so it survives refresh)
  const [salaryVisibleTeachers, setSalaryVisibleTeachers] = useState<string[]>([]);
  const [teacherSession, setTeacherSession] = useState<TeacherPortalSession | null>(null);
  const [staffSession, setStaffSession] = useState<StaffPortalSession | null>(null);
  const [preAuthView, setPreAuthView] = useState<'onboarding' | 'adminRole' | 'adminLogin' | 'viewerGate' | 'teacherAuth' | 'staffAuth'>('onboarding');
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
    const savedStaffAccounts = load<StaffAccount[]>('samdani_staff_accounts', []);
    const salaryRoster = load<TeacherStaff[]>('samdani_teachers_staff', []);
    setStaffAccounts(savedStaffAccounts.map((account) => ({
      ...account,
      status: account.status || (salaryRoster.some((staff) => staff.role === 'Staff' && staff.email.toLowerCase() === account.email.toLowerCase()) ? 'approved' : 'pending'),
    })));
    setTeacherRoutines(load('samdani_teacher_routines', []));
    setTeacherLeaves(load('samdani_teacher_leaves', []));
    setTeacherResignations(load('samdani_teacher_resignations', []));
    setSalaryVisibleTeachers(load('samdani_salary_visible', []));
    setAttendanceQRSet(load<AttendanceQRSet | null>('samdani_attendance_qrset', null));
    setAttendanceRecords(load('samdani_attendance_records', []));
    setAttendancePolicy(load<AttendancePolicy>(
      'samdani_attendance_policy',
      { expectedArrivalTime: '09:00' },
      (value) => typeof value?.expectedArrivalTime === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value.expectedArrivalTime)
        ? value
        : { expectedArrivalTime: '09:00' },
    ));
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
  useEffect(() => { if (canPersist) dbSet('samdani_staff_accounts', staffAccounts); }, [staffAccounts, canPersist]);
  useEffect(() => { if (canPersist) dbSet('samdani_teacher_routines', teacherRoutines); }, [teacherRoutines, canPersist]);
  useEffect(() => { if (canPersist) dbSet('samdani_teacher_leaves', teacherLeaves); }, [teacherLeaves, canPersist]);
  useEffect(() => { if (canPersist) dbSet('samdani_teacher_resignations', teacherResignations); }, [teacherResignations, canPersist]);
  useEffect(() => { if (canPersist) dbSet('samdani_salary_visible', salaryVisibleTeachers); }, [salaryVisibleTeachers, canPersist]);
  useEffect(() => { if (canPersist) dbSet('samdani_attendance_qrset', attendanceQRSet); }, [attendanceQRSet, canPersist]);
  useEffect(() => { if (canPersist) dbSet('samdani_attendance_records', attendanceRecords); }, [attendanceRecords, canPersist]);
  useEffect(() => { if (canPersist) dbSet('samdani_attendance_policy', attendancePolicy); }, [attendancePolicy, canPersist]);
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

  useEffect(() => {
    if (!dbReady || !dbHydrated || !staffSession) return;
    const account = staffAccounts.find((item) => item.id === staffSession.accountId);
    if (account && validateStaffPortalSession(staffSession, account)) return;
    setStaffSession(null);
    clearStaffPortalSession();
  }, [dbReady, dbHydrated, staffAccounts, staffSession]);

  useEffect(() => {
    if (!dbReady || !dbHydrated || !teacherSession) return;
    const account = teacherAccounts.find((item) => item.id === teacherSession.accountId);
    if (!account || !accountIsNonTeachingStaff(account)) return;

    const matchingStaff = staffAccounts.find((item) => item.email.toLowerCase() === account.email.toLowerCase());
    const migrated: StaffAccount = matchingStaff || {
      id: account.id,
      fullName: account.fullName,
      role: account.role || account.designation || 'Staff',
      email: account.email,
      password: account.password,
      phone: account.contact || '',
      bio: account.bio || '',
      contactInfo: '',
      photoUrl: account.photoUrl,
      createdAt: account.createdAt,
      status: account.registered && account.status === 'verified' ? 'approved' : 'pending',
    };
    setStaffAccounts((previous) => previous.some((item) => item.email.toLowerCase() === migrated.email.toLowerCase())
      ? previous.map((item) => item.email.toLowerCase() === migrated.email.toLowerCase() ? migrated : item)
      : [...previous, migrated]);
    setTeachersStaff((previous) => previous.map((item) => item.email.toLowerCase() === account.email.toLowerCase()
      ? { ...item, role: 'Staff', designation: migrated.role, name: migrated.fullName, contact: migrated.phone, bio: migrated.bio }
      : item));
    setTeacherLeaves((previous) => previous.map((leave) => leave.teacherId === account.id
      ? { ...leave, teacherId: migrated.id }
      : leave));
    setAttendanceRecords((previous) => previous.map((record) => record.teacherId === account.id
      ? { ...record, id: `${migrated.id}_${record.date}`, teacherId: migrated.id, teacherName: migrated.fullName }
      : record));
    setTeacherRoutines((previous) => previous.filter((routine) => routine.teacherId !== account.id));
    setTeacherAccounts((previous) => previous.filter((item) => item.id !== account.id));
    clearTeacherPortalSession();
    setTeacherSession(null);
    const nextSession = createStaffPortalSession(migrated);
    setStaffSession(nextSession);
    persistStaffPortalSession(nextSession);
  }, [dbReady, dbHydrated, teacherAccounts, teacherSession, staffAccounts]);

  const [staffRestored, setStaffRestored] = useState(false);
  useEffect(() => {
    if (!dbReady || !dbHydrated || staffRestored) return;
    setStaffRestored(true);
    const restored = loadStaffPortalSession();
    if (restored) setStaffSession(restored);
  }, [dbReady, dbHydrated, staffRestored]);

  useEffect(() => {
    if (dbReady && staffSession) persistStaffPortalSession(staffSession);
  }, [staffSession, dbReady]);

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

  // Check for existing admin session on mount.
  useEffect(() => {
    const session = getSession();
    if (session) {
      setIsAuthenticated(true);
      setAdminReadOnly(getAdminReadOnlyFlag());
    }
  }, []);
  useEffect(() => { setAuthLoading(false); }, []);

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

  const handleStudentPromotion = (updatedStudents: Student[]) => {
    const changedCount = updatedStudents.filter((student) =>
      students.find((current) => current.id === student.id)?.academicSession !== student.academicSession
    ).length;
    setStudents(updatedStudents);
    pushNotification({
      type: 'student',
      title: 'Student session transition completed',
      message: `${changedCount} student record(s) updated for the next academic session`,
    });
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
    clearStaffPortalSession();
    setStaffSession(null);
    const portalSession = createTeacherPortalSession(account);
    setTeacherSession(portalSession);
  };

  const handleTeacherLogout = () => {
    clearTeacherPortalSession();
    setTeacherSession(null);
    setTeacherView('dashboard');
    setPreAuthView('onboarding');
  };

  const handleCreateStaffAccount = (account: StaffAccount) => {
    const next = [...staffAccounts, account];
    setStaffAccounts(next);
    dbSet('samdani_staff_accounts', next);
  };

  const handleStaffLogin = (session: StaffPortalSession) => {
    const accountsFromDb: StaffAccount[] = dbGet('samdani_staff_accounts') ?? [];
    const account = staffAccounts.find((item) => item.id === session.accountId) ??
      accountsFromDb.find((item) => item.id === session.accountId);
    if (!account) {
      alert('This staff account could not be found. Please try again.');
      return;
    }
    clearTeacherPortalSession();
    setTeacherSession(null);
    const portalSession = createStaffPortalSession(account);
    setStaffSession(portalSession);
    persistStaffPortalSession(portalSession);
  };

  const handleStaffLogout = () => {
    clearStaffPortalSession();
    setStaffSession(null);
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
      joinedAt: new Date().toISOString(),
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

  const handleRegisterStaffAccount = (accountId: string, monthlySalary: number) => {
    if (!Number.isFinite(monthlySalary) || monthlySalary <= 0) {
      alert('Enter a valid monthly salary greater than zero.');
      return;
    }
    const account = staffAccounts.find((item) => item.id === accountId);
    if (!account) {
      alert('Unable to verify staff account. Please reload and try again.');
      return;
    }
    const existing = teachersStaff.find((item) =>
      item.role === 'Staff' && item.email.toLowerCase() === account.email.toLowerCase()
    );
    if (existing) {
      setStaffAccounts((previous) => previous.map((item) => item.id === account.id ? { ...item, status: 'approved' } : item));
      alert(`${account.fullName} has been approved for the staff portal.`);
      return;
    }
    const rosterEntry: TeacherStaff = {
      id: `STF-${Date.now().toString(36).toUpperCase()}`,
      name: account.fullName,
      role: 'Staff',
      designation: account.role,
      baseSalary: monthlySalary,
      contact: account.phone,
      email: account.email,
      bio: account.bio,
      joinedAt: account.createdAt,
    };
    setTeachersStaff((previous) => [...previous, rosterEntry]);
    setStaffAccounts((previous) => previous.map((item) => item.id === account.id ? { ...item, status: 'approved' } : item));
    alert(`${account.fullName} has been linked to the staff salary roster.`);
  };

  const handleApproveStaffAccount = (accountId: string) => {
    const account = staffAccounts.find((item) => item.id === accountId);
    if (!account) {
      alert('Unable to find this staff account. Please refresh and try again.');
      return;
    }
    setStaffAccounts((previous) => previous.map((item) =>
      item.id === accountId ? { ...item, status: 'approved' } : item
    ));
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

  const handleUpdateTeacherProfile = (accountId: string, patch: { fullName: string; designation: string; contact: string; email: string; bio: string; photoUrl?: string; baseSalary: number; salaryDue: number }) => {
    const account = teacherAccounts.find((item) => item.id === accountId);
    setTeacherAccounts((prev) => prev.map((item) => item.id === accountId ? {
      ...item,
      fullName: patch.fullName,
      designation: patch.designation,
      contact: patch.contact,
      email: patch.email,
      bio: patch.bio,
      photoUrl: patch.photoUrl,
    } : item));
    if (account) {
      setTeachersStaff((prev) => prev.map((staff) => {
        if (staff.email.toLowerCase() !== account.email.toLowerCase() && staff.name.toLowerCase() !== account.fullName.toLowerCase()) {
          return staff;
        }
        const updatedSalary = { ...staff, baseSalary: patch.baseSalary, salaryDueAdjustment: 0 };
        const now = new Date();
        const currentBalance = getSalaryBalance(
          updatedSalary,
          salaryPayments,
          MONTHS[now.getMonth()],
          now.getFullYear(),
          account.createdAt,
        );
        return {
          ...staff,
          name: patch.fullName,
          designation: patch.designation,
          contact: patch.contact,
          email: patch.email,
          bio: patch.bio,
          baseSalary: patch.baseSalary,
          salaryDueAdjustment: patch.salaryDue - currentBalance.balanceBeforeClamp,
        };
      }));
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

  // Teacher leave (ছুটি) handlers. Teachers may request leave; only admins
  // can approve, deny, or remove a leave.
  const handleAddTeacherLeave = (entry: Omit<TeacherLeave, 'id'>) => {
    const newLeave: TeacherLeave = {
      ...entry,
      id: `TL-${Date.now().toString().slice(-5)}-${Math.floor(Math.random() * 900 + 100)}`,
    };
    setTeacherLeaves((prev) => [...prev, newLeave]);
    const leaveTeacher =
      teachersStaff.find((s) => s.id === entry.teacherId) ||
      teacherAccounts.find((a) => a.id === entry.teacherId) ||
      staffAccounts.find((a) => a.id === entry.teacherId);
    const leaveName = leaveTeacher
      ? ('name' in leaveTeacher ? leaveTeacher.name : leaveTeacher.fullName)
      : 'A teacher';
    pushNotification({
      type: 'leave',
      title: entry.status === 'pending' ? 'Leave requested' : 'Leave scheduled',
      message: `${leaveName} ${entry.status === 'pending' ? 'requested' : 'was scheduled for'} leave (${entry.startDate} → ${entry.endDate})`,
    });
  };

  const handleDeleteTeacherLeave = (id: string) => {
    setTeacherLeaves((prev) => prev.filter((l) => l.id !== id));
  };

  const handleRefreshTeacherLeaves = useCallback(async () => {
    await dbRefreshKey('samdani_teacher_leaves');
    syncFromDb();
  }, [syncFromDb]);

  const handleDecideTeacherLeave = (id: string, status: 'approved' | 'denied', adminNote?: string) => {
    const leave = teacherLeaves.find((item) => item.id === id);
    const teacher = leave
      ? teacherAccounts.find((account) => account.id === leave.teacherId)
      : undefined;
    const staff = leave
      ? staffAccounts.find((account) => account.id === leave.teacherId)
      : undefined;
    setTeacherLeaves((prev) => prev.map((leave) => (
      leave.id === id
        ? { ...leave, status, adminNote: adminNote?.trim() || undefined, decidedAt: new Date().toISOString() }
        : leave
    )));
    if (leave) {
      pushNotification({
        type: 'leave',
        title: `Leave ${status}`,
        message: `${teacher?.fullName || staff?.fullName || 'Staff member'}'s leave request was ${status}.`,
      });
    }
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
    const today = todayISO();
    const activeLeave = teacherLeaves.find((leave) =>
      leave.teacherId === teacherId &&
      (leave.status === undefined || leave.status === 'approved') &&
      leave.startDate <= today &&
      today <= leave.endDate
    );
    if (activeLeave) return { status: 'onleave' };

    const v = verifyScanned(attendanceQRSet, raw);
    if (!v.ok) return { status: 'invalid' };
    if (v.date !== today) return { status: 'wrongday', qrDate: v.date };

    const id = `${teacherId}_${today}`;
    const existing = attendanceRecords.find((r) => r.id === id);
    const nowDate = new Date();
    const now = nowDate.toISOString();
    const arrivalStatus = classifyArrival(nowDate, attendancePolicy.expectedArrivalTime);

    if (!existing) {
      const rec: AttendanceRecord = { id, teacherId, teacherName, date: today, entryTime: now, exitTime: null, arrivalStatus };
      setAttendanceRecords((prev) => [rec, ...prev]);
      pushNotification({
        type: 'attendance',
        title: 'Teacher arrived',
        message: `${teacherName} marked attendance ${arrivalStatus === 'late' ? 'late' : arrivalStatus === 'early' ? 'early' : 'on time'} at ${formatAttendanceTime(nowDate)}`,
      });
      return { status: 'arrived', time: now, arrivalStatus };
    }
    if (!existing.entryTime) {
      const updated = { ...existing, entryTime: now, arrivalStatus };
      setAttendanceRecords((prev) => prev.map((r) => (r.id === id ? updated : r)));
      pushNotification({
        type: 'attendance',
        title: 'Teacher arrived',
        message: `${teacherName} marked attendance ${arrivalStatus === 'late' ? 'late' : arrivalStatus === 'early' ? 'early' : 'on time'} at ${formatAttendanceTime(nowDate)}`,
      });
      return { status: 'arrived', time: now, arrivalStatus };
    }
    if (!existing.exitTime) {
      const updated = { ...existing, exitTime: now };
      setAttendanceRecords((prev) => prev.map((r) => (r.id === id ? updated : r)));
      pushNotification({
        type: 'attendance',
        title: 'Teacher departed',
        message: `${teacherName} left at ${formatAttendanceTime(nowDate)}`,
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
      window.dispatchEvent(new CustomEvent('attendance-route-result', {
        detail: {
          status: result.status,
          time: result.time,
          arrivalStatus: result.status === 'arrived' ? result.arrivalStatus : undefined,
        },
      }));
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

  if (isDbUnavailable(dbStatus)) return <DatabaseOfflineScreen status={dbStatus} />;
  if (!dbReady || authLoading) return <AppLoadingSkeleton />;

  if (!isAuthenticated) {
    // Teacher already signed in → teacher dashboard
    if (teacherSession) {
      const currentAccount = teacherAccounts.find(a => a.id === teacherSession.accountId);
      if (currentAccount && accountIsNonTeachingStaff(currentAccount)) {
        return <div className="min-h-screen flex items-center justify-center bg-[#f8f7f4] text-sm font-semibold text-stone-600">Opening Staff Portal… (স্টাফ পোর্টাল খোলা হচ্ছে)</div>;
      }
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
          attendanceRecords={attendanceRecords.filter((record) => record.teacherId === teacherSession.accountId)}
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
            .filter((a) => a.registered && !accountIsNonTeachingStaff(a))
            .map((a) => ({ id: a.id, fullName: a.fullName, designation: a.designation, photoUrl: a.photoUrl, role: a.role, email: a.email }))}
          students={students.filter(isStudentActive)}
          academicClasses={academicClasses}
          studentAttendanceRecords={studentAttendanceRecords}
          onSubmitStudentAttendance={handleSubmitStudentAttendance}
          onRequestTeacherLeave={handleAddTeacherLeave}
          salaryVisible={teacherSession ? salaryVisibleTeachers.includes(teacherSession.accountId) : false}
          onToggleSalaryVisible={handleToggleSalaryVisible}
          onOpenSettings={() => setTeacherView('settings')}
          onLogout={handleTeacherLogout}
          onDeleteAccount={handleDeleteTeacherAccount}
          qrSet={attendanceQRSet}
          todayRecord={attendanceRecords.find(
            (r) => teacherSession && r.teacherId === teacherSession.accountId && r.date === todayISO()
          ) || null}
          attendanceRecords={attendanceRecords.filter((record) => record.teacherId === teacherSession.accountId)}
          onScan={(raw: string) => handleAttendanceScan(teacherSession.accountId, teacherSession.fullName, raw)}
        />
      );
      return (
        <>
          {teacherViewEl}
          {currentAccount && !currentAccount.role && currentAccount.status !== 'rejected' && (
            <TeacherProfileCompletion account={currentAccount} onComplete={handleUpdateTeacherAccount} />
          )}
        </>
      );
    }
    if (staffSession) {
      const currentStaffAccount = staffAccounts.find((account) => account.id === staffSession.accountId);
      if (currentStaffAccount) {
        const staffRecord = teachersStaff.find((staff) =>
          staff.role === 'Staff' && staff.email.toLowerCase() === currentStaffAccount.email.toLowerCase()
        );
        return (
          <StaffDashboard
            account={currentStaffAccount}
            staffRecord={staffRecord}
            salaryPayments={salaryPayments}
            leaves={teacherLeaves}
            qrSet={attendanceQRSet}
            attendanceRecords={attendanceRecords}
            onScan={(raw) => handleAttendanceScan(currentStaffAccount.id, currentStaffAccount.fullName, raw)}
            onRequestLeave={handleAddTeacherLeave}
            onLogout={handleStaffLogout}
          />
        );
      }
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
    if (preAuthView === 'staffAuth') {
      return (
        <StaffAuth
          accounts={staffAccounts}
          onCreateAccount={handleCreateStaffAccount}
          onLogin={handleStaffLogin}
          onBack={() => setPreAuthView('onboarding')}
        />
      );
    }
    // Default: onboarding / welcome screen
    return (
      <Onboarding
        onSelectTeacher={() => setPreAuthView('teacherAuth')}
        onSelectStaff={() => setPreAuthView('staffAuth')}
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
            students={students.filter(isStudentActive)}
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
            students={students.filter(isStudentActive)}
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

        {activeTab === 'promotion' && (
          <StudentPromotionModule
            students={students}
            academicClasses={academicClasses}
            backupData={dbExportAll()}
            onPromote={handleStudentPromotion}
            readOnly={adminReadOnly}
          />
        )}

        {activeTab === 'appManagement' && (
          <AppManagementPage
            readOnly={adminReadOnly}
            teacherAccounts={teacherAccounts}
            staffAccounts={staffAccounts}
            students={students.filter(isStudentActive)}
            adminName={adminName}
          />
        )}

        {activeTab === 'mainMadrasah' && (
          <MainMadrasahPage readOnly={adminReadOnly} teacherAccounts={teacherAccounts} />
        )}

        {activeTab === 'appQr' && <AppDownloadQrPage />}

        {activeTab === 'missingFillouts' && (
          <MissingFilloutsPage
            students={students.filter(isStudentActive)}
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
            staffAccounts={staffAccounts}
            onUpdateTeacherProfile={handleUpdateTeacherProfile}
            teacherRoutines={teacherRoutines}
            onDeleteTeacherStaff={handleDeleteTeacherStaff}
            onPaySalary={handlePaySalary}
            onDeleteSalaryPayment={handleDeleteSalaryPayment}
            onRegisterTeacherAccount={handleRegisterTeacherAccount}
            onRegisterStaffAccount={handleRegisterStaffAccount}
            onRejectTeacherAccount={handleRejectTeacherAccount}
            onAddTeacherRoutine={handleAddTeacherRoutine}
            onDeleteTeacherRoutine={handleDeleteTeacherRoutine}
            teacherLeaves={teacherLeaves}
            onAddTeacherLeave={handleAddTeacherLeave}
            onDeleteTeacherLeave={handleDeleteTeacherLeave}
            onDecideTeacherLeave={handleDecideTeacherLeave}
            onRefreshTeacherLeaves={handleRefreshTeacherLeaves}
            onAdminDeleteTeacher={handleAdminDeleteTeacher}
            attendanceQRSet={attendanceQRSet}
            attendanceRecords={attendanceRecords}
            readOnly={adminReadOnly}
          />
        )}

        {activeTab === 'staffManagement' && (
          <SalariesModule
            teachersStaff={teachersStaff}
            salaryPayments={salaryPayments}
            paymentMethods={paymentMethods}
            teacherAccounts={teacherAccounts}
            staffAccounts={staffAccounts}
            onUpdateTeacherProfile={handleUpdateTeacherProfile}
            teacherRoutines={teacherRoutines}
            onDeleteTeacherStaff={handleDeleteTeacherStaff}
            onPaySalary={handlePaySalary}
            onDeleteSalaryPayment={handleDeleteSalaryPayment}
            onRegisterTeacherAccount={handleRegisterTeacherAccount}
            onRegisterStaffAccount={handleRegisterStaffAccount}
            onRejectTeacherAccount={handleRejectTeacherAccount}
            onAddTeacherRoutine={handleAddTeacherRoutine}
            onDeleteTeacherRoutine={handleDeleteTeacherRoutine}
            teacherLeaves={teacherLeaves}
            onAddTeacherLeave={handleAddTeacherLeave}
            onDeleteTeacherLeave={handleDeleteTeacherLeave}
            onDecideTeacherLeave={handleDecideTeacherLeave}
            onRefreshTeacherLeaves={handleRefreshTeacherLeaves}
            onAdminDeleteTeacher={handleAdminDeleteTeacher}
            attendanceQRSet={attendanceQRSet}
            attendanceRecords={attendanceRecords}
            onApproveStaffAccount={handleApproveStaffAccount}
            staffOnly
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
              attendancePolicy={attendancePolicy}
              onUpdateAttendancePolicy={setAttendancePolicy}
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
                attendancePolicy={attendancePolicy}
                onUpdateAttendancePolicy={setAttendancePolicy}
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
            students={students.filter(isStudentActive)}
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

export default function App() {
  return (
    <>
      <DatabaseStatusBanner />
      <SchoolApp />
    </>
  );
}
