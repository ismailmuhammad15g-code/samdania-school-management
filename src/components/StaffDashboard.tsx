import React, { useMemo, useState } from 'react';
import logo2 from '../assets/images/logo2.png';
import { BadgeCheck, CalendarClock, Clock, LogOut, UserRound } from 'lucide-react';
import type { AttendanceQRSet, AttendanceRecord, SalaryPayment, StaffAccount, TeacherLeave, TeacherStaff } from '../types';
import type { AttendanceScanResult } from '../lib/attendance';
import AttendanceSection from './AttendanceSection';
import StaffNoticeboard from './StaffNoticeboard';
import { getSalaryBalance } from '../lib/salary';

interface StaffDashboardProps {
  account: StaffAccount;
  staffRecord?: TeacherStaff;
  salaryPayments: SalaryPayment[];
  leaves: TeacherLeave[];
  qrSet: AttendanceQRSet | null;
  attendanceRecords: AttendanceRecord[];
  onScan: (raw: string) => AttendanceScanResult;
  onRequestLeave: (leave: Omit<TeacherLeave, 'id'>) => void;
  onLogout: () => void;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function StaffDashboard({
  account,
  staffRecord,
  salaryPayments,
  leaves,
  qrSet,
  attendanceRecords,
  onScan,
  onRequestLeave,
  onLogout,
}: StaffDashboardProps) {
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [leaveError, setLeaveError] = useState('');
  const [salaryVisible, setSalaryVisible] = useState(true);
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const myLeaves = leaves.filter((leave) => leave.teacherId === account.id).sort((a, b) => (b.requestedAt || '').localeCompare(a.requestedAt || ''));
  const pendingLeave = myLeaves.find((leave) => leave.status === 'pending');
  const todayRecord = attendanceRecords.find((record) => record.teacherId === account.id && record.date === today) || null;
  const paidThisMonth = staffRecord
    ? salaryPayments.filter((payment) => payment.teacherStaffId === staffRecord.id && payment.month === MONTHS[now.getMonth()] && payment.year === now.getFullYear()).reduce((sum, payment) => sum + payment.netPaid, 0)
    : 0;
  const remaining = useMemo(() => {
    if (!staffRecord) return 0;
    return getSalaryBalance(staffRecord, salaryPayments, MONTHS[now.getMonth()], now.getFullYear(), account.createdAt).remaining;
  }, [account.createdAt, now, salaryPayments, staffRecord]);

  const submitLeave = (event: React.FormEvent) => {
    event.preventDefault();
    setLeaveError('');
    if (!startDate || !endDate || endDate < startDate) {
      setLeaveError('Choose valid leave dates. (সঠিক ছুটির তারিখ নির্বাচন করুন)');
      return;
    }
    if (pendingLeave) {
      setLeaveError('You already have a pending request. (আপনার একটি আবেদন অপেক্ষমাণ আছে)');
      return;
    }
    onRequestLeave({
      teacherId: account.id,
      startDate,
      endDate,
      notes: notes.trim() || undefined,
      status: 'pending',
      requestedAt: new Date().toISOString(),
    });
    setStartDate('');
    setEndDate('');
    setNotes('');
    setLeaveOpen(false);
  };

  return (
    <div className="min-h-screen w-full bg-[#fdfbf7]">
      <header className="sticky top-0 z-30 bg-gradient-to-r from-[#4a5d4e] to-[#3d4d41] text-white shadow-md">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <img src={logo2} alt="Samdania Madrasah" className="w-9 h-9 object-contain" />
            <div><p className="text-xs font-bold">Samdania Madrasah</p><p className="text-[10px] text-[#d9c5b2]">Staff Portal · স্টাফ পোর্টাল</p></div>
          </div>
          <button onClick={onLogout} className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold px-3 py-2 rounded-lg border border-white/20">
            <LogOut className="h-4 w-4" /> Logout (লগআউট)
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto w-full px-4 py-5 sm:py-7 space-y-5">
        <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 flex items-center gap-4">
          {account.photoUrl ? <img src={account.photoUrl} alt="" className="w-14 h-14 rounded-full object-cover border border-stone-200" /> : <span className="w-14 h-14 rounded-full bg-[#4a5d4e]/10 text-[#4a5d4e] grid place-items-center"><UserRound className="h-7 w-7" /></span>}
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-widest text-stone-400 font-bold">Welcome back (স্বাগতম)</p>
            <h1 className="text-lg font-serif font-bold text-[#2c332d] truncate">{account.fullName}</h1>
            <p className="text-xs font-semibold text-[#4a5d4e]">{account.role} · {account.phone || account.email}</p>
          </div>
        </section>

        <section className="grid sm:grid-cols-2 gap-3">
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
            <p className="text-[10px] uppercase tracking-wide text-emerald-700 font-bold">Monthly Salary (মাসিক বেতন)</p>
            {staffRecord ? <>
              <button onClick={() => setSalaryVisible((value) => !value)} className="text-xl font-black font-mono text-emerald-800 mt-1">
                {salaryVisible ? `৳${staffRecord.baseSalary.toLocaleString()}` : '৳••••'}
              </button>
              {salaryVisible && <div className="grid grid-cols-2 gap-2 mt-3">
                <div className="bg-white/70 rounded-lg p-2"><p className="text-[9px] font-bold text-emerald-700">Received this month (এই মাসে প্রাপ্ত)</p><p className="text-sm font-black text-emerald-800">৳{paidThisMonth.toLocaleString()}</p></div>
                <div className="bg-white/70 rounded-lg p-2"><p className="text-[9px] font-bold text-red-600">Remaining (বাকি)</p><p className="text-sm font-black text-red-700">৳{remaining.toLocaleString()}</p></div>
              </div>}
            </> : <p className="text-xs text-amber-700 font-semibold mt-2"><Clock className="inline h-3.5 w-3.5 mr-1" />Salary record not linked yet (বেতন রেকর্ড যুক্ত হয়নি)</p>}
          </div>
          <div className="bg-white border border-stone-200 rounded-2xl p-4">
            <div className="flex items-center gap-2"><BadgeCheck className="h-4 w-4 text-[#4a5d4e]" /><h2 className="text-xs font-bold text-stone-700">Contact & Profile (যোগাযোগ ও পরিচিতি)</h2></div>
            <p className="text-xs text-stone-600 mt-2">{account.email}</p>
            {account.contactInfo && <p className="text-xs text-stone-600 mt-1 whitespace-pre-wrap">{account.contactInfo}</p>}
            {account.bio && <p className="text-xs text-stone-500 mt-2 whitespace-pre-wrap">{account.bio}</p>}
          </div>
        </section>

        {account.status !== 'approved' ? (
          <section className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
            <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-amber-700" /><h2 className="text-sm font-bold text-amber-900">Account awaiting approval (অ্যাকাউন্ট অনুমোদনের অপেক্ষায়)</h2></div>
            <p className="text-xs text-amber-800 mt-2">An administrator must link your account to the staff salary roster before staff portal features are enabled. (স্টাফ পোর্টাল চালু করতে প্রশাসককে আপনার অ্যাকাউন্ট বেতন তালিকার সাথে যুক্ত করতে হবে।)</p>
          </section>
        ) : <>
        <StaffNoticeboard staffId={account.id} />

        <AttendanceSection
          qrSet={qrSet}
          todayRecord={todayRecord}
          onScan={onScan}
        />

        <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2"><CalendarClock className="h-4 w-4 text-[#4a5d4e]" /><h2 className="text-sm font-serif font-bold text-[#2c332d]">Leave (ছুটি)</h2></div>
            <button onClick={() => setLeaveOpen((value) => !value)} className="bg-[#4a5d4e] text-white text-xs font-bold px-3 py-2 rounded-lg">
              {leaveOpen ? 'Close' : 'Request Leave (ছুটির আবেদন)'}
            </button>
          </div>
          {leaveOpen && <form onSubmit={submitLeave} className="mt-4 space-y-3 border-t border-stone-100 pt-4">
            {leaveError && <p role="alert" className="text-xs text-red-700">{leaveError}</p>}
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="text-[10px] font-bold text-stone-600">Start Date (শুরুর তারিখ)<input type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} className="block w-full mt-1 border border-stone-200 rounded-lg px-3 py-2 text-sm" /></label>
              <label className="text-[10px] font-bold text-stone-600">End Date (শেষ তারিখ)<input type="date" required value={endDate} onChange={(e) => setEndDate(e.target.value)} className="block w-full mt-1 border border-stone-200 rounded-lg px-3 py-2 text-sm" /></label>
            </div>
            <label className="block text-[10px] font-bold text-stone-600">Reason / Note (কারণ / নোট)<textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="block w-full mt-1 border border-stone-200 rounded-lg px-3 py-2 text-sm" /></label>
            <button type="submit" className="bg-[#4a5d4e] text-white text-xs font-bold px-4 py-2 rounded-lg">Send Request (আবেদন পাঠান)</button>
          </form>}
          <div className="mt-3 space-y-2">
            {myLeaves.length === 0 ? <p className="text-xs text-stone-500">No leave requests yet. (এখনো কোনো ছুটির আবেদন নেই)</p> : myLeaves.map((leave) => (
              <div key={leave.id} className="rounded-lg border border-stone-200 p-3 text-xs">
                <div className="flex items-center justify-between gap-2"><strong>{leave.startDate} → {leave.endDate}</strong><span className={`font-bold ${leave.status === 'approved' ? 'text-emerald-700' : leave.status === 'denied' ? 'text-red-700' : 'text-amber-700'}`}>{leave.status || 'approved'}</span></div>
                {leave.notes && <p className="text-stone-600 mt-1">{leave.notes}</p>}
                {leave.adminNote && <p className="text-stone-500 mt-1">Admin note (অ্যাডমিন নোট): {leave.adminNote}</p>}
              </div>
            ))}
          </div>
        </section>
        </>}
      </main>
    </div>
  );
}
