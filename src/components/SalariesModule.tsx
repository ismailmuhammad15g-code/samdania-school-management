import React, { useState, useMemo, useEffect } from 'react';
import { TeacherStaff, SalaryPayment, MONTHS, TeacherAccount, TeacherRoutine, TeacherLeave, AttendanceQRSet, AttendanceRecord } from '../types';
import { TeacherAvatar, PhotoLightbox } from './TeacherPhoto';
import AttendanceReportTab from './AttendanceReportTab';
import PasswordConfirmModal from './PasswordConfirmModal';
import { parseNumberWithBengaliSupport } from '../lib/digitUtils';
import { 
  Briefcase, 
  Plus, 
  DollarSign, 
  Calendar, 
  Trash2, 
  Search, 
  AlertCircle,
  X,
  Mail,
  Phone,
  User,
  BadgeCheck,
  Clock,
  Send,
  TrendingUp,
  Receipt,
  Building2,
  UserPlus,
  CheckCircle2,
  Users,
  CalendarOff,
  CalendarPlus,
  CalendarCheck,
  XCircle,
  Filter,
  RefreshCw
} from 'lucide-react';

interface SalariesModuleProps {
  teachersStaff: TeacherStaff[];
  salaryPayments: SalaryPayment[];
  paymentMethods: string[];
  teacherAccounts: TeacherAccount[];
  onDeleteTeacherStaff: (id: string) => void;
  onPaySalary: (payment: Omit<SalaryPayment, 'id' | 'recordedBy'>) => void;
  onDeleteSalaryPayment: (id: string) => void;
  onRegisterTeacherAccount: (accountId: string, monthlySalary: number) => void;
  onRejectTeacherAccount: (accountId: string, reason: string) => void;
  teacherRoutines: TeacherRoutine[];
  onAddTeacherRoutine: (entry: Omit<TeacherRoutine, 'id'>) => void;
  onDeleteTeacherRoutine: (id: string) => void;
  teacherLeaves: TeacherLeave[];
  onAddTeacherLeave: (entry: Omit<TeacherLeave, 'id'>) => void;
  onDeleteTeacherLeave: (id: string) => void;
  onDecideTeacherLeave: (id: string, status: 'approved' | 'denied', adminNote?: string) => void;
  onRefreshTeacherLeaves: () => Promise<void>;
  onAdminDeleteTeacher: (teacherId: string) => void;
  onUpdateTeacherProfile: (accountId: string, patch: { fullName: string; designation: string; contact: string; email: string; bio: string; photoUrl?: string }) => void;
  attendanceQRSet: AttendanceQRSet | null;
  attendanceRecords: AttendanceRecord[];
  readOnly?: boolean;
}

