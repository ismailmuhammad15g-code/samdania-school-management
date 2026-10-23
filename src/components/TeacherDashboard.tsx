import React, { useMemo, useState, useEffect } from 'react';
import logo2 from '../assets/images/logo2.png';
import { LogOut, BadgeCheck, DollarSign, Clock, Settings, CalendarClock, Eye, EyeOff, CalendarOff, X, XCircle, Users, Search, Lock, CheckCircle2, ChevronDown, Send } from 'lucide-react';
import { TeacherAccount, TeacherPortalSession, TeacherStaff, TeacherRoutine, TeacherLeave, SalaryPayment, MONTHS, AttendanceQRSet, AttendanceRecord, Student, StudentAttendanceRecord, StudentAttendanceStatus } from '../types';
import type { AttendanceScanResult } from '../lib/attendance';
import { TeacherAvatar, PhotoLightbox } from './TeacherPhoto';
import AttendanceSection from './AttendanceSection';
import NotificationBell from './NotificationBell';
import TeacherNoticeboard from './TeacherNoticeboard';
import { isClassMatch } from '../lib/digitUtils';

interface TeacherDashboardProps {
  session: TeacherPortalSession;
  account?: TeacherAccount;
  staffRecord?: TeacherStaff;
  routines: TeacherRoutine[];
  leaves: TeacherLeave[];
  salaryPayments: SalaryPayment[];
  allTeachers: { id: string; fullName: string; designation: string; photoUrl?: string; role?: string; email: string }[];
  onRequestTeacherLeave: (entry: Omit<TeacherLeave, 'id'>) => void;
  salaryVisible: boolean;
  onToggleSalaryVisible: (teacherId: string) => void;
  onOpenSettings: () => void;
  onLogout: () => void;
  onDeleteAccount: (id: string) => void;
  qrSet: AttendanceQRSet | null;
  todayRecord: AttendanceRecord | null;
  onScan: (raw: string) => AttendanceScanResult;
  students: Student[];
  academicClasses: string[];
  studentAttendanceRecords: StudentAttendanceRecord[];
  onSubmitStudentAttendance: (payload: { teacherId: string; teacherName: string; className: string; date: string; statuses: StudentAttendanceStatus[] }) => void;
}

