import React, { useState } from 'react';
import logo2 from '../assets/images/logo2.png';
import { LogOut, User, BadgeCheck, Mail, FileText, ArrowLeft, CheckCircle2, Settings, AlertTriangle, X, ChartNoAxesCombined, Clock, CalendarCheck } from 'lucide-react';
import { AttendanceRecord, TeacherAccount, TeacherPortalSession, TeacherStaff } from '../types';
import { formatAttendanceTime, todayISO } from '../lib/attendance';

interface TeacherSettingsProps {
  session: TeacherPortalSession;
  account?: TeacherAccount;
  staffRecord?: TeacherStaff;
  attendanceRecords: AttendanceRecord[];
  onBack: () => void;
  onLogout: () => void;
  onRequestResign: (teacherId: string, reason?: string) => void;
}

export default function TeacherSettings({ session, account, staffRecord, attendanceRecords, onBack, onLogout, onRequestResign }: TeacherSettingsProps) {
  const initial = (account?.fullName || session.fullName || 'T').trim().charAt(0).toUpperCase();

  const [showResign, setShowResign] = useState(false);
  const [resignReason, setResignReason] = useState('');
  const [resignSubmitted, setResignSubmitted] = useState(false);
  const [attendanceAnalysisOpen, setAttendanceAnalysisOpen] = useState(false);
  const personalRecords = [...attendanceRecords].sort((a, b) => b.date.localeCompare(a.date));
  const todayRecord = personalRecords.find((record) => record.date === todayISO());
  const last14Days = Array.from({ length: 14 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (13 - index));
    const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return { date: iso, record: personalRecords.find((record) => record.date === iso) };
  });
  const earlyCount = personalRecords.filter((record) => record.arrivalStatus === 'early').length;
  const onTimeCount = personalRecords.filter((record) => record.arrivalStatus === 'on-time').length;
  const lateCount = personalRecords.filter((record) => record.arrivalStatus === 'late').length;
  const classifiedCount = earlyCount + onTimeCount + lateCount;
  const donutBackground = classifiedCount
    ? `conic-gradient(#0d9488 0 ${earlyCount / classifiedCount * 100}%, #22c55e ${earlyCount / classifiedCount * 100}% ${(earlyCount + onTimeCount) / classifiedCount * 100}%, #f97316 ${(earlyCount + onTimeCount) / classifiedCount * 100}% 100%)`
    : '#e7e5e4';

  const rows = [
    { icon: <User className="h-4 w-4 text-stone-400 mt-0.5 shrink-0" />, label: 'Full Name', value: account?.fullName || '—' },
    { icon: <BadgeCheck className="h-4 w-4 text-stone-400 mt-0.5 shrink-0" />, label: 'Designation', value: account?.designation || '—' },
    { icon: <Mail className="h-4 w-4 text-stone-400 mt-0.5 shrink-0" />, label: 'Email', value: account?.email || session.email || '—' },
  ];

  const confirmResign = () => {
    if (!account) return;
    onRequestResign(account.id, resignReason);
    setShowResign(false);
    setResignReason('');
    setResignSubmitted(true);
  };

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
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-stone-100 text-xs font-bold px-3 py-2 rounded-lg border border-white/20 cursor-pointer transition-all active:scale-95"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Back</span>
            </button>
            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-stone-100 text-xs font-bold px-3 py-2 rounded-lg border border-white/20 cursor-pointer transition-all active:scale-95"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-5 sm:py-7 space-y-5">
        {/* Profile hero */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-[#4a5d4e] text-[#d9c5b2] flex items-center justify-center text-2xl font-serif font-bold shrink-0">
            {initial}
          </div>
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-widest text-stone-400 font-bold">My Profile</p>
            <h1 className="text-lg sm:text-xl font-serif font-bold text-[#2c332d] truncate">
              {account?.fullName || session.fullName}
            </h1>
            {account?.designation && (
              <p className="text-xs text-[#4a5d4e] font-semibold flex items-center gap-1">
                <BadgeCheck className="h-3.5 w-3.5" /> {account.designation}
              </p>
            )}
          </div>
          {staffRecord && (
            <span className="ml-auto shrink-0 inline-flex items-center gap-1 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold px-2.5 py-1.5 rounded-full">
              <CheckCircle2 className="h-3.5 w-3.5" /> Registered
            </span>
          )}
        </div>

        {/* Settings heading */}
        <div className="flex items-center gap-2 px-1">
          <Settings className="h-5 w-5 text-[#4a5d4e]" />
          <h2 className="text-base font-serif font-bold text-[#2c332d]">Settings</h2>
        </div>

        <button
          type="button"
          onClick={() => setAttendanceAnalysisOpen((open) => !open)}
          className="w-full bg-white rounded-2xl border border-stone-200 shadow-sm p-4 flex items-center justify-between text-left hover:border-[#4a5d4e]"
        >
          <span className="flex items-center gap-2 text-sm font-bold text-[#2c332d]"><ChartNoAxesCombined className="h-4 w-4 text-[#4a5d4e]" /> Attendance Analysis (উপস্থিতির বিশ্লেষণ)</span>
          <span className="text-xs font-semibold text-[#4a5d4e]">{attendanceAnalysisOpen ? 'Hide' : 'Open'}</span>
        </button>

        {attendanceAnalysisOpen && (
          <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 space-y-5">
            <div>
              <h3 className="text-sm font-bold text-[#2c332d]">My Attendance (আমার উপস্থিতি)</h3>
              <p className="text-[11px] text-stone-500 mt-1">Attendance based on your recorded QR scans. Days without records are not assumed absent.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3">
                <p className="text-[10px] font-bold text-emerald-700">Recorded attendance days</p>
                <p className="text-xl font-black text-emerald-800">{personalRecords.length}</p>
              </div>
              <div className="rounded-xl bg-sky-50 border border-sky-200 p-3">
                <p className="text-[10px] font-bold text-sky-700">Checked-out days</p>
                <p className="text-xl font-black text-sky-800">{personalRecords.filter((record) => record.exitTime).length}</p>
              </div>
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-3">
                <p className="text-[10px] font-bold text-amber-700">Late arrivals</p>
                <p className="text-xl font-black text-amber-800">{lateCount}</p>
              </div>
            </div>
            <div className="grid sm:grid-cols-[auto_1fr] gap-5 items-center">
              <div className="relative h-36 w-36 rounded-full mx-auto" style={{ background: donutBackground }} role="img" aria-label={`Arrival classification: ${earlyCount} early, ${onTimeCount} on time, ${lateCount} late`}>
                <div className="absolute inset-5 rounded-full bg-white flex flex-col items-center justify-center">
                  <span className="text-2xl font-black text-[#2c332d]">{classifiedCount}</span>
                  <span className="text-[9px] font-bold text-stone-500">CLASSIFIED</span>
                </div>
              </div>
              <div className="space-y-2 text-xs">
                <p className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-teal-600" /> Early: <strong>{earlyCount}</strong></p>
                <p className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-green-500" /> On time: <strong>{onTimeCount}</strong></p>
                <p className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-orange-500" /> Late: <strong>{lateCount}</strong></p>
                {!classifiedCount && <p className="text-stone-500">Arrival classifications will appear after your next attendance scan.</p>}
              </div>
            </div>
            <div>
              <p className="text-xs font-bold text-[#2c332d] mb-3">Last 14 days</p>
              <div className="flex items-end gap-1.5 h-28 border-b border-stone-200">
                {last14Days.map(({ date, record }) => (
                  <div key={date} className="flex-1 h-full flex flex-col justify-end items-center gap-1" title={`${date}: ${record?.entryTime ? formatAttendanceTime(record.entryTime) : 'No scan recorded'}`}>
                    <div
                      className={`w-full max-w-5 rounded-t ${record?.arrivalStatus === 'late' ? 'bg-orange-500' : record?.arrivalStatus === 'early' ? 'bg-teal-600' : record ? 'bg-green-500' : 'bg-stone-100'}`}
                      style={{ height: record ? '75%' : '8%' }}
                    />
                    <span className="text-[8px] text-stone-500">{date.slice(8)}</span>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-3 mt-2 text-[9px] text-stone-500"><span>Green: on time / not classified</span><span className="text-teal-700">Teal: early</span><span className="text-orange-600">Orange: late</span></div>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-bold text-[#2c332d]">Recent attendance details</p>
              {personalRecords.slice(0, 14).map((record) => (
                <div key={record.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-stone-50 border border-stone-100 px-3 py-2 text-[11px]">
                  <span className="font-mono font-bold text-stone-600">{record.date}</span>
                  <span className="flex items-center gap-1 text-stone-600"><Clock className="h-3 w-3" />{record.entryTime ? formatAttendanceTime(record.entryTime) : '—'}{record.exitTime ? ` → ${formatAttendanceTime(record.exitTime)}` : ''}</span>
                  <span className={`font-bold ${record.arrivalStatus === 'late' ? 'text-orange-600' : record.arrivalStatus === 'early' ? 'text-teal-700' : 'text-emerald-700'}`}>{record.arrivalStatus || (record.entryTime ? 'Recorded' : 'No arrival')}</span>
                </div>
              ))}
              {!personalRecords.length && <p className="text-xs text-stone-500">No attendance records yet.</p>}
            </div>
            {todayRecord?.entryTime && <p className="flex items-center gap-2 rounded-lg bg-[#f5f2ed] px-3 py-2 text-xs text-[#4a5d4e]"><CalendarCheck className="h-4 w-4" /> Today: arrived at {formatAttendanceTime(todayRecord.entryTime)}{todayRecord.exitTime ? ` and left at ${formatAttendanceTime(todayRecord.exitTime)}` : ''}</p>}
          </section>
        )}

        {/* Profile details card (read-only) */}
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
          <div className="space-y-2.5 text-xs">
            {rows.map((r) => (
              <div key={r.label} className="flex items-start gap-2.5 text-stone-600">
                {r.icon}
                <span className="break-words">
                  <span className="text-stone-400">{r.label}:</span> {r.value}
                </span>
              </div>
            ))}
            {account?.bio && (
              <div className="flex items-start gap-2.5 text-stone-600">
                <FileText className="h-4 w-4 text-stone-400 mt-0.5 shrink-0" />
                <span className="break-words">
                  <span className="text-stone-400">Bio:</span> {account.bio}
                </span>
              </div>
            )}
            <div className="flex items-start gap-2.5 text-stone-600">
              <CheckCircle2 className={`h-4 w-4 mt-0.5 shrink-0 ${staffRecord ? 'text-emerald-500' : 'text-stone-400'}`} />
              <span className="break-words">
                <span className="text-stone-400">Status:</span>{' '}
                {staffRecord ? (
                  <span className="text-emerald-600 font-bold">Registered ✓</span>
                ) : (
                  <span className="text-amber-600 font-bold">Pending Registration</span>
                )}
              </span>
            </div>
          </div>
        </div>

        {!staffRecord && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-start gap-2.5">
            <BadgeCheck className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-[11px] text-amber-800 leading-relaxed">
              Your account is pending <span className="font-bold">admin registration</span>. Once the admin registers you
              from <span className="font-bold">Salary Disbursement → Pending Reg (নিবন্ধন) tab</span>, your profile will show the
              Registered status.
            </p>
          </div>
        )}

        {/* Resignation success state */}
        {resignSubmitted ? (
          <div className="bg-white rounded-2xl border border-emerald-200 shadow-sm p-6 text-center">
            <div className="mx-auto w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mb-3">
              <CheckCircle2 className="h-7 w-7 text-emerald-600" />
            </div>
            <h3 className="text-base font-serif font-bold text-[#2c332d]">Request Sent (অনুরোধ পাঠানো হয়েছে)</h3>
            <p className="text-[11px] text-stone-600 leading-relaxed mt-2">
              Your request has been sent. The supervisor will review and approve it. We are sorry to see you leave our school
              and we hope you can visit us again if possible.
            </p>
            <p className="text-[11px] text-stone-500 leading-relaxed mt-1">
              আপনার অনুরোধ পাঠানো হয়েছে। সুপারভাইজার তা পর্যালোচনা করে অনুমোদন করবেন। আমরা দুঃখিত যে আপনি আমাদের স্কুল ছেড়ে যাচ্ছেন এবং আশা করি সম্ভব হলে আপনি আবার আসবেন।
            </p>
            <button
              onClick={onLogout}
              className="mt-4 flex items-center gap-1.5 mx-auto bg-[#4a5d4e] hover:bg-[#3d4d41] text-white text-xs font-bold px-5 py-2.5 rounded-lg shadow-sm active:scale-95 cursor-pointer border border-[#3d4d41]"
            >
              <LogOut className="h-3.5 w-3.5" />
              Logout (লগআউট)
            </button>
          </div>
        ) : (
          /* Leave School (red) */
          <button
            onClick={() => setShowResign(true)}
            className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold px-4 py-3 rounded-2xl shadow-sm active:scale-[0.98] cursor-pointer border border-red-700"
          >
            <AlertTriangle className="h-4 w-4" />
            Leave School — Cancel Participation (স্কুল ছাড়ুন)
          </button>
        )}
      </main>

      {/* Resignation confirmation modal */}
      {showResign && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#2c332d]/60 backdrop-blur-sm" onClick={() => setShowResign(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl border border-stone-200 w-full max-w-md overflow-hidden">
            <div className="relative bg-gradient-to-br from-red-700 via-red-600 to-red-500 px-6 py-5 text-center">
              <button
                onClick={() => setShowResign(false)}
                className="absolute top-3 right-3 text-white/80 hover:text-white transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="mx-auto w-14 h-14 rounded-full bg-white/15 border border-white/20 flex items-center justify-center mb-3">
                <AlertTriangle className="h-7 w-7 text-white" />
              </div>
              <h3 className="text-sm font-serif font-bold text-white">Leave School? (স্কুল ছাড়বেন?)</h3>
            </div>
            <div className="px-6 py-5 space-y-4">
              <p className="text-[11px] text-stone-600 leading-relaxed">
                This sends a resignation request to the supervisor. You will no longer be marked as teaching.
              </p>
              <p className="text-[11px] text-stone-500 leading-relaxed">
                এটি সুপারভাইজারের কাছে পদত্যাগের অনুরোধ পাঠাবে। আপনি আর শিক্ষক হিসেবে চিহ্নিত থাকবেন না।
              </p>
              <div>
                <label className="block text-[11px] font-bold text-stone-600 mb-1">
                  Reason (optional) / কারণ (ঐচ্ছিক)
                </label>
                <textarea
                  value={resignReason}
                  onChange={(e) => setResignReason(e.target.value)}
                  placeholder="Let us know why you are leaving…"
                  className="w-full bg-stone-50 border border-stone-200 rounded-lg text-xs px-3 py-2 focus:outline-none focus:border-[#4a5d4e] h-20 resize-none"
                />
              </div>
              <div className="flex gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setShowResign(false)}
                  className="flex-1 bg-white hover:bg-stone-50 border border-stone-200 text-stone-600 text-xs font-bold py-2.5 rounded-lg transition-all cursor-pointer"
                >
                  Cancel (বাতিল)
                </button>
                <button
                  type="button"
                  onClick={confirmResign}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white text-xs font-bold py-2.5 rounded-lg shadow-sm transition-all cursor-pointer active:scale-[0.98] flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Yes, I confirm (হ্যাঁ, নিশ্চিত)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
