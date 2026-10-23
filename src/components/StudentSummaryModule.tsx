import React, { useState, useEffect, useMemo } from 'react';
import { Student, StudentResult } from '../types';
import {
  Search,
  Eye,
  Pencil,
  CreditCard,
  X,
  Phone,
  Hash,
  Info,
  GraduationCap,
  Loader2,
  Banknote,
  UserCheck,
  ChevronRight,
  FileText,
  RefreshCw,
} from 'lucide-react';
import CertificateModule from './CertificateModule';
import { useLiveStudentSearch } from '../lib/useLiveStudentSearch';
import { parseNumberWithBengaliSupport } from '../lib/digitUtils';

interface StudentSummaryModuleProps {
  students: Student[];
  results: StudentResult[];
  onEditStudent: (id: string) => void;
  onPayFees: (id: string) => void;
  readOnly?: boolean;
}

const feeNum = (v: unknown): number => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const n = parseNumberWithBengaliSupport(v);
  return Number.isFinite(n) ? n : 0;
};

const computeTotalPayable = (s: Student) =>
  (feeNum(s.previousDue) + feeNum(s.currentMonthFee) + feeNum(s.examFee) + feeNum(s.transport) + feeNum(s.electricity) + feeNum(s.water)) -
  feeNum(s.waiver) - feeNum(s.advancePaid);

const feeFields: { key: keyof Student; label: string; bn: string }[] = [
  { key: 'previousDue', label: 'Previous Due', bn: 'পূর্ব বকেয়া' },
  { key: 'currentMonthFee', label: 'Current Month Fee', bn: 'বর্তমান মাস' },
  { key: 'examFee', label: 'Exam Fee', bn: 'পরীক্ষার ফি' },
  { key: 'transport', label: 'Transport', bn: 'গাড়ি ভাড়া' },
  { key: 'electricity', label: 'Electricity', bn: 'বিদ্যুৎ বিল' },
  { key: 'water', label: 'Water', bn: 'পানি বিল' },
  { key: 'waiver', label: 'Waiver', bn: 'মওকুফ' },
  { key: 'advancePaid', label: 'Advance Paid', bn: 'অগ্রিম' },
];

const subjectGrade = (percentage: number) => {
  if (percentage >= 80) return 'A+';
  if (percentage >= 70) return 'A';
  if (percentage >= 60) return 'A-';
  if (percentage >= 50) return 'B';
  if (percentage >= 40) return 'C';
  if (percentage >= 33) return 'D';
  return 'F';
};