export default function TeacherDashboard({ session, account, staffRecord, routines, leaves, salaryPayments, allTeachers, onRequestTeacherLeave, salaryVisible, onToggleSalaryVisible, onOpenSettings, onLogout, onDeleteAccount, qrSet, todayRecord, onScan, students, academicClasses, studentAttendanceRecords, onSubmitStudentAttendance }: TeacherDashboardProps) {
  const initial = (account?.fullName || session.fullName || 'T').trim().charAt(0).toUpperCase();
  const myRoutines = routines.filter((r) => r.teacherId === account?.id);
  const isVerifiedTeacher = Boolean(account?.registered && account?.status === 'verified');
  const isPendingRegistration = Boolean(account && (!account.registered || account.status !== 'verified'));

  // Rejected-account countdown: when the account is rejected, show a 9-second
  // countdown, then log the teacher out and permanently delete the account.
  const [secondsLeft, setSecondsLeft] = useState(9);
  useEffect(() => {
    if (account?.status !== 'rejected') return;
    setSecondsLeft(9);
    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onDeleteAccount(account.id);
          onLogout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [account?.status, account?.id, onDeleteAccount, onLogout]);

  // Active leave (if today falls within the leave period)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const parseYMD = (s: string) => {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  };
  const myLeave = account?.id
    ? leaves.find((l) => l.teacherId === account.id && (l.status === undefined || l.status === 'approved') && l.startDate <= todayISO && todayISO <= l.endDate)
    : undefined;
  const pendingLeave = account?.id
    ? leaves.find((l) => l.teacherId === account.id && l.status === 'pending')
    : undefined;
  const deniedLeave = account?.id
    ? [...leaves]
        .filter((l) => l.teacherId === account.id && l.status === 'denied')
        .sort((a, b) => (b.decidedAt || '').localeCompare(a.decidedAt || ''))[0]
    : undefined;
  const daysLeft = myLeave
    ? Math.max(0, Math.round((parseYMD(myLeave.endDate).getTime() - today.getTime()) / 86400000) + 1)
    : 0;

  // Keep the current-month figures for the progress display, but calculate
  // Remaining covers every salary month from the teacher's roster joining month
  // through the current month. Existing roster records fall back to account
  // creation because they predate the joinedAt field.
  const currentMonth = MONTHS[new Date().getMonth()];
  const currentYear = new Date().getFullYear();
  const currentMonthIndex = new Date().getMonth();
  const receivedThisMonth = staffRecord
    ? salaryPayments
        .filter((p) => p.teacherStaffId === staffRecord.id && p.month === currentMonth && p.year === currentYear)
        .reduce((sum, p) => sum + p.netPaid, 0)
    : 0;
  const joiningDate = staffRecord?.joinedAt || account?.createdAt;
  const parsedJoiningDate = joiningDate ? new Date(joiningDate) : today;
  const validJoiningDate = Number.isNaN(parsedJoiningDate.getTime()) ? today : parsedJoiningDate;
  const startYear = validJoiningDate.getFullYear();
  const startMonthIndex = validJoiningDate.getMonth();
  const firstSalaryMonth = startYear * 12 + startMonthIndex;
  const currentSalaryMonth = currentYear * 12 + currentMonthIndex;
  const salaryMonthsElapsed = Math.max(1, currentSalaryMonth - firstSalaryMonth + 1);
  const paidThroughCurrentMonth = staffRecord
    ? salaryPayments
        .filter((p) => {
          if (p.teacherStaffId !== staffRecord.id) return false;
          const paymentMonthIndex = MONTHS.indexOf(p.month);
          if (paymentMonthIndex < 0) return false;
          const paymentMonth = p.year * 12 + paymentMonthIndex;
          return paymentMonth >= firstSalaryMonth && paymentMonth <= currentSalaryMonth;
        })
        .reduce((sum, p) => sum + p.netPaid, 0)
    : 0;
  const remainingAllMonths = staffRecord
    ? Math.max(0, staffRecord.baseSalary * salaryMonthsElapsed - paidThroughCurrentMonth)
    : 0;
  const remainingThisMonth = staffRecord ? Math.max(0, staffRecord.baseSalary - receivedThisMonth) : 0;
  const isFullyPaidThisMonth = staffRecord ? remainingThisMonth <= 0 : false;
  const isFullyPaidAllMonths = staffRecord ? remainingAllMonths <= 0 : false;
  const paidPercent = staffRecord && staffRecord.baseSalary > 0
    ? Math.min(100, Math.round((receivedThisMonth / staffRecord.baseSalary) * 100))
    : 0;

  const [leaveRequestOpen, setLeaveRequestOpen] = useState(false);
  const [leaveRequest, setLeaveRequest] = useState({ startDate: '', endDate: '', notes: '' });
  const [leaveRequestError, setLeaveRequestError] = useState('');
  const [lightbox, setLightbox] = useState<{ src: string; name: string } | null>(null);
  const [routeNotice, setRouteNotice] = useState<string | null>(null);

  // Teachers directory (read-only, basic info only — no salary/budget)
  const [teachersOpen, setTeachersOpen] = useState(false);
  const [teacherSearch, setTeacherSearch] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  type StudentAttendanceDraftEntry = {
    present: boolean;
    late: boolean;
    dairy: boolean;
    uniform: boolean;
  };
  const emptyAttendanceEntry = (): StudentAttendanceDraftEntry => ({ present: true, late: false, dairy: false, uniform: false });
  const [attendanceDraft, setAttendanceDraft] = useState<Record<string, StudentAttendanceDraftEntry>>({});
  const [attendanceNoteDraft, setAttendanceNoteDraft] = useState<Record<string, string>>({});
  const [attendanceSavedNotice, setAttendanceSavedNotice] = useState<string | null>(null);
  const [showClassPicker, setShowClassPicker] = useState(false);
  const [activeStudentId, setActiveStudentId] = useState<string | null>(null);
  type AttendanceFeeEntry = { tutorial: boolean; general: boolean };
  const [attendanceFeeDraft, setAttendanceFeeDraft] = useState<Record<string, AttendanceFeeEntry>>({});
  const toggleAttendanceFee = (studentId: string, kind: 'tutorial' | 'general') =>
    setAttendanceFeeDraft((prev) => {
      const cur = prev[studentId] || { tutorial: false, general: false };
      return { ...prev, [studentId]: { ...cur, [kind]: !cur[kind] } };
    });
  const visibleTeachers = allTeachers.filter((t) =>
    t.fullName.toLowerCase().includes(teacherSearch.toLowerCase()) ||
    (t.designation || '').toLowerCase().includes(teacherSearch.toLowerCase())
  );
  const ownAvatar = account ?? { fullName: session.fullName };
  const studentClassList = useMemo(() => {
    const list = students.filter((s) => isClassMatch(s.class, selectedClass));
    return list.sort((a, b) => String(a.roll ?? '').localeCompare(String(b.roll ?? ''), undefined, { numeric: true, sensitivity: 'base' }));
  }, [students, selectedClass]);
  const classRecord = useMemo(() => {
    if (!selectedClass) return null;
    return studentAttendanceRecords.find((r) => r.className === selectedClass && r.date === todayISO) || null;
  }, [studentAttendanceRecords, selectedClass, todayISO]);
  // A class may be marked only ONCE per day — by the first teacher who submits.
  // Once a record exists for this class+date, it is locked for everyone until tomorrow.
  const classLocked = Boolean(classRecord);

  useEffect(() => {
    if (!selectedClass) return;
    if (classRecord) {
      const draft: Record<string, StudentAttendanceDraftEntry> = {};
      const notes: Record<string, string> = {};
      classRecord.statuses.forEach((item) => {
        draft[item.studentId] = {
          present: item.present,
          late: item.late,
          dairy: item.dairy,
          uniform: item.uniform,
        };
        if (item.note) notes[item.studentId] = item.note;
      });
      setAttendanceDraft(draft);
      setAttendanceNoteDraft(notes);
    } else {
      setAttendanceDraft({});
      setAttendanceNoteDraft({});
    }
  }, [classRecord, selectedClass]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ status: string; time?: string }>).detail;
      if (!detail) return;
      if (detail.status === 'arrived') {
        setRouteNotice('Attendance recorded successfully — you have arrived.');
      } else if (detail.status === 'departed') {
        setRouteNotice('Attendance recorded successfully — you have checked out.');
      } else if (detail.status === 'already') {
        setRouteNotice('This QR was already used for today.');
      } else if (detail.status === 'wrongday') {
        setRouteNotice('This QR is for a different day.');
      } else {
        setRouteNotice('The QR could not be verified.');
      }
    };
    window.addEventListener('attendance-route-result', handler as EventListener);
    return () => window.removeEventListener('attendance-route-result', handler as EventListener);
  }, []);

  return (
    <div className="min-h-screen w-full bg-[#fdfbf7] flex flex-col">
      {/* Teacher header — distinct green bar */}
      <header className="bg-gradient-to-r from-[#4a5d4e] to-[#3d4d41] text-stone-100 shadow-md sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <img src={logo2} alt="Logo" className="w-8 h-8 object-contain shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-serif font-bold leading-tight truncate">Samdania Madrasah</p>
              <p className="text-[10px] text-[#d9c5b2] leading-tight">Teacher Portal · শিক্ষক পোর্টাল</p>
            </div>
          </div>
          <TeacherAvatar
            account={account}
            size={40}
            onClick={account?.photoUrl ? () => setLightbox({ src: account.photoUrl!, name: account.fullName }) : undefined}
          />
          <button
            onClick={() => { setTeacherSearch(''); setTeachersOpen(true); }}
            className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-stone-100 text-xs font-bold px-3 py-2 rounded-lg border border-white/20 cursor-pointer transition-all active:scale-95 shrink-0"
          >
            <Users className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Teachers (শিক্ষক)</span>
          </button>
          <button
            onClick={onOpenSettings}
            className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-stone-100 text-xs font-bold px-3 py-2 rounded-lg border border-white/20 cursor-pointer transition-all active:scale-95 shrink-0"
          >
            <Settings className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Settings</span>
          </button>
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-stone-100 text-xs font-bold px-3 py-2 rounded-lg border border-white/20 cursor-pointer transition-all active:scale-95 shrink-0"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Logout</span>
          </button>
          <NotificationBell light />
        </div>
      </header>

      {lightbox && (
        <PhotoLightbox src={lightbox.src} name={lightbox.name} onClose={() => setLightbox(null)} />
      )}

      {/* Main */}
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-5 sm:py-7 space-y-5">
        {account?.status === 'rejected' ? (
          <div className="bg-red-50 border border-red-200 rounded-2xl shadow-sm p-6 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <XCircle className="h-6 w-6 text-red-600" />
              <h2 className="text-base font-serif font-bold text-red-800">Registration Rejected (নিবন্ধন বাতিল)</h2>
            </div>
            <p className="text-sm text-red-700">Your teacher account registration was rejected.</p>
            <p className="text-sm text-red-700">আপনার শিক্ষক অ্যাকাউন্টের নিবন্ধন বাতিল করা হয়েছে।</p>
            {account.rejectionReason && (
              <div className="mt-3 bg-white border border-red-100 rounded-xl p-3 text-left">
                <p className="text-[10px] font-bold uppercase text-red-400 mb-1">Reason (কারণ)</p>
                <p className="text-xs text-red-800">{account.rejectionReason}</p>
              </div>
            )}
            <div className="mt-4 bg-red-100 border border-red-200 rounded-xl p-3">
              <p className="text-sm font-bold text-red-800">
                You will be logged out after ({secondsLeft}) seconds.
              </p>
              <p className="text-sm font-bold text-red-800">
                আপনি ({secondsLeft}) সেকেন্ড পরে লগআউট হবেন।
              </p>
            </div>
          </div>
        ) : (
        <>
        {/* Welcome + Monthly Salary (side by side) */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-5">
          <div className="sm:col-span-2 bg-white rounded-2xl border border-stone-200 shadow-sm p-5 flex items-center gap-4">
            <TeacherAvatar
              account={ownAvatar}
              size={56}
              onClick={account?.photoUrl ? () => setLightbox({ src: account.photoUrl!, name: account.fullName }) : undefined}
            />
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-widest text-stone-400 font-bold">Welcome back</p>
              <h1 className="text-lg sm:text-xl font-serif font-bold text-[#2c332d] truncate">
                {account?.fullName || session.fullName}
              </h1>
              {account?.designation && (
                <p className="text-xs text-[#4a5d4e] font-semibold flex items-center gap-1">
                  <BadgeCheck className="h-3.5 w-3.5" /> {account.designation}
                </p>
              )}
            </div>
          </div>

          {/* Monthly Salary quick stat + received / remaining */}
          <div className={`sm:col-span-2 rounded-2xl border p-5 shadow-sm flex flex-col justify-center ${staffRecord ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
            <div className="flex items-center justify-between gap-2">
              <DollarSign className={`h-5 w-5 ${staffRecord ? 'text-emerald-600' : 'text-amber-600'}`} />
              {staffRecord && account?.id && (
                <button
                  onClick={() => onToggleSalaryVisible(account.id!)}
                  title={salaryVisible ? 'Hide salary (লুকান)' : 'Show salary (দেখুন)'}
                  className="p-1 rounded-lg hover:bg-white/70 cursor-pointer transition-all text-stone-500"
                >
                  {salaryVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </button>
              )}
            </div>
            <p className="text-[10px] uppercase tracking-wide text-stone-400 font-bold mt-1">Monthly Salary (মাসিক বেতন)</p>
            {staffRecord ? (
              salaryVisible ? (
                <p className="text-lg font-black text-emerald-700 font-mono">৳{staffRecord.baseSalary.toLocaleString()}</p>
              ) : (
                <p className="text-lg font-black text-emerald-700 font-mono tracking-[0.2em]">৳••••</p>
              )
            ) : (
              <p className="text-xs font-bold text-amber-600 mt-1 flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" /> Pending
              </p>
            )}

            {staffRecord && salaryVisible && (
              <div className="mt-3 pt-3 border-t border-emerald-200/70 space-y-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white/70 rounded-lg p-2">
                    <p className="text-[9px] uppercase tracking-wide font-bold text-emerald-600 leading-tight">
                      Received this month (এই মাসে প্রাপ্ত)
                    </p>
                    <p className="text-sm font-black text-emerald-700 font-mono mt-0.5">৳{receivedThisMonth.toLocaleString()}</p>
                  </div>
                  <div className={`bg-white/70 rounded-lg p-2 ${isFullyPaidAllMonths ? 'border border-emerald-200' : 'border border-red-200'}`}>
                    <p className={`text-[9px] uppercase tracking-wide font-bold leading-tight ${isFullyPaidAllMonths ? 'text-emerald-600' : 'text-red-500'}`}>
                      Remaining (বাকি)
                    </p>
                    <p className={`text-sm font-black font-mono mt-0.5 ${remainingAllMonths <= 0 ? 'text-emerald-700' : 'text-red-600'}`}>৳{remainingAllMonths.toLocaleString()}</p>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between text-[9px] font-bold mb-0.5">
                    <span className="text-stone-500 uppercase tracking-wide">Paid this month (এই মাসে)</span>
                    <span className="font-mono text-stone-500">{paidPercent}%</span>
                  </div>
                  <div className="h-1.5 bg-emerald-100/80 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${paidPercent}%`, backgroundColor: isFullyPaidThisMonth ? '#059669' : '#f59e0b' }}
                    />
                  </div>
                  {isFullyPaidThisMonth && (
                    <p className="text-[9px] font-bold text-emerald-600 mt-1 flex items-center gap-1">
                      <BadgeCheck className="h-3 w-3" /> Fully paid for {currentMonth} {currentYear}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {isPendingRegistration && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-start gap-2.5">
            <Clock className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-[11px] text-amber-800 leading-relaxed">
              Your account is created and pending <span className="font-bold">admin registration</span>. Once the admin
              registers you from <span className="font-bold">Salary Disbursement → Pending Reg (নিবন্ধন) tab</span>,
              your monthly salary and class access will appear here.
            </p>
          </div>
        )}

        {routeNotice && (
          <div className="rounded-xl border border-[#d9c5b2] bg-[#fdf8ef] px-3 py-2 text-[11px] font-semibold text-[#4a5d4e]">
            {routeNotice}
          </div>
        )}

        {isVerifiedTeacher && <TeacherNoticeboard teacherId={account?.id} />}

        {/* Leave status OR class routines */}
        {myLeave ? (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl shadow-sm p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <CalendarOff className="h-5 w-5 text-amber-600 shrink-0" />
                  <h2 className="text-sm font-serif font-bold text-amber-800">You are on leave (আপনি ছুটিতে আছেন)</h2>
                </div>
                <p className="text-[11px] text-amber-700">
                  Leave period (ছুটির সময়): {myLeave.startDate} → {myLeave.endDate}
                </p>
                <p className="text-lg font-black text-amber-800 mt-1">
                  {daysLeft > 1
                    ? `${daysLeft} days left (${daysLeft} দিন)`
                    : daysLeft === 1
                    ? `1 day left (১ দিন বাকি)`
                    : `Last day of leave (ছুটির শেষ দিন)`}
                </p>
                {myLeave.notes && (
                  <p className="text-[11px] text-amber-600 mt-1">Notes (নোট): {myLeave.notes}</p>
                )}
                {myLeave.adminNote && (
                  <p className="text-[11px] text-amber-700 mt-1 font-semibold">Admin message (অ্যাডমিন বার্তা): {myLeave.adminNote}</p>
                )}
              </div>
            </div>
          </div>
        ) : pendingLeave ? (
          <div className="bg-sky-50 border border-sky-200 rounded-2xl shadow-sm p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-5 w-5 text-sky-600" />
              <h2 className="text-sm font-serif font-bold text-sky-800">Leave request pending (ছুটির আবেদন অপেক্ষমাণ)</h2>
            </div>
            <p className="text-[11px] text-sky-700">
              Requested period: {pendingLeave.startDate} → {pendingLeave.endDate}. The admin must approve it.
            </p>
            {pendingLeave.notes && <p className="text-[11px] text-sky-600 mt-1">Note: {pendingLeave.notes}</p>}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <CalendarClock className="h-4 w-4 text-[#4a5d4e]" />
              <h2 className="text-sm font-serif font-bold text-[#2c332d]">Class Routines (ক্লাস রুটিন)</h2>
            </div>
            {isVerifiedTeacher && (
              <button
                onClick={() => {
                  setLeaveRequest({ startDate: todayISO, endDate: todayISO, notes: '' });
                  setLeaveRequestError('');
                  setLeaveRequestOpen(true);
                }}
                className="mb-4 w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2.5 rounded-lg shadow-sm active:scale-95 cursor-pointer border border-indigo-700 flex items-center justify-center gap-1.5"
              >
                <CalendarClock className="h-3.5 w-3.5" />
                Request Leave (ছুটির আবেদন)
              </button>
            )}
            {deniedLeave && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700">
                Your latest leave request ({deniedLeave.startDate} → {deniedLeave.endDate}) was denied.
                {deniedLeave.adminNote && <span className="font-semibold"> Admin message: {deniedLeave.adminNote}</span>}
              </div>
            )}
            {isPendingRegistration ? (
              <p className="text-xs text-stone-500">
                There is no class for you yet. Please register and get verified first to start teaching at Samdania Madrasah.
              </p>
            ) : myRoutines.length === 0 ? (
              <p className="text-xs text-stone-500">No class routines added yet. The admin can add them from <span className="font-bold">Salary Disbursement → Teachers Details</span>.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {myRoutines.map((r) => (
                  <div key={r.id} className="border border-stone-200 rounded-xl p-3 bg-[#fdfbf7]">
                    {r.time && (
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-[#4a5d4e]" />
                        <span className="text-sm font-black text-[#2c332d] font-mono">{r.time}</span>
                      </div>
                    )}
                    <div className="mt-2 space-y-0.5 text-[11px]">
                      {r.class && <p className="text-stone-600"><span className="font-bold text-stone-500">Class (শ্রেণী):</span> <span className="font-bold text-[#2c332d]">{r.class}</span></p>}
                      {r.subject && <p className="text-stone-600"><span className="font-bold text-stone-500">Subject (বিষয়):</span> <span className="font-bold text-[#2c332d]">{r.subject}</span></p>}
                      {r.restTime && <p className="text-stone-600"><span className="font-bold text-stone-500">Rest (বিশ্রাম):</span> <span className="font-bold text-[#2c332d]">{r.restTime}</span></p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Attendance (الحضور) — scan to mark arrival / departure.
            Always visible; once fully checked out it shows the recorded status. */}
        {isVerifiedTeacher && !myLeave && (
          <>
            <AttendanceSection qrSet={qrSet} todayRecord={todayRecord} onScan={onScan} />
            <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 space-y-4">
              <div className="flex flex-col gap-1">
                <h2 className="text-sm font-serif font-bold text-[#2c332d]">Class Attendance (ক্লাস উপস্থিতি)</h2>
                <p className="text-[11px] text-stone-500">নিচের ক্লাস বাছাই করুন, শিক্ষার্থীদের চিহ্নিত করুন এবং আজকের রেকর্ড জমা দিন।</p>
              </div>

              {!selectedClass ? (
                <div className="flex flex-col items-center justify-center py-8 gap-4">
                  <div className="bg-[#4a5d4e]/10 p-4 rounded-2xl">
                    <Users className="h-8 w-8 text-[#4a5d4e]" />
                  </div>
                  {!showClassPicker ? (
                    <button
                      onClick={() => setShowClassPicker(true)}
                      className="w-full max-w-xs bg-[#4a5d4e] hover:bg-[#3d4d41] text-white text-sm font-bold px-4 py-3 rounded-xl shadow-sm active:scale-95 cursor-pointer border border-[#3d4d41] flex items-center justify-center gap-2"
                    >
                      <Users className="h-4 w-4 text-[#d9c5b2]" />
                      Choose a class (ক্লাস বাছাই করুন)
                    </button>
                  ) : (
                    <div className="w-full max-w-md space-y-2">
                      <p className="text-center text-[11px] font-bold uppercase tracking-wide text-stone-400">Select a class (একটি ক্লাস নির্বাচন করুন)</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {academicClasses.map((cls) => (
                          <button
                            key={cls}
                            onClick={() => { setSelectedClass(cls); setShowClassPicker(false); }}
                            className="bg-white hover:bg-[#f5f2ed] border border-stone-200 hover:border-[#4a5d4e] text-[#2c332d] text-xs font-bold px-3 py-3 rounded-xl transition-all cursor-pointer active:scale-95"
                          >
                            {cls}
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={() => setShowClassPicker(false)}
                        className="w-full text-center text-xs font-bold text-stone-400 hover:text-stone-600 py-1 cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <button
                      onClick={() => { setSelectedClass(''); setActiveStudentId(null); }}
                      className="flex items-center gap-1.5 text-xs font-bold text-[#4a5d4e] hover:text-[#2c332d] cursor-pointer"
                    >
                      <ChevronDown className="h-4 w-4 rotate-90" />
                      {selectedClass}
                    </button>
                    <span className="text-[11px] text-stone-400">{studentClassList.length} students</span>
                  </div>

                  {classLocked && (
                    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-800">
                      <Lock className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>
                        Attendance for <span className="font-bold">{selectedClass}</span> on {todayISO} was already submitted by {classRecord!.teacherName}. It is locked for today and can be updated tomorrow.
                      </span>
                    </div>
                  )}

                  {studentClassList.length === 0 ? (
                    <p className="text-xs text-stone-500">No students are listed for this class yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {studentClassList.map((student) => {
                        const lockedEntry = classLocked ? classRecord!.statuses.find((s) => s.studentId === student.id) : undefined;
                        if (lockedEntry) {
                          return (
                            <div key={student.id} className="flex items-center justify-between gap-2 rounded-xl border border-stone-200 bg-stone-50 p-3">
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-[#2c332d]">{student.name}</p>
                                <p className="text-[11px] text-stone-500">Roll {student.roll} • {student.class}</p>
                              </div>
                              <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                                {lockedEntry.present ? (
                                  <>
                                    <span className="rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-[10px] font-bold">হাজির</span>
                                    {lockedEntry.late && <span className="rounded-full bg-amber-100 text-amber-700 px-1.5 py-0.5 text-[10px] font-bold">Late</span>}
                                    {lockedEntry.dairy && <span className="rounded-full bg-sky-100 text-sky-700 px-1.5 py-0.5 text-[10px] font-bold">Dairy</span>}
                                    {lockedEntry.uniform && <span className="rounded-full bg-violet-100 text-violet-700 px-1.5 py-0.5 text-[10px] font-bold">Uniform</span>}
                                  </>
                                ) : (
                                  <span className="rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-[10px] font-bold">অনুপস্থিত</span>
                                )}
                              </div>
                            </div>
                          );
                        }
                        const entry = attendanceDraft[student.id] || emptyAttendanceEntry();
                        const fee = attendanceFeeDraft[student.id];
                        const feeTag = fee?.tutorial || fee?.general;
                        return (
                          <button
                            key={student.id}
                            type="button"
                            onClick={() => setActiveStudentId(student.id)}
                            className="w-full text-left flex items-center justify-between gap-2 rounded-xl border border-stone-200 bg-white p-3 hover:border-[#4a5d4e] hover:bg-[#fdfbf7] transition-all cursor-pointer active:scale-[0.99]"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-[#2c332d]">{student.name}</p>
                              <p className="text-[11px] text-stone-500">Roll {student.roll} • {student.class}</p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                              {feeTag && <span className="rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-[10px] font-bold">আদায়</span>}
                              {entry.present ? (
                                <>
                                  <span className="rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-[10px] font-bold">হাজির</span>
                                  {entry.late && <span className="rounded-full bg-amber-100 text-amber-700 px-1.5 py-0.5 text-[10px] font-bold">Late</span>}
                                  {entry.dairy && <span className="rounded-full bg-sky-100 text-sky-700 px-1.5 py-0.5 text-[10px] font-bold">Dairy</span>}
                                  {entry.uniform && <span className="rounded-full bg-violet-100 text-violet-700 px-1.5 py-0.5 text-[10px] font-bold">Uniform</span>}
                                </>
                              ) : entry.present === false ? (
                                <span className="rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-[10px] font-bold">অনুপস্থিত</span>
                              ) : (
                                <span className="text-[10px] text-stone-400 font-semibold">Tap to mark (চিহ্নিত করুন)</span>
                              )}
                              <ChevronDown className="h-4 w-4 text-stone-300" />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {!classLocked && (
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pt-1">
                      <div className="text-[11px] text-stone-500">Ready to submit for today.</div>
                      <button
                        onClick={() => {
                          if (!account || !selectedClass) return;
                          const statuses = studentClassList.map((student) => {
                            const e = attendanceDraft[student.id] || emptyAttendanceEntry();
                            const fee = attendanceFeeDraft[student.id];
                            const feeTags: string[] = [];
                            if (fee?.tutorial) feeTags.push('টিউটোরিয়াল আদায়');
                            if (fee?.general) feeTags.push('আদায়');
                            let note = attendanceNoteDraft[student.id] || '';
                            if (feeTags.length) note = note ? `${note} • ${feeTags.join(' • ')}` : feeTags.join(' • ');
                            return {
                              id: `${student.id}_${todayISO}`,
                              studentId: student.id,
                              studentName: student.name,
                              className: selectedClass,
                              present: e.present,
                              late: e.present ? e.late : false,
                              dairy: e.present ? e.dairy : false,
                              uniform: e.present ? e.uniform : false,
                              note: note || undefined,
                              recordedAt: new Date().toISOString(),
                              teacherId: account.id,
                              teacherName: account.fullName,
                              date: todayISO,
                            };
                          });
                          onSubmitStudentAttendance({
                            teacherId: account.id,
                            teacherName: account.fullName,
                            className: selectedClass,
                            date: todayISO,
                            statuses,
                          });
                          setAttendanceSavedNotice(`Attendance for ${selectedClass} saved.`);
                          setAttendanceFeeDraft({});
                        }}
                        className="bg-[#4a5d4e] hover:bg-[#3d4d41] text-white text-xs font-bold px-4 py-2.5 rounded-lg shadow-sm active:scale-95 cursor-pointer border border-[#3d4d41]"
                      >
                        Save Class Attendance
                      </button>
                    </div>
                  )}

                  {attendanceSavedNotice && (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-semibold text-emerald-700">{attendanceSavedNotice}</div>
                  )}
                </div>
              )}

              {/* Student attendance modal */}
              {activeStudentId && (() => {
                const student = studentClassList.find((s) => s.id === activeStudentId);
                if (!student) return null;
                const entry = attendanceDraft[student.id] || emptyAttendanceEntry();
                const fee = attendanceFeeDraft[student.id] || { tutorial: false, general: false };
                const setEntry = (patch: Partial<StudentAttendanceDraftEntry>) =>
                  setAttendanceDraft((prev) => ({
                    ...prev,
                    [student.id]: { ...(prev[student.id] || emptyAttendanceEntry()), ...patch },
                  }));
                const markPresent = () => setEntry({ present: true });
                const markAbsent = () => setEntry({ present: false, late: false, dairy: false, uniform: false });
                const toggleFlag = (flag: 'late' | 'dairy' | 'uniform') =>
                  setEntry({ [flag]: !entry[flag] } as Partial<StudentAttendanceDraftEntry>);
                return (
                  <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
                    onClick={() => setActiveStudentId(null)}
                  >
                    <div
                      className="bg-white rounded-2xl shadow-2xl w-full max-w-sm border border-stone-200 overflow-hidden"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="bg-gradient-to-r from-[#4a5d4e] to-[#3d4d41] text-stone-100 px-5 py-4 flex items-center justify-between">
                        <div className="min-w-0">
                          <p className="text-sm font-serif font-bold truncate">{student.name}</p>
                          <p className="text-[10px] text-[#d9c5b2]">Roll {student.roll} • {student.class}</p>
                        </div>
                        <button onClick={() => setActiveStudentId(null)} className="p-1.5 hover:bg-white/20 rounded-lg cursor-pointer transition-all text-stone-100">
                          <X className="h-5 w-5" />
                        </button>
                      </div>

                      <div className="p-5 space-y-4">
                        {/* Present / Absent */}
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={markPresent}
                            className={`rounded-xl py-3 text-sm font-bold border transition-all flex items-center justify-center gap-1.5 ${entry.present ? 'bg-[#4a5d4e] text-white border-[#3d4d41]' : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'}`}
                          >
                            <CheckCircle2 className="h-4 w-4" /> Present (হাজির)
                          </button>
                          <button
                            type="button"
                            onClick={markAbsent}
                            className={`rounded-xl py-3 text-sm font-bold border transition-all flex items-center justify-center gap-1.5 ${!entry.present ? 'bg-red-600 text-white border-red-700' : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'}`}
                          >
                            <XCircle className="h-4 w-4" /> Absent (অনুপস্থিত)
                          </button>
                        </div>

                        {/* Marks */}
                        {entry.present && (
                          <div className="space-y-2">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-stone-400">Marks (মার্কস)</p>
                            <div className="grid grid-cols-3 gap-2">
                              <button type="button" onClick={() => toggleFlag('late')} className={`rounded-xl py-2.5 text-[11px] font-bold border transition-all ${entry.late ? 'bg-amber-500 border-amber-500 text-white' : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'}`}>Late (দেরি)</button>
                              <button type="button" onClick={() => toggleFlag('dairy')} className={`rounded-xl py-2.5 text-[11px] font-bold border transition-all ${entry.dairy ? 'bg-sky-600 border-sky-600 text-white' : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'}`}>Dairy (দৈনন্দিন)</button>
                              <button type="button" onClick={() => toggleFlag('uniform')} className={`rounded-xl py-2.5 text-[11px] font-bold border transition-all ${entry.uniform ? 'bg-violet-600 border-violet-600 text-white' : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'}`}>Uniform (ইউনিফর্ম)</button>
                            </div>
                          </div>
                        )}

                        {/* Note */}
                        <input
                          type="text"
                          value={attendanceNoteDraft[student.id] || ''}
                          onChange={(e) => setAttendanceNoteDraft((prev) => ({ ...prev, [student.id]: e.target.value }))}
                          placeholder="Note"
                          className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#4a5d4e]"
                        />

                        {/* Fee collection buttons at the bottom */}
                        <div className="pt-2 border-t border-stone-100 space-y-2">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-stone-400">টাকা আদায় (Collection)</p>
                          <button type="button" onClick={() => toggleAttendanceFee(student.id, 'tutorial')} className={`w-full rounded-xl py-2.5 text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${fee.tutorial ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'}`}>
                            {fee.tutorial && <CheckCircle2 className="h-4 w-4" />}
                            টিউটোরিয়াল হাতের লেখা টাকা আদায়
                          </button>
                          <button type="button" onClick={() => toggleAttendanceFee(student.id, 'general')} className={`w-full rounded-xl py-2.5 text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${fee.general ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'}`}>
                            {fee.general && <CheckCircle2 className="h-4 w-4" />}
                            আদায়
                          </button>
                        </div>

                        <button type="button" onClick={() => setActiveStudentId(null)} className="w-full bg-[#4a5d4e] hover:bg-[#3d4d41] text-white text-sm font-bold px-4 py-2.5 rounded-lg shadow-sm active:scale-95 cursor-pointer border border-[#3d4d41]">Done</button>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </>
        )}

        {/* Profile card removed — now shown in the Teacher Settings page */}

        {/* Teacher leave request modal */}
        {leaveRequestOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            onClick={() => setLeaveRequestOpen(false)}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-stone-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
                <h3 className="text-sm font-serif font-bold text-[#2c332d]">Request Leave (ছুটির আবেদন)</h3>
                <button
                  onClick={() => setLeaveRequestOpen(false)}
                  className="p-1.5 hover:bg-stone-100 rounded-lg cursor-pointer transition-all text-stone-500"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="text-[10px] font-bold text-stone-500">
                    From (শুরুর তারিখ)
                    <input type="date" value={leaveRequest.startDate} onChange={(e) => setLeaveRequest({ ...leaveRequest, startDate: e.target.value })} className="mt-1 w-full px-2.5 py-2 rounded-lg border border-stone-200 text-xs" />
                  </label>
                  <label className="text-[10px] font-bold text-stone-500">
                    To (শেষ তারিখ)
                    <input type="date" min={leaveRequest.startDate} value={leaveRequest.endDate} onChange={(e) => setLeaveRequest({ ...leaveRequest, endDate: e.target.value })} className="mt-1 w-full px-2.5 py-2 rounded-lg border border-stone-200 text-xs" />
                  </label>
                </div>
                <label className="block text-[10px] font-bold text-stone-500">
                  Note (নোট) — optional
                  <textarea value={leaveRequest.notes} onChange={(e) => setLeaveRequest({ ...leaveRequest, notes: e.target.value })} rows={3} className="mt-1 w-full px-2.5 py-2 rounded-lg border border-stone-200 text-xs resize-none" placeholder="Reason for leave…" />
                </label>
                {leaveRequestError && <p className="text-[11px] text-red-600 font-semibold">{leaveRequestError}</p>}
                <button
                  onClick={() => {
                    if (!account?.id || !leaveRequest.startDate || !leaveRequest.endDate) {
                      setLeaveRequestError('Please select both dates.');
                      return;
                    }
                    if (leaveRequest.startDate > leaveRequest.endDate) {
                      setLeaveRequestError('The end date must be on or after the start date.');
                      return;
                    }
                    const overlapsExisting = leaves.some((leave) =>
                      leave.teacherId === account.id &&
                      (leave.status === undefined || leave.status === 'pending' || leave.status === 'approved') &&
                      leave.startDate <= leaveRequest.endDate &&
                      leave.endDate >= leaveRequest.startDate
                    );
                    if (overlapsExisting) {
                      setLeaveRequestError('These dates overlap an existing leave request.');
                      return;
                    }
                    onRequestTeacherLeave({
                      teacherId: account.id,
                      startDate: leaveRequest.startDate,
                      endDate: leaveRequest.endDate,
                      notes: leaveRequest.notes.trim(),
                      status: 'pending',
                      requestedAt: new Date().toISOString(),
                    });
                    setLeaveRequestOpen(false);
                  }}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2.5 rounded-lg shadow-sm cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Send className="h-3.5 w-3.5" /> Send Request (আবেদন পাঠান)
                </button>
              </div>
            </div>
          </div>
        )}
        </>
        )}
      </main>

      {/* ===== Teachers Directory (read-only, basic info only) ===== */}
      {teachersOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => setTeachersOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-stone-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-[#4a5d4e] text-stone-100 border-b border-[#3d4d41] px-5 py-4 flex items-center justify-between rounded-t-2xl">
              <h3 className="text-sm font-serif font-bold flex items-center gap-2">
                <Users className="h-4 w-4 text-[#d9c5b2]" />
                Teachers (শিক্ষক) · {visibleTeachers.length}
              </h3>
              <button
                onClick={() => setTeachersOpen(false)}
                className="p-1.5 hover:bg-white/20 rounded-lg cursor-pointer transition-all text-stone-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-4">
              <div className="relative w-full">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-stone-400" />
                <input
                  type="text"
                  placeholder="Search by name or designation..."
                  value={teacherSearch}
                  onChange={(e) => setTeacherSearch(e.target.value)}
                  className="w-full bg-stone-50 text-xs border border-stone-200 rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:border-[#4a5d4e]"
                />
              </div>

              {visibleTeachers.length === 0 ? (
                <p className="text-center text-stone-500 text-xs italic py-8">No teachers found.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {visibleTeachers.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center gap-3 bg-[#fdfbf7] border border-stone-200 rounded-xl p-3"
                    >
                      <TeacherAvatar account={t} size={44} />
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[#2c332d] truncate">{t.fullName}</p>
                        {t.designation && (
                          <p className="text-[11px] text-[#4a5d4e] font-semibold truncate">{t.designation}</p>
                        )}
                        {t.role && (
                          <span className="inline-block mt-1 px-2 py-0.5 text-[10px] rounded font-bold uppercase border bg-[#f5f2ed] text-[#4a5d4e] border-stone-200">
                            {t.role}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