export default function SalariesModule({
  teachersStaff,
  salaryPayments,
  paymentMethods,
  teacherAccounts,
  onDeleteTeacherStaff,
  onPaySalary,
  onDeleteSalaryPayment,
  onRegisterTeacherAccount,
  onRejectTeacherAccount,
  teacherRoutines,
  onAddTeacherRoutine,
  onDeleteTeacherRoutine,
  teacherLeaves,
  onAddTeacherLeave,
  onDeleteTeacherLeave,
  onDecideTeacherLeave,
  onRefreshTeacherLeaves,
  onAdminDeleteTeacher,
  onUpdateTeacherProfile,
  attendanceQRSet,
  attendanceRecords,
  readOnly
}: SalariesModuleProps) {
  const [activeTab, setActiveTab] = useState<'roster' | 'ledger' | 'unpaid' | 'disburse' | 'pendingreg' | 'teacheroverview' | 'teacherdetails' | 'attendance'>('roster');
  const [profileTeacher, setProfileTeacher] = useState<TeacherAccount | null>(null);
  const [profileDraft, setProfileDraft] = useState({ fullName: '', designation: '', contact: '', email: '', bio: '', photoUrl: '' });

  // Teacher photo lightbox (click any teacher avatar to enlarge)
  const [lightbox, setLightbox] = useState<{ src: string; name: string } | null>(null);
  const photoUrlFor = (email?: string, name?: string): string | undefined =>
    teacherAccounts.find(
      (a) => (email && a.email && a.email.toLowerCase() === email.toLowerCase()) || (name && a.fullName && a.fullName.toLowerCase() === name.toLowerCase())
    )?.photoUrl;

  // Pending teacher-account registration (from onboarding)
  const [regAccount, setRegAccount] = useState<TeacherAccount | null>(null);
  const [regSalary, setRegSalary] = useState('');
  const [regError, setRegError] = useState('');

  // Reject teacher-account registration (with reason)
  const [rejectAccount, setRejectAccount] = useState<TeacherAccount | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const openRejectModal = (t: TeacherAccount) => {
    setRejectAccount(t);
    setRejectReason('');
  };

  const handleRejectConfirm = () => {
    if (!rejectAccount) return;
    const reason = rejectReason.trim();
    if (!reason) {
      alert('Please enter a rejection reason.');
      return;
    }
    onRejectTeacherAccount(rejectAccount.id, reason);
    setRejectAccount(null);
  };

  const openTeacherProfile = (teacher: TeacherAccount) => {
    setProfileTeacher(teacher);
    setProfileDraft({ fullName: teacher.fullName, designation: teacher.designation || '', contact: teacher.contact || '', email: teacher.email || '', bio: teacher.bio || '', photoUrl: teacher.photoUrl || '' });
  };

  const saveTeacherProfile = () => {
    if (!profileTeacher || !profileDraft.fullName.trim() || !profileDraft.email.trim()) {
      alert('Teacher name and email are required.');
      return;
    }
    onUpdateTeacherProfile(profileTeacher.id, { ...profileDraft, fullName: profileDraft.fullName.trim(), designation: profileDraft.designation.trim(), contact: profileDraft.contact.trim(), email: profileDraft.email.trim(), bio: profileDraft.bio.trim(), photoUrl: profileDraft.photoUrl.trim() || undefined });
    setProfileTeacher(null);
  };

  const pendingAccounts = useMemo(
    () => teacherAccounts.filter((a) => !a.registered && a.status !== 'rejected'),
    [teacherAccounts]
  );

  // Only verified (registered) teacher accounts appear in Teachers Details
  const verifiedTeachers = useMemo(
    () => teacherAccounts.filter((a) => a.registered),
    [teacherAccounts]
  );

  // Class Routine modal state
  const [routineTeacher, setRoutineTeacher] = useState<TeacherAccount | null>(null);
  const [routineDraft, setRoutineDraft] = useState({ time: '', class: '', subject: '', restTime: '' });

  const openRoutineModal = (t: TeacherAccount) => {
    setRoutineTeacher(t);
    setRoutineDraft({ time: '', class: '', subject: '', restTime: '' });
  };

  const handleAddRoutine = () => {
    if (!routineTeacher) return;
    const { time, class: cls, subject, restTime } = routineDraft;
    if (!time.trim() && !cls.trim() && !subject.trim() && !restTime.trim()) {
      alert('Please fill at least one field for the routine.');
      return;
    }
    onAddTeacherRoutine({
      teacherId: routineTeacher.id,
      time: time.trim(),
      class: cls.trim(),
      subject: subject.trim(),
      restTime: restTime.trim()
    });
    setRoutineDraft({ time: '', class: '', subject: '', restTime: '' });
  };

  const handleDeleteRoutine = (id: string) => {
    onDeleteTeacherRoutine(id);
  };

  const currentTeacherRoutines = routineTeacher
    ? teacherRoutines.filter((r) => r.teacherId === routineTeacher.id)
    : [];

  // Leave (ছুটি) modal state
  const [leaveTeacher, setLeaveTeacher] = useState<TeacherAccount | null>(null);
  const [leaveDraft, setLeaveDraft] = useState({ startDate: '', endDate: '', notes: '' });
  const [leaveDecisionNotes, setLeaveDecisionNotes] = useState<Record<string, string>>({});
  const [leaveHistoryTeacher, setLeaveHistoryTeacher] = useState('all');
  const [leaveHistoryStatus, setLeaveHistoryStatus] = useState<'all' | 'pending' | 'approved' | 'denied'>('all');
  const [refreshingLeaves, setRefreshingLeaves] = useState(false);
  const todayStr = (() => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  })();

  const openLeaveModal = (t: TeacherAccount) => {
    setLeaveTeacher(t);
    setLeaveDraft({ startDate: todayStr, endDate: todayStr, notes: '' });
  };

  const handleAddLeave = () => {
    if (!leaveTeacher) return;
    if (!leaveDraft.startDate || !leaveDraft.endDate) {
      alert('Please set both start and end dates.');
      return;
    }
    if (leaveDraft.startDate > leaveDraft.endDate) {
      alert('End date must be on or after the start date.');
      return;
    }
    onAddTeacherLeave({
      teacherId: leaveTeacher.id,
      startDate: leaveDraft.startDate,
      endDate: leaveDraft.endDate,
      notes: leaveDraft.notes.trim(),
      status: 'approved',
      decidedAt: new Date().toISOString()
    });
    setLeaveTeacher(null);
  };

  const handleDeleteLeave = (id: string) => onDeleteTeacherLeave(id);

  const activeLeaveFor = (teacherId: string): TeacherLeave | undefined =>
    teacherLeaves.find(
      (l) => l.teacherId === teacherId && (l.status === undefined || l.status === 'approved') && l.startDate <= todayStr && todayStr <= l.endDate
    );

  const pendingLeaveFor = (teacherId: string): TeacherLeave | undefined =>
    teacherLeaves.find((l) => l.teacherId === teacherId && l.status === 'pending');

  const leaveDays = (leave: TeacherLeave): number => {
    const start = new Date(`${leave.startDate}T00:00:00`);
    const end = new Date(`${leave.endDate}T00:00:00`);
    const difference = end.getTime() - start.getTime();
    return Number.isFinite(difference) && difference >= 0
     ? Math.floor(difference / 86400000) + 1
     : 0;
  };

  const leaveHistory = useMemo(() => teacherLeaves
    .filter((leave) => leaveHistoryTeacher === 'all' || leave.teacherId === leaveHistoryTeacher)
    .filter((leave) => leaveHistoryStatus === 'all' || (leave.status || 'approved') === leaveHistoryStatus)
    .sort((a, b) => b.startDate.localeCompare(a.startDate)), [teacherLeaves, leaveHistoryTeacher, leaveHistoryStatus]);

  const leaveTotals = useMemo(() => {
    const approvedLeaves = teacherLeaves.filter((leave) => (leave.status || 'approved') === 'approved');
    return {
     requests: teacherLeaves.length,
     approved: approvedLeaves.length,
     days: approvedLeaves.reduce((sum, leave) => sum + leaveDays(leave), 0),
    };
  }, [teacherLeaves]);

  useEffect(() => {
    if (activeTab !== 'attendance') return;
    setRefreshingLeaves(true);
    onRefreshTeacherLeaves()
      .finally(() => setRefreshingLeaves(false));
  }, [activeTab, onRefreshTeacherLeaves]);

  const [selectedStaff, setSelectedStaff] = useState<TeacherStaff | null>(null);
  const [disburseData, setDisburseData] = useState({
    month: MONTHS[new Date().getMonth()],
    year: new Date().getFullYear(),
    date: new Date().toISOString().split('T')[0],
    amount: '',
    method: ''
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [methodsLoading, setMethodsLoading] = useState(true);
  const [guardAction, setGuardAction] = useState<{ label: string; onConfirm: () => void } | null>(null);

  // Simulate skeleton loading for payment methods
  React.useEffect(() => {
    if (paymentMethods.length > 0) {
      setMethodsLoading(true);
      const timer = setTimeout(() => setMethodsLoading(false), 600);
      return () => clearTimeout(timer);
    } else {
      setMethodsLoading(false);
    }
  }, [paymentMethods]);

  const disburseAmount = parseNumberWithBengaliSupport(disburseData.amount) || 0;

  const getMonthStatus = (staffId: string, month: string, year: number) => {
    const payments = salaryPayments.filter(
      p => p.teacherStaffId === staffId && p.month === month && p.year === year
    );
    const totalDisbursed = payments.reduce((sum, p) => sum + p.netPaid, 0);
    return { payments, totalDisbursed };
  };

  const currentMonth = MONTHS[new Date().getMonth()];
  const currentYear = new Date().getFullYear();

  const staffMonthStatus = useMemo(() => {
    return teachersStaff.map(t => {
      const { totalDisbursed } = getMonthStatus(t.id, currentMonth, currentYear);
      const remaining = t.baseSalary - totalDisbursed;
      return { ...t, totalDisbursed, remaining: Math.max(0, remaining), isFullyDisbursed: remaining <= 0 };
    });
  }, [teachersStaff, salaryPayments, currentMonth, currentYear]);

  const pendingStaff = useMemo(() => staffMonthStatus.filter(t => !t.isFullyDisbursed), [staffMonthStatus]);

  const monthSummary = useMemo(() => {
    const totalDue = teachersStaff.reduce((sum, t) => sum + t.baseSalary, 0);
    const totalDisbursed = staffMonthStatus.reduce((sum, t) => sum + t.totalDisbursed, 0);
    const totalRemaining = Math.max(0, totalDue - totalDisbursed);
    return { totalDue, totalDisbursed, totalRemaining, staffCount: teachersStaff.length };
  }, [teachersStaff, staffMonthStatus]);

  const handleDisburseSubmit = () => {
    if (!selectedStaff) return;

    const { totalDisbursed } = getMonthStatus(selectedStaff.id, disburseData.month, disburseData.year);
    const remaining = Math.max(0, selectedStaff.baseSalary - totalDisbursed);
    const sendAmount = disburseAmount > 0 ? Math.min(disburseAmount, remaining) : remaining;

    onPaySalary({
      teacherStaffId: selectedStaff.id,
      teacherStaffName: selectedStaff.name,
      month: disburseData.month,
      year: disburseData.year,
      date: disburseData.date,
      amount: selectedStaff.baseSalary,
      allowance: 0,
      deduction: 0,
      netPaid: sendAmount,
      paymentMode: disburseData.method
    });

    alert(`Disbursed ৳${sendAmount.toLocaleString()} to ${selectedStaff.name} for ${disburseData.month} ${disburseData.year}.`);
    
    setSelectedStaff(null);
    setDisburseData({
      month: MONTHS[new Date().getMonth()],
      year: new Date().getFullYear(),
      date: new Date().toISOString().split('T')[0],
      amount: '',
      method: ''
    });
    setActiveTab('ledger');
  };

  const filteredStaff = teachersStaff.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.designation.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <>
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-serif font-bold text-[#2c332d] tracking-tight flex items-center gap-2">
            <Building2 className="h-5 w-5 text-[#4a5d4e]" />
            Salary Disbursement (বেতন প্রদান)
          </h2>
          <p className="text-xs text-stone-500 mt-1">
            Teachers create their own accounts from the portal. Approve pending registrations below to add them to the roster.
          </p>
        </div>
      </div>

      {/* Summary Cards — always visible */}
      {teachersStaff.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-lg border border-stone-200 p-3 shadow-sm">
            <span className="text-[9px] text-stone-400 font-bold uppercase block">Staff (কর্মচারী)</span>
            <span className="text-lg font-black text-[#2c332d] font-mono">{monthSummary.staffCount}</span>
          </div>
          <div className="bg-white rounded-lg border border-stone-200 p-3 shadow-sm">
            <span className="text-[9px] text-stone-400 font-bold uppercase block">Total Monthly Due (মোট বেতন)</span>
            <span className="text-lg font-black text-stone-700 font-mono">৳{monthSummary.totalDue.toLocaleString()}</span>
          </div>
          <div className="bg-emerald-50 rounded-lg border border-emerald-200 p-3 shadow-sm">
            <span className="text-[9px] text-emerald-600 font-bold uppercase block">Disbursed (প্রদানকৃত)</span>
            <span className="text-lg font-black text-emerald-700 font-mono">৳{monthSummary.totalDisbursed.toLocaleString()}</span>
          </div>
          <div className={`rounded-lg border p-3 shadow-sm ${monthSummary.totalRemaining > 0 ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
            <span className={`text-[9px] font-bold uppercase block ${monthSummary.totalRemaining > 0 ? 'text-red-500' : 'text-emerald-600'}`}>Remaining (বাকি)</span>
            <span className={`text-lg font-black font-mono ${monthSummary.totalRemaining > 0 ? 'text-red-600' : 'text-emerald-700'}`}>৳{monthSummary.totalRemaining.toLocaleString()}</span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-stone-100 flex flex-wrap gap-1">
        {[
          { id: 'roster' as const, icon: <Briefcase className="h-3.5 w-3.5" />, label: 'Roster (তালিকা)', count: teachersStaff.length },
          { id: 'ledger' as const, icon: <Receipt className="h-3.5 w-3.5" />, label: 'Disbursement Ledger (হিসাব)', count: salaryPayments.length },
          { id: 'unpaid' as const, icon: <AlertCircle className="h-3.5 w-3.5" />, label: 'Pending (বকেয়া)', count: pendingStaff.length },
          { id: 'pendingreg' as const, icon: <UserPlus className="h-3.5 w-3.5" />, label: 'Pending Reg (নিবন্ধন)', count: pendingAccounts.length },
          { id: 'teacheroverview' as const, icon: <User className="h-3.5 w-3.5" />, label: 'Teacher Overview', count: verifiedTeachers.length },
          { id: 'teacherdetails' as const, icon: <Users className="h-3.5 w-3.5" />, label: 'Teachers Details (শিক্ষক বিবরণ)', count: verifiedTeachers.length },
          { id: 'attendance' as const, icon: <CalendarCheck className="h-3.5 w-3.5" />, label: 'Attendance (উপস্থিতি)', count: attendanceRecords.filter((r) => r.date === (() => { const t = new Date(); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; })()).length },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-2 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
              activeTab === tab.id
                ? 'border-[#4a5d4e] text-[#4a5d4e] font-extrabold'
                : 'border-transparent text-stone-500 hover:text-[#2c332d]'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
            <span className={`text-[10px] font-mono ${tab.id === 'pendingreg' && tab.count > 0 ? 'text-amber-600 font-bold' : 'text-stone-400'}`}>
              ({tab.count})
            </span>
          </button>
        ))}
        {selectedStaff && (
          <button
            onClick={() => setActiveTab('disburse')}
            className={`px-3 py-2 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'disburse'
                ? 'border-[#4a5d4e] text-[#4a5d4e] font-extrabold'
                : 'border-transparent text-stone-500 hover:text-[#2c332d]'
            }`}
          >
            <Send className="h-3.5 w-3.5" />
            Disburse → {selectedStaff.name}
          </button>
        )}
      </div>

      {/* ===== TAB 1: ROSTER ===== */}
      {activeTab === 'roster' && (
        <div className="space-y-4">
          <div className="relative w-full">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-stone-400" />
            <input
              type="text"
              placeholder="Search by name or designation..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white text-xs border border-stone-200 rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:border-[#4a5d4e]"
            />
          </div>

          <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#4a5d4e] text-stone-100 uppercase tracking-wider font-semibold">
                    <th className="py-3 px-3">ID</th>
                    <th className="py-3 px-3">Name (নাম)</th>
                    <th className="py-3 px-3">Type (ধরন)</th>
                    <th className="py-3 px-3">Designation (পদবি)</th>
                    <th className="py-3 px-3">Contact (যোগাযোগ)</th>
                    <th className="py-3 px-3 text-right">Monthly Salary (মাসিক)</th>
                    <th className="py-3 px-3 text-center">This Month</th>
                    <th className="py-3 px-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filteredStaff.length === 0 ? (
                    <tr>
                       <td colSpan={8} className="py-12 text-center text-stone-500 italic">
                         {teachersStaff.length === 0
                           ? 'No teachers or staff yet. Approve a pending registration from the Pending Reg (নিবন্ধন) tab.'
                           : 'No results found.'}
                       </td>
                    </tr>
                  ) : (
                    filteredStaff.map((s) => {
                      const { totalDisbursed } = getMonthStatus(s.id, currentMonth, currentYear);
                      const remaining = Math.max(0, s.baseSalary - totalDisbursed);
                      const isFullyDisbursed = remaining <= 0;
                      const isPartial = totalDisbursed > 0 && !isFullyDisbursed;
                      const staffPhoto = photoUrlFor(s.email, s.name);

                      return (
                        <tr key={s.id} className="hover:bg-[#f5f2ed]/50 transition-all">
                          <td className="py-3 px-3 font-mono font-bold text-[#4a5d4e] text-[10px]">{s.id}</td>
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2">
                              <TeacherAvatar
                                account={{ fullName: s.name, photoUrl: staffPhoto }}
                                size={32}
                                onClick={staffPhoto ? () => setLightbox({ src: staffPhoto!, name: s.name }) : undefined}
                              />
                              <div className="min-w-0">
                                <div className="font-bold text-[#2c332d] truncate">{s.name}</div>
                                {s.bio && <div className="text-[10px] text-stone-400 mt-0.5 max-w-[130px] truncate">{s.bio}</div>}
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <span className={`px-2 py-0.5 text-[10px] rounded font-bold uppercase border ${
                              s.role === 'Teacher' 
                                ? 'bg-[#f5f2ed] text-[#4a5d4e] border-stone-200' 
                                : 'bg-stone-100 text-stone-600 border-stone-200'
                            }`}>
                              {s.role}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-medium text-stone-600">{s.designation}</td>
                          <td className="py-3 px-3 font-mono text-stone-500 text-[11px]">{s.contact || '—'}</td>
                          <td className="py-3 px-3 font-bold font-mono text-right text-stone-700">৳{s.baseSalary.toLocaleString()}</td>
                          <td className="py-3 px-3 text-center">
                            {isFullyDisbursed ? (
                              <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                <BadgeCheck className="h-3 w-3" />
                                Disbursed (প্রদানকৃত)
                              </span>
                            ) : isPartial ? (
                              <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                <Clock className="h-3 w-3" />
                                Partial — ৳{remaining.toLocaleString()} due
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                <AlertCircle className="h-3 w-3" />
                                Pending (বকেয়া)
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {!readOnly && (
                                <button
                                  onClick={() => { setSelectedStaff(s); setActiveTab('disburse'); }}
                                  className="bg-[#4a5d4e] hover:bg-[#3d4d41] text-white text-[10px] font-bold px-2.5 py-1 rounded shadow-sm transition-all flex items-center gap-1 cursor-pointer border border-[#3d4d41]"
                                >
                                  <Send className="h-3 w-3 text-[#d9c5b2]" />
                                  Disburse
                                </button>
                              )}
                              {!readOnly && (
                                <button
                                  onClick={() => setGuardAction({ label: `Remove ${s.name} from roster`, onConfirm: () => onDeleteTeacherStaff(s.id) })}
                                  className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded-full transition-all"
                                  title="Remove from roster"
                                >
                                <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===== TAB 2: DISBURSEMENT LEDGER ===== */}
      {activeTab === 'ledger' && (
        <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="p-4 bg-[#f5f2ed]/50 border-b border-stone-200/60 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-serif font-bold text-[#2c332d] uppercase flex items-center gap-1.5">
                <Receipt className="h-3.5 w-3.5 text-[#4a5d4e]" />
                Disbursement Ledger (বেতন হিসাব)
              </h3>
              <p className="text-[10px] text-stone-400 mt-0.5">Every payment the madrasah has made — full audit trail.</p>
            </div>
            {salaryPayments.length > 0 && (
              <div className="text-right">
                <span className="text-[9px] text-stone-400 font-bold uppercase block">Total Disbursed (সর্বমোট)</span>
                <span className="text-sm font-black text-[#4a5d4e] font-mono">
                  ৳{salaryPayments.reduce((sum, p) => sum + p.netPaid, 0).toLocaleString()}
                </span>
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#4a5d4e] text-stone-100 font-semibold uppercase">
                  <th className="py-3 px-3">Date (তারিখ)</th>
                  <th className="py-3 px-3">Recipient (প্রাপক)</th>
                  <th className="py-3 px-3">Period (মাস/বছর)</th>
                  <th className="py-3 px-3 text-right">Monthly Salary</th>
                  <th className="py-3 px-3 text-right">Disbursed (প্রদানকৃত)</th>
                  <th className="py-3 px-3">Method (মাধ্যম)</th>
                  <th className="py-3 px-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {salaryPayments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center">
                      <Send className="h-8 w-8 text-stone-200 mx-auto mb-2" />
                      <p className="text-stone-500 italic">No disbursements recorded yet.</p>
                      <p className="text-[10px] text-stone-400 mt-1">Go to Roster → click Disburse to send salary to a teacher.</p>
                    </td>
                  </tr>
                ) : (
                  salaryPayments.map((p) => (
                    <tr key={p.id} className="hover:bg-[#f5f2ed]/50 transition-all">
                      <td className="py-3 px-3 font-mono text-stone-500 whitespace-nowrap">{p.date}</td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <TeacherAvatar
                            account={{ fullName: p.teacherStaffName, photoUrl: photoUrlFor(undefined, p.teacherStaffName) }}
                            size={28}
                            onClick={photoUrlFor(undefined, p.teacherStaffName) ? () => setLightbox({ src: photoUrlFor(undefined, p.teacherStaffName)!, name: p.teacherStaffName }) : undefined}
                          />
                          <span className="font-bold text-[#2c332d]">{p.teacherStaffName}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap font-bold text-[#4a5d4e]">{p.month} {p.year}</td>
                      <td className="py-3 px-3 font-mono text-stone-400 text-right">৳{p.amount.toLocaleString()}</td>
                      <td className="py-3 px-3 font-mono font-bold text-[#4a5d4e] text-sm text-right">৳{p.netPaid.toLocaleString()}</td>
                      <td className="py-3 px-3">
                        <span className="bg-stone-100 text-stone-700 px-1.5 py-0.5 rounded font-bold text-[10px] border border-stone-200">
                          {p.paymentMode}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {!readOnly && (
                          <button
                            onClick={() => setGuardAction({ label: `Delete ৳${p.netPaid.toLocaleString()} disbursement to ${p.teacherStaffName}`, onConfirm: () => onDeleteSalaryPayment(p.id) })}
                            className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded-full transition-all"
                            title="Delete record"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===== TAB 3: PENDING DISBURSEMENTS ===== */}
      {activeTab === 'unpaid' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-red-50 border-b border-red-200/60 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <h3 className="text-xs font-serif font-bold text-red-800 uppercase">
                Pending Disbursements — {currentMonth} {currentYear} ({pendingStaff.length})
              </h3>
            </div>

            {pendingStaff.length === 0 ? (
              <div className="py-12 text-center">
                {teachersStaff.length === 0 ? (
                  <>
                    <Briefcase className="h-12 w-12 text-stone-200 mx-auto mb-3" />
                    <p className="text-sm font-bold text-stone-500">No teachers or staff registered yet.</p>
                    <p className="text-xs text-stone-400 mt-1">Register staff first, then disburse their salary.</p>
                  </>
                ) : (
                  <>
                    <BadgeCheck className="h-12 w-12 text-emerald-300 mx-auto mb-3" />
                    <p className="text-sm font-bold text-emerald-700">All salaries disbursed for this month!</p>
                    <p className="text-xs text-stone-400 mt-1">সবাই বেতন পেয়েছেন — কেউ বকেয়া নেই।</p>
                  </>
                )}
              </div>
            ) : (
              <div className="divide-y divide-stone-100">
                {pendingStaff.map(t => (
                  <div key={t.id} className="flex items-center gap-4 px-4 py-3 hover:bg-stone-50 transition-all">
                    <TeacherAvatar
                      account={{ fullName: t.name, photoUrl: photoUrlFor(t.email, t.name) }}
                      size={40}
                      onClick={photoUrlFor(t.email, t.name) ? () => setLightbox({ src: photoUrlFor(t.email, t.name)!, name: t.name }) : undefined}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[#2c332d]">{t.name}</span>
                        <span className="text-[10px] text-stone-400">— {t.designation}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[10px]">
                        <span className="text-stone-500">Salary: <strong className="font-mono">৳{t.baseSalary.toLocaleString()}</strong></span>
                        <span className="text-emerald-600">Disbursed: <strong className="font-mono">৳{t.totalDisbursed.toLocaleString()}</strong></span>
                        <span className="text-red-600 font-bold">Still Due: <strong className="font-mono">৳{t.remaining.toLocaleString()}</strong></span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="w-20 h-1.5 bg-stone-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-red-500 to-amber-400 rounded-full transition-all"
                          style={{ width: `${Math.min(100, (t.totalDisbursed / t.baseSalary) * 100)}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-mono text-stone-500 w-10 text-right">
                        {Math.round((t.totalDisbursed / t.baseSalary) * 100)}%
                      </span>
                      {!readOnly && (
                        <button
                          onClick={() => { setSelectedStaff(t); setActiveTab('disburse'); }}
                          className="bg-[#4a5d4e] hover:bg-[#3d4d41] text-white text-[10px] font-bold px-2.5 py-1 rounded shadow-sm transition-all cursor-pointer border border-[#3d4d41] flex items-center gap-1"
                        >
                          <Send className="h-3 w-3" />
                          Disburse Now
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== TAB: PENDING REGISTRATION (teacher accounts from onboarding) ===== */}
      {activeTab === 'pendingreg' && (
        <div className="space-y-3">
          {teacherAccounts.length === 0 ? (
            <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-10 text-center flex flex-col items-center justify-center gap-2">
              <UserPlus className="h-7 w-7 text-stone-300" />
              <p className="text-xs font-bold text-stone-500">No teacher accounts found</p>
              <p className="text-[11px] text-stone-400">
                Teacher registrations from the onboarding portal will appear here once created.
              </p>
            </div>
          ) : (
            teacherAccounts
              .slice()
              .sort((a, b) => Number(a.registered) - Number(b.registered))
              .map((a) => (
                <div
                  key={a.id}
                  className="bg-white rounded-xl border border-stone-200 shadow-sm p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-bold text-[#2c332d] flex items-center gap-2">
                      <TeacherAvatar
                        account={a}
                        size={36}
                        onClick={a.photoUrl ? () => setLightbox({ src: a.photoUrl!, name: a.fullName }) : undefined}
                      />
                      {a.fullName}
                    </p>
                    <p className="text-[11px] text-stone-500 flex items-center gap-1.5">
                      <BadgeCheck className="h-3.5 w-3.5 text-stone-400 shrink-0" />
                      {a.designation || '—'}
                    </p>
                    <p className={`text-[11px] font-bold uppercase ${a.registered ? 'text-emerald-700' : 'text-amber-700'}`}>
                      Status: {a.registered ? 'Registered / Verified' : 'Pending / Unverified'}
                    </p>
                    {a.email && (
                      <p className="text-[11px] text-stone-400 flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5 text-stone-400 shrink-0" />
                        {a.email}
                      </p>
                    )}
                    <p className="text-[10px] text-stone-400">Created: {new Date(a.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 justify-end">
                    {!a.registered && a.status !== 'rejected' && !readOnly && (
                      <>
                        <button
                          onClick={() => { setRegAccount(a); setRegSalary(''); setRegError(''); }}
                          className="shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-lg shadow-sm active:scale-95 cursor-pointer border border-emerald-700 flex items-center justify-center gap-1.5"
                        >
                          <UserPlus className="h-3.5 w-3.5" />
                          Approve & Register
                        </button>
                        <button
                          onClick={() => openRejectModal(a)}
                          className="shrink-0 bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-4 py-2.5 rounded-lg shadow-sm active:scale-95 cursor-pointer border border-red-700 flex items-center justify-center gap-1.5"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          Reject (প্রত্যাখ্যান)
                        </button>
                      </>
                    )}
                    {a.registered && (
                      <span className="inline-flex items-center gap-1 px-3 py-2 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-100">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Verified
                      </span>
                    )}
                  </div>
                </div>
              ))
          )}
        </div>
      )}

      {activeTab === 'teacherdetails' && (
        <div className="space-y-3">
          {verifiedTeachers.length === 0 ? (
            <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-10 text-center flex flex-col items-center justify-center gap-2">
              <Users className="h-7 w-7 text-stone-300" />
              <p className="text-xs font-bold text-stone-500">No verified teachers found</p>
              <p className="text-[11px] text-stone-400">
                Approve teacher accounts from the Pending Reg tab first. Only verified teachers appear here.
              </p>
            </div>
          ) : (
            verifiedTeachers.map((a) => {
              const rCount = teacherRoutines.filter((r) => r.teacherId === a.id).length;
              const onLeave = activeLeaveFor(a.id);
              const pendingLeave = pendingLeaveFor(a.id);
              return (
                <div
                  key={a.id}
                  className="bg-white rounded-xl border border-stone-200 shadow-sm p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-bold text-[#2c332d] flex items-center gap-2">
                      <TeacherAvatar
                        account={a}
                        size={36}
                        onClick={a.photoUrl ? () => setLightbox({ src: a.photoUrl!, name: a.fullName }) : undefined}
                      />
                      {a.fullName}
                    </p>
                    <p className="text-[11px] text-stone-500 flex items-center gap-1.5">
                      <BadgeCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      {a.designation || '—'}
                    </p>
                    {a.email && (
                      <p className="text-[11px] text-stone-400 flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5 text-stone-400 shrink-0" />
                        {a.email}
                      </p>
                    )}
                    {a.contact && (
                      <p className="text-[11px] text-stone-400 flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 text-stone-400 shrink-0" />
                        {a.contact}
                      </p>
                    )}
                    <p className="text-[11px] text-stone-500">
                      Class Routines: <span className="font-bold text-[#4a5d4e]">{rCount}</span>
                    </p>
                    {onLeave ? (
                      <p className="text-[11px] text-amber-700 font-bold flex items-center gap-1.5">
                        <CalendarOff className="h-3.5 w-3.5" />
                        On Leave (ছুটিতে): {onLeave.startDate} → {onLeave.endDate}
                      </p>
                    ) : pendingLeave ? (
                      <p className="text-[11px] text-sky-700 font-bold flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" />
                        Leave Pending: {pendingLeave.startDate} → {pendingLeave.endDate}
                      </p>
                    ) : (
                      <p className="text-[11px] text-stone-400">
                        Leave (ছুটি): None
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 justify-end">
                    {!readOnly && (<>
                    <span className="inline-flex items-center gap-1 px-3 py-2 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-100">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Verified
                    </span>
                    <button
                      onClick={() => openRoutineModal(a)}
                      className="shrink-0 bg-[#4a5d4e] hover:bg-[#3d4d41] text-white text-xs font-bold px-4 py-2.5 rounded-lg shadow-sm active:scale-95 cursor-pointer border border-[#3d4d41] flex items-center justify-center gap-1.5"
                    >
                      <Calendar className="h-3.5 w-3.5 text-[#d9c5b2]" />
                      Add Routine
                    </button>
                    {!onLeave && !pendingLeave && (
                      <button
                        onClick={() => openLeaveModal(a)}
                        className="shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2.5 rounded-lg shadow-sm active:scale-95 cursor-pointer border border-indigo-700 flex items-center justify-center gap-1.5"
                      >
                        <CalendarPlus className="h-3.5 w-3.5 text-indigo-100" />
                        Add Leave
                      </button>
                    )}
                    {onLeave && (
                      <button
                        onClick={() => handleDeleteLeave(onLeave.id)}
                        className="shrink-0 bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-4 py-2.5 rounded-lg shadow-sm active:scale-95 cursor-pointer border border-red-700 flex items-center justify-center gap-1.5"
                      >
                        <CalendarOff className="h-3.5 w-3.5" />
                        Remove Leave
                      </button>
                    )}
                    <button
                      onClick={() => setGuardAction({ label: `Permanently delete teacher ${a.fullName} (স্থায়ীভাবে মুছুন)`, onConfirm: () => onAdminDeleteTeacher(a.id) })}
                      className="shrink-0 bg-red-700 hover:bg-red-800 text-white text-xs font-bold px-4 py-2.5 rounded-lg shadow-sm active:scale-95 cursor-pointer border border-red-800 flex items-center justify-center gap-1.5"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete Teacher
                    </button>
                    </>)}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {activeTab === 'teacheroverview' && (
        <div className="grid gap-3">
          {verifiedTeachers.length === 0 && <div className="bg-white rounded-xl border border-stone-200 p-8 text-center text-xs text-stone-500">No verified teacher profiles found.</div>}
          {verifiedTeachers.map((teacher) => (
            <div key={teacher.id} className="bg-white rounded-xl border border-stone-200 shadow-sm p-4 flex flex-col sm:flex-row sm:items-center gap-4">
              <TeacherAvatar account={teacher} size={52} onClick={teacher.photoUrl ? () => setLightbox({ src: teacher.photoUrl!, name: teacher.fullName }) : undefined} />
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-[#2c332d]">{teacher.fullName}</h3>
                <p className="text-xs text-stone-500">{teacher.designation || 'No designation recorded'}</p>
                <p className="text-xs text-stone-500 mt-1 flex flex-wrap gap-3">
                  <a href={`tel:${teacher.contact || ''}`} className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{teacher.contact || 'No phone recorded'}</a>
                  <a href={`https://wa.me/${(teacher.contact || '').replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-emerald-700">WhatsApp</a>
                  <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{teacher.email}</span>
                </p>
                {teacher.bio && <p className="text-xs text-stone-600 mt-2 whitespace-pre-wrap">{teacher.bio}</p>}
              </div>
              {!readOnly && <button onClick={() => openTeacherProfile(teacher)} className="bg-[#4a5d4e] text-white rounded-lg px-3 py-2 text-xs font-bold">Edit Profile</button>}
            </div>
          ))}
        </div>
      )}

      {/* ===== TAB: ATTENDANCE REPORT (উপস্থিতি) ===== */}
      {activeTab === 'attendance' && (
        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
            <div className="bg-indigo-50 border-b border-indigo-100 px-4 py-3">
              <h3 className="text-sm font-serif font-bold text-indigo-900">Leave Requests (ছুটির আবেদন)</h3>
              <p className="text-[11px] text-indigo-700 mt-0.5">Approve or deny requests. Only administrators can remove an approved leave.</p>
            </div>
            <div className="p-4 space-y-3">
              {teacherLeaves.filter((leave) => leave.status === 'pending').length === 0 ? (
                <p className="text-xs text-stone-500">No pending leave requests.</p>
              ) : (
                teacherLeaves.filter((leave) => leave.status === 'pending').map((leave) => {
                  const teacher = teacherAccounts.find((account) => account.id === leave.teacherId);
                  return (
                    <div key={leave.id} className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3 space-y-2">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                        <div>
                          <p className="text-xs font-bold text-[#2c332d]">{teacher?.fullName || 'Unknown teacher'}</p>
                          <p className="text-[11px] text-stone-600">{leave.startDate} → {leave.endDate}</p>
                          {leave.notes && <p className="text-[11px] text-stone-600 mt-1">Teacher note: {leave.notes}</p>}
                        </div>
                        <span className="text-[10px] font-bold text-indigo-700">Pending confirmation</span>
                      </div>
                      <textarea
                        value={leaveDecisionNotes[leave.id] || ''}
                        onChange={(e) => setLeaveDecisionNotes((prev) => ({ ...prev, [leave.id]: e.target.value }))}
                        rows={2}
                        placeholder="Admin message (optional)…"
                        className="w-full rounded-lg border border-stone-200 bg-white px-2.5 py-2 text-xs resize-none"
                      />
                      {!readOnly && (
                        <div className="flex flex-wrap justify-end gap-2">
                          <button
                            onClick={() => { onDecideTeacherLeave(leave.id, 'denied', leaveDecisionNotes[leave.id]); setLeaveDecisionNotes((prev) => { const next = { ...prev }; delete next[leave.id]; return next; }); }}
                            className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-3 py-2 rounded-lg cursor-pointer"
                          >
                            Deny (বাতিল)
                          </button>
                          <button
                            onClick={() => { onDecideTeacherLeave(leave.id, 'approved', leaveDecisionNotes[leave.id]); setLeaveDecisionNotes((prev) => { const next = { ...prev }; delete next[leave.id]; return next; }); }}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-2 rounded-lg cursor-pointer"
                          >
                            Approve (অনুমোদন)
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
            <div className="bg-[#f5f2ed] border-b border-stone-200 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h3 className="text-sm font-serif font-bold text-[#2c332d]">Leave History (ছুটির ইতিহাস)</h3>
                <p className="text-[11px] text-stone-500 mt-0.5">All requests, decisions, current leave, and total approved leave days.</p>
              </div>
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-stone-500" />
                <button
                  onClick={() => { setRefreshingLeaves(true); onRefreshTeacherLeaves().finally(() => setRefreshingLeaves(false)); }}
                  disabled={refreshingLeaves}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-[10px] font-bold text-stone-600 hover:bg-stone-50 disabled:opacity-60"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${refreshingLeaves ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-lg border border-stone-200 bg-white px-3 py-2">
                  <p className="text-[9px] font-bold uppercase text-stone-400">All Requests</p>
                  <p className="text-lg font-black text-[#2c332d]">{leaveTotals.requests}</p>
                </div>
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                  <p className="text-[9px] font-bold uppercase text-emerald-600">Approved Leaves</p>
                  <p className="text-lg font-black text-emerald-700">{leaveTotals.approved}</p>
                </div>
                <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2">
                  <p className="text-[9px] font-bold uppercase text-indigo-600">Approved Days</p>
                  <p className="text-lg font-black text-indigo-700">{leaveTotals.days}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="text-[10px] font-bold text-stone-500">
                  Teacher
                  <select value={leaveHistoryTeacher} onChange={(e) => setLeaveHistoryTeacher(e.target.value)} className="mt-1 w-full rounded-lg border border-stone-200 bg-white px-2.5 py-2 text-xs">
                    <option value="all">All teachers</option>
                    {verifiedTeachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.fullName}</option>)}
                  </select>
                </label>
                <label className="text-[10px] font-bold text-stone-500">
                  Status
                  <select value={leaveHistoryStatus} onChange={(e) => setLeaveHistoryStatus(e.target.value as typeof leaveHistoryStatus)} className="mt-1 w-full rounded-lg border border-stone-200 bg-white px-2.5 py-2 text-xs">
                    <option value="all">All statuses</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="denied">Denied</option>
                  </select>
                </label>
              </div>
              {leaveHistory.length === 0 ? (
                <p className="text-xs text-stone-500">No leave history matches the selected filters.</p>
              ) : (
                <div className="space-y-2">
                  {leaveHistory.map((leave) => {
                    const teacher = teacherAccounts.find((account) => account.id === leave.teacherId);
                    const status = leave.status || 'approved';
                    const current = activeLeaveFor(leave.teacherId)?.id === leave.id;
                    return (
                      <div key={leave.id} className="rounded-xl border border-stone-200 p-3 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-xs font-bold text-[#2c332d]">{teacher?.fullName || 'Unknown teacher'}</p>
                            <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${
                              status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                              status === 'pending' ? 'bg-sky-100 text-sky-700' : 'bg-red-100 text-red-700'
                            }`}>{status}</span>
                            {current && <span className="rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-[9px] font-bold">Currently on leave</span>}
                          </div>
                          <p className="text-[11px] text-stone-600 mt-1">{leave.startDate} → {leave.endDate} · {leaveDays(leave)} day(s)</p>
                          {leave.notes && <p className="text-[10px] text-stone-500 mt-1">Teacher note: {leave.notes}</p>}
                          {leave.adminNote && <p className="text-[10px] text-stone-500 mt-1">Admin note: {leave.adminNote}</p>}
                        </div>
                        {!readOnly && (status === 'approved' || current) && (
                          <button
                            onClick={() => handleDeleteLeave(leave.id)}
                            className="shrink-0 bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-3 py-2 rounded-lg cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            <CalendarOff className="h-3.5 w-3.5" />
                            Cancel Leave
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          <AttendanceReportTab
            teachers={verifiedTeachers.map((a) => ({
              id: a.id,
              fullName: a.fullName,
              designation: a.designation,
              photoUrl: a.photoUrl,
              role: a.role,
              email: a.email,
            }))}
            records={attendanceRecords}
            qrSet={attendanceQRSet}
          />
        </div>
      )}

      {/* ===== TAB 4: DISBURSEMENT FORM ===== */}
      {activeTab === 'disburse' && selectedStaff && !readOnly && (() => {
        const { totalDisbursed } = getMonthStatus(selectedStaff.id, disburseData.month, disburseData.year);
        const remaining = Math.max(0, selectedStaff.baseSalary - totalDisbursed);
        const isFullyDisbursed = remaining <= 0;
        const sendingNow = disburseAmount > 0 ? Math.min(disburseAmount, remaining) : 0;
        const newRemaining = Math.max(0, remaining - sendingNow);

        return (
        <div className="max-w-lg mx-auto bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
          {/* Header */}
          <div className="p-4 bg-[#4a5d4e] text-stone-100 border-b border-[#3d4d41] flex justify-between items-center">
            <h3 className="text-sm font-serif font-bold flex items-center gap-1.5">
              <Send className="h-4.5 w-4.5 text-[#d9c5b2]" />
              Disburse Salary → {selectedStaff.name}
            </h3>
            <span className="text-[10px] bg-[#3d4d41] border border-[#2c332d] rounded px-2 py-0.5 font-bold">
              {selectedStaff.designation}
            </span>
          </div>

          <div className="p-6 space-y-5">
            {/* Context: who is receiving */}
            <div className="flex items-center gap-3 bg-stone-50 rounded-lg p-3 border border-stone-100">
              <div className="h-10 w-10 rounded-full bg-[#4a5d4e] flex items-center justify-center shrink-0">
                <span className="text-xs font-black text-white font-mono">{selectedStaff.name.charAt(0)}</span>
              </div>
              <div>
                <div className="text-xs font-bold text-[#2c332d]">{selectedStaff.name}</div>
                <div className="text-[10px] text-stone-400">{selectedStaff.designation} · Monthly Salary: <strong className="font-mono">৳{selectedStaff.baseSalary.toLocaleString()}</strong></div>
              </div>
            </div>

            {/* Period + Method */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-stone-500 mb-1">Month (মাস)</label>
                <select
                  value={disburseData.month}
                  onChange={(e) => setDisburseData({ ...disburseData, month: e.target.value })}
                  className="w-full bg-stone-50 text-xs border border-stone-200 rounded-lg px-2 py-2 focus:outline-none focus:border-[#4a5d4e]"
                >
                  {MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-stone-500 mb-1">Year (বছর)</label>
                <input
                  type="number"
                  required
                  value={disburseData.year}
                  onChange={(e) => setDisburseData({ ...disburseData, year: parseInt(e.target.value) || new Date().getFullYear() })}
                  className="w-full bg-stone-50 text-xs border border-stone-200 rounded-lg px-2 py-2 focus:outline-none font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-stone-500 mb-1">Date (তারিখ)</label>
                <input
                  type="date"
                  value={disburseData.date}
                  onChange={(e) => setDisburseData({ ...disburseData, date: e.target.value })}
                  className="w-full bg-stone-50 text-xs border border-stone-200 rounded-lg px-2 py-2 focus:outline-none font-mono"
                />
              </div>
            </div>

            {/* Method */}
            <div>
              <label className="block text-[10px] font-bold text-stone-500 mb-1">Disbursement Method (মাধ্যম)</label>
              {paymentMethods.length === 0 ? (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-amber-700">No payment methods configured.</p>
                    <p className="text-[10px] text-amber-500 mt-0.5">Go to Settings → Payment Methods to add methods first.</p>
                  </div>
                </div>
              ) : methodsLoading ? (
                <div className="grid grid-cols-3 gap-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-9 bg-stone-100 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {paymentMethods.map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setDisburseData({ ...disburseData, method: m })}
                      className={`text-xs font-bold py-2 rounded-lg border transition-all cursor-pointer ${
                        disburseData.method === m
                          ? 'bg-[#4a5d4e] text-white border-[#3d4d41] shadow-sm'
                          : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Payment Card */}
            <div className="rounded-xl border-2 border-stone-200 overflow-hidden">
              {/* Status bar */}
              <div className="bg-stone-50 px-5 py-4 border-b border-stone-200">
                <div className="flex items-center justify-between text-[10px] mb-1">
                  <span className="font-bold text-stone-500">DISBURSEMENT STATUS</span>
                  <span className="font-mono font-bold" style={{ color: isFullyDisbursed ? '#059669' : totalDisbursed > 0 ? '#d97706' : '#dc2626' }}>
                    {Math.round((totalDisbursed / selectedStaff.baseSalary) * 100)}%
                  </span>
                </div>
                <div className="h-2.5 bg-stone-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full rounded-full transition-all duration-500"
                    style={{ 
                      width: `${Math.min(100, (totalDisbursed / selectedStaff.baseSalary) * 100)}%`,
                      backgroundColor: isFullyDisbursed ? '#059669' : totalDisbursed > 0 ? '#f59e0b' : '#dc2626'
                    }}
                  />
                </div>
              </div>

              {/* Numbers */}
              <div className="px-5 py-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-100">
                    <span className="text-[9px] text-emerald-600 font-bold block uppercase">Already Disbursed (প্রদানকৃত)</span>
                    <span className="text-base font-black text-emerald-700 font-mono">৳{totalDisbursed.toLocaleString()}</span>
                  </div>
                  <div className={`rounded-lg p-3 border ${isFullyDisbursed ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                    <span className={`text-[9px] font-bold block uppercase ${isFullyDisbursed ? 'text-emerald-600' : 'text-red-500'}`}>Still Due (বাকি)</span>
                    <span className={`text-base font-black font-mono ${isFullyDisbursed ? 'text-emerald-700' : 'text-red-600'}`}>৳{remaining.toLocaleString()}</span>
                  </div>
                </div>

                {/* Input or Fully Disbursed */}
                {!isFullyDisbursed ? (
                  <div className="pt-2 border-t border-stone-100">
                    <label className="block text-[11px] font-bold text-[#4a5d4e] mb-2">
                      Amount to disburse now (এখন কত প্রদান করছেন)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg font-black text-stone-300 font-mono">৳</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        required
                        placeholder={remaining.toLocaleString()}
                        value={disburseData.amount}
                        onChange={(e) => setDisburseData({ ...disburseData, amount: e.target.value })}
                        className="w-full text-xl font-black border-2 border-[#4a5d4e] rounded-lg pl-8 pr-3 py-2.5 focus:outline-none focus:border-[#3d4d41] text-[#4a5d4e] font-mono bg-white"
                      />
                    </div>
                    <p className="text-[10px] text-stone-400 mt-1 italic">Leave empty to disburse full remaining amount (৳{remaining.toLocaleString()})</p>

                    {sendingNow > 0 && sendingNow < remaining && (
                      <div className="mt-2 flex items-center gap-1.5 text-[10px]">
                        <Clock className="h-3 w-3 text-amber-500" />
                        <span className="text-stone-500">After this: <strong className="text-red-600 font-mono">৳{newRemaining.toLocaleString()}</strong> will still be due</span>
                      </div>
                    )}
                    {sendingNow >= remaining && sendingNow > 0 && (
                      <div className="mt-2 flex items-center gap-1.5 text-[10px]">
                        <BadgeCheck className="h-3 w-3 text-emerald-500" />
                        <span className="text-emerald-600 font-bold">Full salary will be disbursed!</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-5 text-center border-t border-stone-100">
                    <BadgeCheck className="h-10 w-10 text-emerald-400 mx-auto mb-2" />
                    <p className="text-sm font-bold text-emerald-700">Fully Disbursed (সম্পূর্ণ প্রদানকৃত)</p>
                    <p className="text-[10px] text-emerald-500 mt-0.5">No further disbursement needed for this month.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setSelectedStaff(null)}
                className="bg-white hover:bg-stone-50 border border-stone-200 text-stone-700 text-xs px-4 py-2 rounded-lg cursor-pointer font-medium"
              >
                Back
              </button>
              {!isFullyDisbursed && paymentMethods.length > 0 && (
                <button
                  type="button"
                  onClick={handleDisburseSubmit}
                  disabled={!disburseData.method}
                  className="bg-[#4a5d4e] hover:bg-[#3d4d41] disabled:bg-[#6a7d6e] text-white text-xs font-bold px-6 py-2.5 rounded-lg shadow-sm active:scale-95 cursor-pointer border border-[#3d4d41] flex items-center gap-1.5"
                >
                  <Send className="h-3.5 w-3.5" />
                  {disburseData.method ? `Confirm Disbursement via ${disburseData.method}` : 'Select a Method First'}
                </button>
              )}
            </div>
          </div>
        </div>
        );
      })()}

      {/* ===== MODAL: REGISTER TEACHER ACCOUNT (from onboarding) ===== */}
      {regAccount && (
        <div className="fixed inset-0 bg-[#2c332d]/40 backdrop-blur-xs flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-xl border border-stone-200 shadow-xl max-w-md w-full overflow-hidden">
            <div className="bg-amber-600 text-white p-4 border-b border-amber-700 flex justify-between items-center">
              <h3 className="font-serif font-bold text-sm flex items-center gap-1.5">
                <UserPlus className="h-4.5 w-4.5" />
                Register Teacher
              </h3>
              <button onClick={() => setRegAccount(null)} className="text-white/80 hover:text-white font-bold cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Details */}
              <div className="bg-[#f5f2ed]/60 rounded-lg border border-stone-200 p-3 space-y-1.5">
                <p className="text-xs font-bold text-[#2c332d] flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-stone-400" /> {regAccount.fullName}
                </p>
                <p className="text-[10px] text-stone-500 flex items-center gap-1.5">
                  <BadgeCheck className="h-3 w-3 text-stone-400" /> {regAccount.designation || '—'}
                </p>
                {regAccount.email && (
                  <p className="text-[10px] text-stone-400 flex items-center gap-1.5">
                    <Mail className="h-3 w-3 text-stone-400" /> {regAccount.email}
                  </p>
                )}
                {regAccount.bio && (
                  <p className="text-[10px] text-stone-500 italic border-t border-stone-200 pt-1.5">{regAccount.bio}</p>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-700 mb-1">
                  Monthly Salary (মাসিক বেতন) ৳ *
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  required
                  autoFocus
                  placeholder="12000"
                  value={regSalary}
                  onChange={(e) => setRegSalary(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-200 rounded-lg text-xs px-3 py-2.5 focus:outline-none focus:border-amber-500 font-mono font-bold"
                />
              </div>

              {regError && (
                <p className="text-[11px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5">{regError}</p>
              )}

              <div className="flex justify-end gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setRegAccount(null)}
                  className="bg-white hover:bg-stone-50 border border-stone-200 text-stone-700 text-xs px-4 py-2 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const salary = parseInt(regSalary, 10);
                    if (!regSalary || isNaN(salary) || salary < 0) {
                      setRegError('Please enter a valid Monthly Salary.');
                      return;
                    }
                    onRegisterTeacherAccount(regAccount.id, salary);
                    setRegAccount(null);
                  }}
                  className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-5 py-2 rounded-lg shadow-sm cursor-pointer border border-amber-700 flex items-center gap-1.5"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Register (নিবন্ধন)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>

    {/* ===== Class Routine Modal (admin adds/deletes per teacher) ===== */}
    {routineTeacher && !readOnly && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
        onClick={() => setRoutineTeacher(null)}
      >
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-stone-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-stone-100 px-5 py-4 flex items-center justify-between rounded-t-2xl">
            <div className="min-w-0">
              <h3 className="text-sm font-serif font-bold text-[#2c332d] flex items-center gap-2">
                <Calendar className="h-4 w-4 text-[#4a5d4e]" />
                Class Routine for {routineTeacher.fullName}
              </h3>
              <p className="text-[11px] text-stone-500 mt-0.5">{routineTeacher.designation || 'Teacher'}</p>
            </div>
            <button
              onClick={() => setRoutineTeacher(null)}
              className="p-1.5 hover:bg-stone-100 rounded-lg cursor-pointer transition-all text-stone-500"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 space-y-5">
            {/* Existing routines */}
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-stone-400 mb-2">
                Current Routines ({currentTeacherRoutines.length})
              </p>
              {currentTeacherRoutines.length === 0 ? (
                <p className="text-xs text-stone-400 italic">No routines added yet.</p>
              ) : (
                <div className="space-y-2">
                  {currentTeacherRoutines.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center justify-between gap-3 border border-stone-200 rounded-xl px-3 py-2 bg-[#fdfbf7]"
                    >
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-0.5 text-[11px] flex-1">
                        {r.time && <span className="font-mono font-bold text-[#2c332d]">{r.time}</span>}
                        {r.class && <span><span className="text-stone-400">Class (শ্রেণী):</span> {r.class}</span>}
                        {r.subject && <span><span className="text-stone-400">Subject (বিষয়):</span> {r.subject}</span>}
                        {r.restTime && <span><span className="text-stone-400">Rest (বিশ্রাম):</span> {r.restTime}</span>}
                      </div>
                      <button
                        onClick={() => handleDeleteRoutine(r.id)}
                        className="shrink-0 p-1.5 text-red-500 hover:bg-red-50 rounded-lg cursor-pointer transition-all"
                        title="Delete routine"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add new routine */}
            <div className="border-t border-stone-100 pt-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-stone-400 mb-2">Add New Routine</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-stone-500 mb-1">Time (সময়)</label>
                  <input
                    type="text"
                    value={routineDraft.time}
                    onChange={(e) => setRoutineDraft({ ...routineDraft, time: e.target.value })}
                    placeholder="e.g. 8:00-9:00"
                    className="w-full px-2.5 py-2 rounded-lg border border-stone-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#4a5d4e]/30 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-stone-500 mb-1">Class (শ্রেণী)</label>
                  <input
                    type="text"
                    value={routineDraft.class}
                    onChange={(e) => setRoutineDraft({ ...routineDraft, class: e.target.value })}
                    placeholder="e.g. Hifz 1"
                    className="w-full px-2.5 py-2 rounded-lg border border-stone-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#4a5d4e]/30"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-stone-500 mb-1">Subject (বিষয়)</label>
                  <input
                    type="text"
                    value={routineDraft.subject}
                    onChange={(e) => setRoutineDraft({ ...routineDraft, subject: e.target.value })}
                    placeholder="e.g. Quran"
                    className="w-full px-2.5 py-2 rounded-lg border border-stone-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#4a5d4e]/30"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-stone-500 mb-1">Rest Time (বিশ্রাম)</label>
                  <input
                    type="text"
                    value={routineDraft.restTime}
                    onChange={(e) => setRoutineDraft({ ...routineDraft, restTime: e.target.value })}
                    placeholder="e.g. 10:00-10:15"
                    className="w-full px-2.5 py-2 rounded-lg border border-stone-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#4a5d4e]/30 font-mono"
                  />
                </div>
              </div>
              <button
                onClick={handleAddRoutine}
                className="mt-3 w-full bg-[#4a5d4e] hover:bg-[#3d4d41] text-white text-xs font-bold px-4 py-2.5 rounded-lg shadow-sm active:scale-95 cursor-pointer border border-[#3d4d41] flex items-center justify-center gap-1.5"
              >
                <Plus className="h-4 w-4 text-[#d9c5b2]" />
                Add Routine Entry
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-white border-t border-stone-100 px-5 py-3 flex justify-end rounded-b-2xl">
            <button
              onClick={() => setRoutineTeacher(null)}
              className="bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold px-4 py-2.5 rounded-lg transition-all active:scale-95 cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    )}

    {/* ===== Teacher Leave Modal (admin sets leave period) ===== */}
    {leaveTeacher && !readOnly && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
        onClick={() => setLeaveTeacher(null)}
      >
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto border border-stone-200"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="sticky top-0 bg-white border-b border-stone-100 px-5 py-4 flex items-center justify-between rounded-t-2xl">
            <div className="min-w-0">
              <h3 className="text-sm font-serif font-bold text-[#2c332d] flex items-center gap-2">
                <CalendarPlus className="h-4 w-4 text-indigo-600" />
                Set Leave (ছুটি নির্ধারণ) — {leaveTeacher.fullName}
              </h3>
              <p className="text-[11px] text-stone-500 mt-0.5">{leaveTeacher.designation || 'Teacher'}</p>
            </div>
            <button
              onClick={() => setLeaveTeacher(null)}
              className="p-1.5 hover:bg-stone-100 rounded-lg cursor-pointer transition-all text-stone-500"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-4 sm:p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-stone-500 mb-1">Start Date (শুরুর তারিখ)</label>
                <input
                  type="date"
                  value={leaveDraft.startDate}
                  onChange={(e) => setLeaveDraft({ ...leaveDraft, startDate: e.target.value })}
                  className="w-full px-2.5 py-2 rounded-lg border border-stone-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-stone-500 mb-1">End Date (শেষ তারিখ)</label>
                <input
                  type="date"
                  value={leaveDraft.endDate}
                  min={leaveDraft.startDate}
                  onChange={(e) => setLeaveDraft({ ...leaveDraft, endDate: e.target.value })}
                  className="w-full px-2.5 py-2 rounded-lg border border-stone-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-stone-500 mb-1">Notes (নোট) — optional</label>
              <textarea
                value={leaveDraft.notes}
                onChange={(e) => setLeaveDraft({ ...leaveDraft, notes: e.target.value })}
                rows={3}
                placeholder="e.g. Family event, medical leave…"
                className="w-full px-2.5 py-2 rounded-lg border border-stone-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/30 resize-none"
              />
            </div>
          </div>

          <div className="sticky bottom-0 bg-white border-t border-stone-100 px-5 py-3 flex justify-end gap-2 rounded-b-2xl">
            <button
              onClick={() => setLeaveTeacher(null)}
              className="bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold px-4 py-2.5 rounded-lg transition-all active:scale-95 cursor-pointer"
            >
              Cancel (বাতিল)
            </button>
            <button
              onClick={handleAddLeave}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2.5 rounded-lg shadow-sm active:scale-95 cursor-pointer border border-indigo-700 flex items-center justify-center gap-1.5"
            >
              <CalendarPlus className="h-4 w-4 text-indigo-100" />
              Save Leave (সংরক্ষণ)
            </button>
          </div>
        </div>
      </div>
    )}

    {/* ===== Reject Teacher Modal ===== */}
    {rejectAccount && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
        onClick={() => setRejectAccount(null)}
      >
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-stone-200"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="sticky top-0 bg-white border-b border-stone-100 px-5 py-4 flex items-center justify-between rounded-t-2xl">
            <div className="min-w-0">
              <h3 className="text-sm font-serif font-bold text-[#2c332d] flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-600" />
                Reject Registration (নিবন্ধন বাতিল)
              </h3>
              <p className="text-[11px] text-stone-500 mt-0.5">{rejectAccount.fullName}</p>
            </div>
            <button
              onClick={() => setRejectAccount(null)}
              className="p-1.5 hover:bg-stone-100 rounded-lg cursor-pointer transition-all text-stone-500"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-4 sm:p-5 space-y-3">
            <label className="block text-[10px] font-bold text-stone-500 mb-1">
              Rejection Reason (বাতিলের কারণ) — required
            </label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
              placeholder="e.g. Documents incomplete, contact the madrasah office…"
              className="w-full px-2.5 py-2 rounded-lg border border-stone-200 text-xs focus:outline-none focus:ring-2 focus:ring-red-500/30 resize-none"
            />
          </div>

          <div className="sticky bottom-0 bg-white border-t border-stone-100 px-5 py-3 flex justify-end gap-2 rounded-b-2xl">
            <button
              onClick={() => setRejectAccount(null)}
              className="bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold px-4 py-2.5 rounded-lg transition-all active:scale-95 cursor-pointer"
            >
              Cancel (বাতিল)
            </button>
            <button
              onClick={handleRejectConfirm}
              className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-4 py-2.5 rounded-lg shadow-sm active:scale-95 cursor-pointer border border-red-700 flex items-center justify-center gap-1.5"
            >
              <XCircle className="h-4 w-4" />
              Confirm Reject (নিশ্চিত বাতিল)
            </button>
          </div>
        </div>
      </div>
    )}

    {profileTeacher && !readOnly && (
      <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-xl border border-stone-200 w-full max-w-lg p-5 space-y-4">
          <div className="flex items-center justify-between"><h3 className="text-sm font-bold">Edit Teacher Profile</h3><button onClick={() => setProfileTeacher(null)} className="text-stone-500" title="Close"><X className="h-4 w-4" /></button></div>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="text-xs font-bold">Full Name<input value={profileDraft.fullName} onChange={(e) => setProfileDraft({ ...profileDraft, fullName: e.target.value })} className="mt-1 w-full border rounded-lg px-3 py-2 font-normal" /></label>
            <label className="text-xs font-bold">Designation<input value={profileDraft.designation} onChange={(e) => setProfileDraft({ ...profileDraft, designation: e.target.value })} className="mt-1 w-full border rounded-lg px-3 py-2 font-normal" /></label>
            <label className="text-xs font-bold">Phone Number<input type="tel" value={profileDraft.contact} onChange={(e) => setProfileDraft({ ...profileDraft, contact: e.target.value })} className="mt-1 w-full border rounded-lg px-3 py-2 font-normal" /></label>
            <label className="text-xs font-bold">Email<input type="email" value={profileDraft.email} onChange={(e) => setProfileDraft({ ...profileDraft, email: e.target.value })} className="mt-1 w-full border rounded-lg px-3 py-2 font-normal" /></label>
            <label className="text-xs font-bold sm:col-span-2">Profile Image Link<input type="url" value={profileDraft.photoUrl} onChange={(e) => setProfileDraft({ ...profileDraft, photoUrl: e.target.value })} className="mt-1 w-full border rounded-lg px-3 py-2 font-normal" /></label>
            <label className="text-xs font-bold sm:col-span-2">Bio<textarea value={profileDraft.bio} onChange={(e) => setProfileDraft({ ...profileDraft, bio: e.target.value })} className="mt-1 w-full border rounded-lg px-3 py-2 font-normal h-20" /></label>
          </div>
          <div className="flex justify-end gap-2"><button onClick={() => setProfileTeacher(null)} className="border rounded-lg px-4 py-2 text-xs font-bold">Cancel</button><button onClick={saveTeacherProfile} className="bg-[#4a5d4e] text-white rounded-lg px-4 py-2 text-xs font-bold">Save Teacher Profile</button></div>
        </div>
      </div>
    )}

    {guardAction && (
      <PasswordConfirmModal
        isOpen={true}
        onClose={() => setGuardAction(null)}
        onConfirm={guardAction.onConfirm}
        actionLabel={guardAction.label}
      />
    )}

    {lightbox && (
      <PhotoLightbox src={lightbox.src} name={lightbox.name} onClose={() => setLightbox(null)} />
    )}
    </>
  );
}