export default function StudentSummaryModule({
  students,
  results,
  onEditStudent,
  onPayFees,
  readOnly,
}: StudentSummaryModuleProps) {
  const [viewingStudent, setViewingStudent] = useState<Student | null>(null);
  const [showCertificate, setShowCertificate] = useState(false);

  const {
    query: searchTerm,
    setQuery: setSearchTerm,
    classFilter,
    setClassFilter,
    results: filteredStudents,
    loading: searchLoading,
    renderKey: searchRenderKey,
    totalCount: searchTotalCount,
    refresh: refreshSearch,
  } = useLiveStudentSearch({
    storageKey: 'samdani_students',
    fallbackStudents: students,
  });

  // Close modal on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setViewingStudent(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const classOptions = useMemo(
    () => ['All', ...Array.from(new Set(students.map((s) => s.class).filter(Boolean)))],
    [students]
  );

  const totalStudents = searchTotalCount;
  const totalOutstanding = students.reduce(
    (sum, s) => sum + Math.max(0, computeTotalPayable(s)),
    0
  );

  const studentResults = useMemo(
    () =>
      viewingStudent
        ? results
            .filter((r) => r.studentId === viewingStudent.id)
            .sort((a, b) => b.year - a.year)
        : [],
    [viewingStudent, results]
  );

  return (
    <div className="space-y-6">
      {/* Title banner */}
      <div className="bg-white p-6 rounded-xl border border-stone-200 shadow-sm flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="bg-[#4a5d4e]/10 p-2 rounded-xl border border-stone-200/50 flex items-center justify-center shrink-0">
            <GraduationCap className="h-7 w-7 text-[#4a5d4e]" />
          </div>
          <div>
            <h2 className="text-2xl font-serif font-bold text-[#2c332d] tracking-tight">
              Student Summary &amp; Results
            </h2>
            <p className="text-stone-500 text-sm mt-1">
              Complete profile, fee standing and academic results for every enrolled student.
            </p>
          </div>
        </div>

          <div className="flex gap-3 w-full lg:w-auto items-stretch">
            <div className="flex-1 lg:w-40 bg-[#f5f2ed]/60 rounded-lg border border-stone-200 px-4 py-2.5 text-center">
              <p className="text-[10px] uppercase font-bold text-stone-500 tracking-wide">Students</p>
              <p className="text-lg font-black font-mono text-[#2c332d]">{totalStudents}</p>
            </div>
            <div className="flex-1 lg:w-44 bg-[#4a5d4e]/5 rounded-lg border border-[#4a5d4e]/20 px-4 py-2.5 text-center">
              <p className="text-[10px] uppercase font-bold text-stone-500 tracking-wide">Total Outstanding</p>
              <p className="text-lg font-black font-mono text-[#b27d6d]">৳ {totalOutstanding.toFixed(2)}</p>
            </div>
            <button
              onClick={() => setShowCertificate(true)}
              className="flex items-center justify-center gap-2 bg-[#4a5d4e] hover:bg-[#3d4d41] text-white text-xs font-bold px-4 rounded-lg shadow cursor-pointer border border-[#3d4d41] whitespace-nowrap"
            >
              <FileText className="h-4 w-4 text-[#d9c5b2]" />
              প্রত্যয়ন পত্র
            </button>
          </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row items-center gap-4 bg-[#f5f2ed]/55 p-4 rounded-xl border border-stone-200">
        <div className="relative w-full sm:w-2/3">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-stone-400" />
          <input
            type="search"
            autoComplete="off"
            spellCheck={false}
            placeholder="Search by Name, ID, Roll or Phone — live from cloud..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white text-xs border border-stone-200 rounded-lg pl-9 pr-9 py-2 focus:outline-none focus:border-[#4a5d4e] focus:ring-1 focus:ring-[#4a5d4e]"
          />
          {searchLoading ? (
            <Loader2 className="absolute right-3 top-2.5 h-4 w-4 text-[#4a5d4e] animate-spin" />
          ) : searchTerm ? (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-2 text-[10px] font-bold text-stone-400 hover:text-[#4a5d4e] cursor-pointer"
            >
              Clear
            </button>
          ) : null}
        </div>
        <div className="w-full sm:w-1/3 flex items-center gap-2 justify-end">
          <span className="text-xs text-stone-500 font-medium">Class:</span>
          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="bg-white text-xs border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-[#4a5d4e]"
          >
            {classOptions.map((cls) => (
              <option key={cls} value={cls}>{cls}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={refreshSearch}
            title="Refresh from cloud"
            className="p-1.5 rounded-lg border border-stone-200 bg-white text-stone-500 hover:text-[#4a5d4e] hover:border-[#4a5d4e] cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${searchLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Content — remounts on every live search so results always paint immediately */}
      {searchLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-stone-200 shadow-sm p-5 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-full bg-stone-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-2/3 bg-stone-200 rounded" />
                  <div className="h-2.5 w-1/2 bg-stone-200 rounded" />
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <div className="h-2.5 w-full bg-stone-200 rounded" />
                <div className="h-2.5 w-5/6 bg-stone-200 rounded" />
              </div>
              <div className="mt-4 h-9 w-full bg-stone-200 rounded-lg" />
            </div>
          ))}
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-12 flex flex-col items-center justify-center text-center gap-3">
          <div className="bg-[#4a5d4e]/10 text-[#4a5d4e] p-4 rounded-2xl">
            <Search className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-serif font-bold text-[#2c332d]">No students found</h3>
          <p className="text-sm text-stone-500 max-w-sm">
            Try adjusting your search term or class filter.
          </p>
        </div>
      ) : (
        <div key={searchRenderKey} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredStudents.map((s, idx) => {
            const total = computeTotalPayable(s);
            const initial = String(s.name || '').trim().charAt(0).toUpperCase() || '?';
            return (
              <div
                key={`${s.id}__${idx}`}
                className="bg-white rounded-xl border border-stone-200 shadow-sm p-5 flex flex-col gap-4 hover:shadow-md hover:border-[#4a5d4e]/30 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-full bg-[#4a5d4e] text-white flex items-center justify-center font-bold text-lg shrink-0">
                    {initial}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-[#2c332d] truncate">{s.name}</p>
                    <p className="text-[11px] text-stone-500 font-mono truncate">{s.id}</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-[#f5f2ed]/60 rounded-lg py-1.5">
                    <p className="text-[9px] uppercase text-stone-500 font-bold">Class</p>
                    <p className="text-xs font-bold text-[#2c332d] truncate px-1">{s.class}</p>
                  </div>
                  <div className="bg-[#f5f2ed]/60 rounded-lg py-1.5">
                    <p className="text-[9px] uppercase text-stone-500 font-bold">Roll</p>
                    <p className="text-xs font-bold font-mono text-[#2c332d]">{s.roll}</p>
                  </div>
                  <div className="bg-[#f5f2ed]/60 rounded-lg py-1.5">
                    <p className="text-[9px] uppercase text-stone-500 font-bold">Due</p>
                    <p className={`text-xs font-bold font-mono ${total > 0 ? 'text-[#b27d6d]' : 'text-[#4a5d4e]'}`}>
                      ৳ {Math.max(0, total).toFixed(0)}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setViewingStudent(s)}
                  className="w-full bg-[#4a5d4e] hover:bg-[#3d4d41] text-white text-xs font-bold px-4 py-2.5 rounded-lg transition-all flex items-center justify-center gap-1.5 shadow active:scale-95 cursor-pointer border border-[#3d4d41]"
                >
                  <Eye className="h-4 w-4 text-[#d9c5b2]" />
                  View Profile
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* View Modal */}
      {viewingStudent && (
        <div className="fixed inset-0 bg-[#2c332d]/55 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
          <div className="bg-[#f8f7f4] rounded-2xl border border-stone-200 shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-[#253328] to-[#1e2a20] text-white px-6 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-white/15 border border-white/20 flex items-center justify-center font-bold text-xl">
                  {viewingStudent.name.trim().charAt(0).toUpperCase() || '?'}
                </div>
                <div>
                  <h3 className="font-serif font-bold text-lg leading-tight">{viewingStudent.name}</h3>
                  <p className="text-[11px] text-white/60 font-mono">{viewingStudent.id} • Class {viewingStudent.class} • Roll {viewingStudent.roll}</p>
                </div>
              </div>
              <button
                onClick={() => setViewingStudent(null)}
                className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-all cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body (scrollable) */}
            <div className="overflow-y-auto px-6 py-5 space-y-5">
              {/* Quick Actions (hidden for read-only Viewer Admin) */}
              {readOnly ? (
                <div className="grid grid-cols-1 gap-3">
                  <div className="flex items-center justify-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold px-4 py-2.5 rounded-lg">
                    <Eye className="h-4 w-4" />
                    View Only — No edits allowed
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => { onEditStudent(viewingStudent.id); setViewingStudent(null); }}
                    className="flex items-center justify-center gap-2 bg-white border border-stone-200 hover:border-[#4a5d4e] text-[#2c332d] text-xs font-bold px-4 py-2.5 rounded-lg transition-all cursor-pointer"
                  >
                    <Pencil className="h-4 w-4 text-[#4a5d4e]" />
                    Edit Profile
                  </button>
                  <button
                    onClick={() => { onPayFees(viewingStudent.id); setViewingStudent(null); }}
                    className="flex items-center justify-center gap-2 bg-[#4a5d4e] hover:bg-[#3d4d41] text-white text-xs font-bold px-4 py-2.5 rounded-lg transition-all cursor-pointer border border-[#3d4d41]"
                  >
                    <CreditCard className="h-4 w-4 text-[#d9c5b2]" />
                    Collect Fee
                  </button>
                </div>
              )}

              {/* Basic Info */}
              <section>
                <h4 className="text-xs font-serif font-bold text-[#2c332d] uppercase border-b border-stone-200 pb-2 mb-3 flex items-center gap-1.5">
                  <UserCheck className="h-3.5 w-3.5 text-[#4a5d4e]" />
                  Basic Information
                </h4>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-white rounded-lg border border-stone-200 p-3">
                    <p className="text-[10px] uppercase text-stone-400 font-bold">Guardian Contact</p>
                    <p className="font-bold text-[#2c332d] flex items-center gap-1.5 mt-0.5">
                      <Phone className="h-3.5 w-3.5 text-stone-400" />
                      {viewingStudent.contact || 'No contact'}
                    </p>
                  </div>
                  <div className="bg-white rounded-lg border border-stone-200 p-3">
                    <p className="text-[10px] uppercase text-stone-400 font-bold">Roll Number</p>
                    <p className="font-bold font-mono text-[#2c332d] flex items-center gap-1.5 mt-0.5">
                      <Hash className="h-3.5 w-3.5 text-stone-400" />
                      {viewingStudent.roll}
                    </p>
                  </div>
                  <div className="bg-white rounded-lg border border-stone-200 p-3">
                    <p className="text-[10px] uppercase text-stone-400 font-bold">Father's Name (বাবার নাম)</p>
                    <p className="font-bold text-[#2c332d] flex items-center gap-1.5 mt-0.5 break-words">
                      <UserCheck className="h-3.5 w-3.5 text-stone-400 shrink-0" />
                      {viewingStudent.fatherName || '—'}
                    </p>
                  </div>
                  <div className="bg-white rounded-lg border border-stone-200 p-3">
                    <p className="text-[10px] uppercase text-stone-400 font-bold">Mother's Name (মায়ের নাম)</p>
                    <p className="font-bold text-[#2c332d] flex items-center gap-1.5 mt-0.5 break-words">
                      <UserCheck className="h-3.5 w-3.5 text-stone-400 shrink-0" />
                      {viewingStudent.motherName || '—'}
                    </p>
                  </div>
                  <div className="bg-white rounded-lg border border-stone-200 p-3 sm:col-span-2">
                    <p className="text-[10px] uppercase text-stone-400 font-bold">Additional Information (অতিরিক্ত তথ্য)</p>
                    <p className="font-medium text-[#2c332d] flex items-start gap-1.5 mt-0.5 break-words">
                      <Info className="h-3.5 w-3.5 text-stone-400 shrink-0 mt-0.5" />
                      <span>{viewingStudent.extraInfo || 'No additional information recorded.'}</span>
                    </p>
                  </div>
                </div>
              </section>

              {/* Fee Standing */}
              <section>
                <h4 className="text-xs font-serif font-bold text-[#2c332d] uppercase border-b border-stone-200 pb-2 mb-3 flex items-center gap-1.5">
                  <Banknote className="h-3.5 w-3.5 text-[#4a5d4e]" />
                  Fee Standing
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {feeFields.map((f) => (
                    <div key={f.key as string} className="bg-white rounded-lg border border-stone-200 p-2.5">
                      <p className="text-[9px] uppercase text-stone-400 font-bold leading-tight">{f.label}</p>
                      <p className="text-[9px] text-stone-400">{f.bn}</p>
                      <p className="font-mono font-bold text-sm text-[#2c332d] mt-1">৳ {Number(viewingStudent[f.key]).toFixed(2)}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between bg-[#4a5d4e]/5 border border-[#4a5d4e]/20 rounded-lg px-4 py-3">
                  <span className="text-xs font-bold text-stone-600">Total Payable</span>
                  <span className={`text-lg font-black font-mono ${computeTotalPayable(viewingStudent) > 0 ? 'text-[#b27d6d]' : 'text-[#4a5d4e]'}`}>
                    ৳ {computeTotalPayable(viewingStudent).toFixed(2)}
                  </span>
                </div>
              </section>

              {/* Results */}
              {studentResults.length > 0 && (
                <section>
                  <h4 className="text-xs font-serif font-bold text-[#2c332d] uppercase border-b border-stone-200 pb-2 mb-3 flex items-center gap-1.5">
                    <GraduationCap className="h-3.5 w-3.5 text-[#4a5d4e]" />
                    Academic Results ({studentResults.length})
                  </h4>
                  <div className="space-y-4">
                    {studentResults.map((r) => {
                      const totalMarks = r.marks.reduce((s, m) => s + m.marksObtained, 0);
                      const maxMarks = r.marks.reduce((s, m) => s + m.maxMarks, 0);
                      return (
                        <div key={r.id} className="bg-white rounded-xl border border-stone-200 overflow-hidden">
                          <div className="bg-[#f5f2ed]/60 px-4 py-2.5 flex items-center justify-between border-b border-stone-200">
                            <div>
                              <p className="font-bold text-[#2c332d] text-sm">{r.examType}</p>
                              <p className="text-[10px] text-stone-500 font-mono">Year {r.year}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${r.status === 'Pass' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                {r.status === 'Pass' ? 'Pass (উত্তীর্ণ)' : 'Fail (অনুত্তীর্ণ)'}
                              </span>
                              <span className="text-[10px] font-bold font-mono text-[#4a5d4e] bg-[#4a5d4e]/10 px-2 py-0.5 rounded-full">GPA {r.gpa.toFixed(2)}</span>
                            </div>
                          </div>

                          <div className="p-3">
                            <table className="w-full text-left text-xs border border-stone-200 rounded overflow-hidden">
                              <thead>
                                <tr className="bg-[#4a5d4e] text-stone-100 font-semibold">
                                  <th className="py-1.5 px-3">Subject</th>
                                  <th className="py-1.5 px-3 text-center w-20">Full</th>
                                  <th className="py-1.5 px-3 text-center w-20">Obtained</th>
                                  <th className="py-1.5 px-3 text-center w-16">Grade</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-stone-100">
                                {r.marks.map((m) => (
                                  <tr key={m.subjectName}>
                                    <td className="py-1.5 px-3 font-semibold text-[#2c332d]">{m.subjectName}</td>
                                    <td className="py-1.5 px-3 text-center font-mono text-stone-500">{m.maxMarks}</td>
                                    <td className="py-1.5 px-3 text-center font-mono font-bold text-stone-900">{m.marksObtained}</td>
                                    <td className="py-1.5 px-3 text-center font-mono font-bold text-[#4a5d4e]">
                                      {subjectGrade((m.marksObtained / m.maxMarks) * 100)}
                                    </td>
                                  </tr>
                                ))}
                                <tr className="bg-[#f5f2ed]/60 font-bold text-stone-900">
                                  <td className="py-1.5 px-3 text-right" colSpan={2}>Total</td>
                                  <td className="py-1.5 px-3 text-center font-mono">{maxMarks}</td>
                                  <td className="py-1.5 px-3 text-center font-mono text-[#4a5d4e]">{totalMarks}</td>
                                  <td className="py-1.5 px-3 text-center font-mono uppercase">{r.grade}</td>
                                </tr>
                              </tbody>
                            </table>
                            {r.remarks && (
                              <p className="text-[11px] text-stone-600 italic mt-2 bg-[#fcfbf9] border border-stone-200/60 p-2 rounded">
                                "{r.remarks}"
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-stone-200 bg-white flex items-center justify-between shrink-0">
              <span className="text-[10px] text-stone-400 font-mono">Student Record • {viewingStudent.id}</span>
              <button
                onClick={() => setViewingStudent(null)}
                className="text-xs font-bold text-stone-500 hover:text-[#2c332d] flex items-center gap-1 cursor-pointer"
              >
                Close <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Certificate (প্রত্যয়ন পত্র) modal */}
      {showCertificate && (
        <CertificateModule students={students} onClose={() => setShowCertificate(false)} />
      )}
    </div>
  );
}
