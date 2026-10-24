import React, { useMemo, useState } from 'react';
import { Search, Users, CheckCircle2, LogOut, Clock, XCircle, CalendarCheck, ChevronDown, ChevronUp } from 'lucide-react';
import { TeacherAvatar } from './TeacherPhoto';
import { AttendanceRecord, AttendanceQRSet } from '../types';
import { formatAttendanceTime, todayISO, startOfWeekISO } from '../lib/attendance';

interface TeacherLite {
  id: string;
  fullName: string;
  designation: string;
  photoUrl?: string;
  role?: string;
  email: string;
}

interface AttendanceReportTabProps {
  teachers: TeacherLite[];
  records: AttendanceRecord[];
  qrSet: AttendanceQRSet | null;
  peopleLabel?: string;
}

function fmtTime(iso: string): string {
  return formatAttendanceTime(iso);
}

export default function AttendanceReportTab({ teachers, records, qrSet, peopleLabel = 'Teachers' }: AttendanceReportTabProps) {
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const today = todayISO();
  const weekStart = startOfWeekISO();

  const recordsByTeacher = useMemo(() => {
    const map = new Map<string, AttendanceRecord[]>();
    for (const r of records) {
      if (!map.has(r.teacherId)) map.set(r.teacherId, []);
      map.get(r.teacherId)!.push(r);
    }
    for (const list of map.values()) list.sort((a, b) => (a.date < b.date ? 1 : -1));
    return map;
  }, [records]);

  const visible = teachers.filter(
    (t) =>
      t.fullName.toLowerCase().includes(search.toLowerCase()) ||
      (t.designation || '').toLowerCase().includes(search.toLowerCase())
  );

  const summary = useMemo(() => {
    let present = 0;
    let checkedOut = 0;
    let absent = 0;
    for (const t of teachers) {
      const rec = recordsByTeacher.get(t.id)?.find((r) => r.date === today);
      if (rec?.exitTime) checkedOut++;
      else if (rec?.entryTime) present++;
      else absent++;
    }
    return { present, checkedOut, absent, total: teachers.length };
  }, [teachers, recordsByTeacher, today]);
  const sevenDayTrend = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const daysRecords = records.filter((record) => record.date === iso && record.entryTime);
    return {
      date: iso,
      count: daysRecords.length,
      early: daysRecords.filter((record) => record.arrivalStatus === 'early').length,
      onTime: daysRecords.filter((record) => record.arrivalStatus === 'on-time').length,
      late: daysRecords.filter((record) => record.arrivalStatus === 'late').length,
      unknown: daysRecords.filter((record) => !record.arrivalStatus).length,
    };
  });
  const trendMax = Math.max(1, ...sevenDayTrend.map((day) => day.count));
  const classifiedRecords = records.filter((record) => record.arrivalStatus);
  const punctualityCounts = {
    early: classifiedRecords.filter((record) => record.arrivalStatus === 'early').length,
    onTime: classifiedRecords.filter((record) => record.arrivalStatus === 'on-time').length,
    late: classifiedRecords.filter((record) => record.arrivalStatus === 'late').length,
  };

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-lg border border-stone-200 p-3 shadow-sm">
          <span className="text-[9px] text-stone-400 font-bold uppercase block">{peopleLabel} ({peopleLabel === 'Staff' ? 'স্টাফ' : 'শিক্ষক'})</span>
          <span className="text-lg font-black text-[#2c332d] font-mono">{summary.total}</span>
        </div>
        <div className="bg-emerald-50 rounded-lg border border-emerald-200 p-3 shadow-sm">
          <span className="text-[9px] text-emerald-600 font-bold uppercase block">Present (উপস্থিত)</span>
          <span className="text-lg font-black text-emerald-700 font-mono">{summary.present}</span>
        </div>
        <div className="bg-sky-50 rounded-lg border border-sky-200 p-3 shadow-sm">
          <span className="text-[9px] text-sky-600 font-bold uppercase block">Checked Out (প্রস্থান)</span>
          <span className="text-lg font-black text-sky-700 font-mono">{summary.checkedOut}</span>
        </div>
        <div className={`rounded-lg border p-3 shadow-sm ${summary.absent > 0 ? 'bg-red-50 border-red-200' : 'bg-stone-50 border-stone-200'}`}>
          <span className={`text-[9px] font-bold uppercase block ${summary.absent > 0 ? 'text-red-500' : 'text-stone-400'}`}>Absent (অনুপস্থিত)</span>
          <span className={`text-lg font-black font-mono ${summary.absent > 0 ? 'text-red-600' : 'text-stone-600'}`}>{summary.absent}</span>
        </div>
      </div>

      <section className="bg-white rounded-xl border border-stone-200 shadow-sm p-4 space-y-4">
        <div>
          <h3 className="text-xs font-bold text-[#2c332d]">Attendance Analytics (উপস্থিতির বিশ্লেষণ)</h3>
          <p className="text-[10px] text-stone-500 mt-1">Arrival records for the last 7 days and recorded arrival punctuality.</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-5 items-center">
          <div>
            <p className="text-[10px] font-bold text-stone-500 mb-3">Daily arrivals</p>
            <div className="h-32 flex items-end gap-2 border-b border-stone-200 px-1">
              {sevenDayTrend.map((day) => (
                <div key={day.date} className="flex-1 h-full flex flex-col justify-end items-center gap-1" title={`${day.date}: ${day.count} arrivals`}>
                  <span className="text-[9px] font-bold text-stone-500">{day.count || ''}</span>
                  <div className="w-full max-w-8 flex flex-col-reverse overflow-hidden rounded-t" style={{ height: `${Math.max(day.count ? 12 : 0, day.count / trendMax * 78)}%` }}>
                    {day.unknown > 0 && <div className="bg-stone-400" style={{ height: `${day.unknown / day.count * 100}%` }} />}
                    {day.late > 0 && <div className="bg-orange-500" style={{ height: `${day.late / day.count * 100}%` }} />}
                    {day.onTime > 0 && <div className="bg-green-500" style={{ height: `${day.onTime / day.count * 100}%` }} />}
                    {day.early > 0 && <div className="bg-teal-600" style={{ height: `${day.early / day.count * 100}%` }} />}
                    {!day.count && <div className="h-full bg-stone-100" />}
                  </div>
                  <span className="text-[8px] text-stone-500">{day.date.slice(5)}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-bold text-stone-500 mb-3">Arrival timing — all recorded</p>
            {classifiedRecords.length ? (
              <div className="flex items-center gap-4">
                <div
                  className="relative w-28 h-28 rounded-full shrink-0"
                  style={{ background: `conic-gradient(#0d9488 0 ${punctualityCounts.early / classifiedRecords.length * 100}%, #22c55e ${punctualityCounts.early / classifiedRecords.length * 100}% ${(punctualityCounts.early + punctualityCounts.onTime) / classifiedRecords.length * 100}%, #f97316 ${(punctualityCounts.early + punctualityCounts.onTime) / classifiedRecords.length * 100}% 100%)` }}
                  role="img"
                  aria-label={`${punctualityCounts.early} early, ${punctualityCounts.onTime} on time, ${punctualityCounts.late} late`}
                >
                  <div className="absolute inset-4 rounded-full bg-white flex items-center justify-center text-lg font-black text-[#2c332d]">{classifiedRecords.length}</div>
                </div>
                <div className="space-y-1.5 text-[10px] text-stone-600">
                  <p><span className="text-teal-700">Early:</span> {punctualityCounts.early}</p>
                  <p><span className="text-green-700">On time:</span> {punctualityCounts.onTime}</p>
                  <p><span className="text-orange-600">Late:</span> {punctualityCounts.late}</p>
                </div>
              </div>
            ) : <p className="text-[10px] text-stone-500">Punctuality analysis will appear as teachers scan in under the arrival-time setting.</p>}
          </div>
        </div>
        <div className="flex flex-wrap gap-3 text-[9px] text-stone-500">
          <span className="text-teal-700">Teal: early</span><span className="text-green-700">Green: on time</span><span className="text-orange-600">Orange: late</span><span>Gray: legacy / unclassified</span>
        </div>
      </section>

      {/* Search */}
      <div className="relative w-full">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-stone-400" />
        <input
          type="text"
          placeholder={`Search ${peopleLabel.toLowerCase()} by name or designation...`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-white text-xs border border-stone-200 rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:border-[#4a5d4e]"
        />
      </div>

      {visible.length === 0 ? (
        <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-10 text-center flex flex-col items-center justify-center gap-2">
          <Users className="h-7 w-7 text-stone-300" />
          <p className="text-xs font-bold text-stone-500">No {peopleLabel.toLowerCase()} found</p>
        </div>
      ) : (
        visible.map((t) => {
          const list = recordsByTeacher.get(t.id) || [];
          const todayRec = list.find((r) => r.date === today);
          const weekCount = list.filter((r) => r.date >= weekStart && r.entryTime).length;
          const isOpen = expanded === t.id;
          const status = todayRec?.exitTime
            ? { cls: 'bg-sky-50 text-sky-700 border-sky-200', icon: <LogOut className="h-3 w-3" />, label: 'Checked Out (প্রস্থান)' }
            : todayRec?.entryTime
            ? { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: <CheckCircle2 className="h-3 w-3" />, label: 'Present (উপস্থিত)' }
            : { cls: 'bg-red-50 text-red-700 border-red-200', icon: <XCircle className="h-3 w-3" />, label: 'Absent (অনুপস্থিত)' };

          return (
            <div key={t.id} className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
              <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-bold text-[#2c332d] flex items-center gap-2">
                    <TeacherAvatar account={{ fullName: t.fullName, photoUrl: t.photoUrl }} size={36} />
                    {t.fullName}
                  </p>
                  <p className="text-[11px] text-stone-500 flex items-center gap-1.5">
                    {t.designation || '—'}
                  </p>
                  {t.email && <p className="text-[11px] text-stone-400">{t.email}</p>}
                </div>

                <div className="flex flex-wrap items-center gap-2 justify-end">
                  <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[10px] font-bold border ${status.cls}`}>
                    {status.icon} {status.label}
                  </span>
                  <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#f5f2ed] text-[#4a5d4e] text-[10px] font-bold border border-stone-200">
                    <CalendarCheck className="h-3 w-3" /> {weekCount} this week
                  </span>
                  <button
                    onClick={() => setExpanded(isOpen ? null : t.id)}
                    className="shrink-0 bg-[#4a5d4e] hover:bg-[#3d4d41] text-white text-xs font-bold px-3 py-2 rounded-lg shadow-sm active:scale-95 cursor-pointer border border-[#3d4d41] flex items-center gap-1.5"
                  >
                    {isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    Details
                  </button>
                </div>
              </div>

              {/* Today timing line */}
              {todayRec && (
                <div className="px-4 pb-3 flex flex-wrap gap-x-6 gap-y-1 text-[11px] text-stone-600 border-t border-stone-100 pt-2">
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-emerald-600" />
                    Arrival: <strong className="font-mono">{todayRec.entryTime ? fmtTime(todayRec.entryTime) : '—'}</strong>
                    {todayRec.arrivalStatus && <strong className={`rounded px-1.5 py-0.5 text-[9px] ${todayRec.arrivalStatus === 'late' ? 'bg-orange-100 text-orange-700' : todayRec.arrivalStatus === 'early' ? 'bg-teal-100 text-teal-700' : 'bg-green-100 text-green-700'}`}>{todayRec.arrivalStatus}</strong>}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <LogOut className="h-3.5 w-3.5 text-sky-600" />
                    Departure: <strong className="font-mono">{todayRec.exitTime ? fmtTime(todayRec.exitTime) : '—'}</strong>
                  </span>
                </div>
              )}

              {/* Expandable history (last 7 days) */}
              {isOpen && (
                <div className="px-4 pb-4 border-t border-stone-100">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-stone-400 mb-2">Recent History (সাম্প্রতিক)</p>
                  {list.length === 0 ? (
                    <p className="text-[11px] text-stone-400 italic">No attendance records yet.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {list.slice(0, 14).map((r) => (
                        <div key={r.id} className="flex items-center justify-between bg-stone-50 border border-stone-100 rounded-lg px-2.5 py-1.5">
                          <span className="text-[11px] font-mono font-bold text-stone-600">{r.date}</span>
                          <span className="text-[10px] text-stone-500">
                            {r.entryTime ? fmtTime(r.entryTime) : '—'}
                            {r.exitTime ? ` → ${fmtTime(r.exitTime)}` : ''}
                          </span>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                              r.arrivalStatus === 'late'
                                ? 'bg-orange-100 text-orange-700'
                                : r.arrivalStatus === 'early'
                                ? 'bg-teal-100 text-teal-700'
                                : r.exitTime
                                ? 'bg-sky-100 text-sky-700'
                                : r.entryTime
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {r.arrivalStatus || (r.exitTime ? 'Out' : r.entryTime ? 'In' : 'Absent')}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}

      {!qrSet && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2.5">
          <CalendarCheck className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-[11px] text-amber-800">
            No QR set generated yet. Go to <span className="font-bold">Settings → Attendance QR Codes</span> to create
            the 12-day codes, then teachers can scan their attendance here.
          </p>
        </div>
      )}
    </div>
  );
}
