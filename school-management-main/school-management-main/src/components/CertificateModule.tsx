import React, { useMemo, useState } from 'react';
import { Search, X, Printer, Download, FileText } from 'lucide-react';
import type { Student } from '../types';
import { generateCertificatePDF } from './PDFGenerator';
import certSvgUrl from '../assets/images/Certificate Of samdania-madrasah.svg';

interface CertificateModuleProps {
  students: Student[];
  onClose: () => void;
}

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function CertificateModule({ students, onClose }: CertificateModuleProps) {
  const [certType, setCertType] = useState<'enrollment' | 'transfer'>('enrollment');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Student | null>(null);
  const [classStudied, setClassStudied] = useState('');
  const [parentName, setParentName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [thanksText, setThanksText] = useState('');
  const [issueDate, setIssueDate] = useState(todayISO());
  const [busy, setBusy] = useState(false);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return students
      .filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.id.toLowerCase().includes(q) ||
          String(s.roll).includes(q) ||
          (s.contact || '').includes(q)
      )
      .slice(0, 8);
  }, [query, students]);

  const canPrint = Boolean(selected && parentName.trim() && phoneNumber.trim());

  const handleSelect = (s: Student) => {
    setSelected(s);
    setClassStudied(s.class);
    setQuery('');
    setParentName(s.fatherName || '');
    setThanksText(
      certType === 'transfer'
        ? 'We pray for his/her continued success and good conduct in the new school.'
        : 'We pray for his/her continued success and good conduct.'
    );
  };

  const switchType = (t: 'enrollment' | 'transfer') => {
    setCertType(t);
    if (selected) {
      setThanksText(
        t === 'transfer'
          ? 'We pray for his/her continued success and good conduct in the new school.'
          : 'We pray for his/her continued success and good conduct.'
      );
    }
  };

  const doPrint = async (print: boolean) => {
    if (!selected || !canPrint || busy) return;
    setBusy(true);
    try {
      await generateCertificatePDF(
        selected,
        { certType, classStudied, parentName, phoneNumber, thanksText, issueDate },
        { print, download: !print }
      );
    } catch (e) {
      // eslint-disable-next-line no-alert
      alert('Could not generate the certificate: ' + (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#2c332d]/60 backdrop-blur-sm flex items-center justify-center p-4 z-[70]">
      <div className="bg-[#f8f7f4] rounded-2xl border border-stone-200 shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#253328] to-[#1e2a20] text-white px-5 py-3.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center">
              <FileText className="h-4.5 w-4.5 text-[#d9c5b2]" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-base leading-tight">প্রত্যয়ন পত্র</h3>
              <p className="text-[11px] text-white/60">Student Certificate / সনদপত্র</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-all cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-5 py-4 space-y-4">
          {/* Certificate type toggle */}
          <div className="flex border border-stone-300 rounded-lg overflow-hidden">
            <button
              onClick={() => switchType('enrollment')}
              className={`flex-1 px-3 py-2 text-xs font-semibold cursor-pointer ${
                certType === 'enrollment' ? 'bg-[#4a5d4e] text-white' : 'bg-white text-stone-600'
              }`}
            >
              প্রত্যয়ন পত্র (Enrollment)
            </button>
            <button
              onClick={() => switchType('transfer')}
              className={`flex-1 px-3 py-2 text-xs font-semibold cursor-pointer border-l border-stone-300 ${
                certType === 'transfer' ? 'bg-[#4a5d4e] text-white' : 'bg-white text-stone-600'
              }`}
            >
              শংসাপত্র / Transfer (TC)
            </button>
          </div>

          {/* Search / select */}
          {!selected ? (
            <div>
              <label className="text-xs font-bold text-stone-600 uppercase tracking-wide">
                Search Student
              </label>
              <div className="relative mt-1.5">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-stone-400" />
                <input
                  autoFocus
                  type="text"
                  placeholder="Search by Name, ID, Roll or Contact…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full bg-white text-sm border border-stone-200 rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:border-[#4a5d4e] focus:ring-1 focus:ring-[#4a5d4e]"
                />
              </div>
              {query && (
                <div className="mt-2 space-y-1.5">
                  {results.length === 0 && (
                    <p className="text-xs text-stone-400 px-1">No students found.</p>
                  )}
                  {results.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => handleSelect(s)}
                      className="w-full flex items-center justify-between gap-3 bg-white border border-stone-200 hover:border-[#4a5d4e] rounded-lg px-3 py-2 text-left transition-all cursor-pointer"
                    >
                      <div className="min-w-0">
                        <p className="font-bold text-[#2c332d] text-sm truncate">{s.name}</p>
                        <p className="text-[11px] text-stone-500 font-mono truncate">
                          {s.id} · Class {s.class} · Roll {s.roll}
                        </p>
                      </div>
                      <span className="text-[11px] text-stone-400 shrink-0">Select →</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Selected student card */}
              <div className="bg-white rounded-xl border border-stone-200 p-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] uppercase font-bold text-stone-400 tracking-wide">
                    Selected Student
                  </p>
                  <p className="font-bold text-[#2c332d] text-lg leading-tight">{selected.name}</p>
                  <p className="text-xs text-stone-500 font-mono">
                    {selected.id} · Class {selected.class} · Roll {selected.roll}
                  </p>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Father: {selected.fatherName || '-'} · Mother: {selected.motherName || '-'}
                  </p>
                  <p className="text-xs text-stone-500">Contact: {selected.contact || '-'}</p>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="text-[11px] text-[#4a5d4e] font-semibold underline shrink-0 cursor-pointer"
                >
                  Change
                </button>
              </div>

              {/* Form fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-stone-600">Class Studied (শ্রেণী)</label>
                  <input
                    type="text"
                    value={classStudied}
                    onChange={(e) => setClassStudied(e.target.value)}
                    placeholder="e.g. Class 5"
                    className="mt-1 w-full bg-white text-sm border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#4a5d4e]"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-stone-600">Guardian Name (অভিভাবক)</label>
                  <input
                    type="text"
                    value={parentName}
                    onChange={(e) => setParentName(e.target.value)}
                    placeholder="e.g. Mohammad Ali"
                    className="mt-1 w-full bg-white text-sm border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#4a5d4e]"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-stone-600">Phone Number</label>
                  <input
                    type="text"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="e.g. +8801XXXXXXXXX"
                    className="mt-1 w-full bg-white text-sm border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#4a5d4e]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-stone-600">
                    Appreciation Text (كلمه الشكر)
                  </label>
                  <textarea
                    rows={2}
                    value={thanksText}
                    onChange={(e) => setThanksText(e.target.value)}
                    placeholder="Words of appreciation / সাধুবাদ…"
                    className="mt-1 w-full bg-white text-sm border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#4a5d4e] resize-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-stone-600">Issue Date</label>
                  <input
                    type="date"
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                    className="mt-1 w-full bg-white text-sm border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#4a5d4e]"
                  />
                </div>
              </div>

              {/* Live preview */}
              <div>
                <p className="text-[10px] uppercase font-bold text-stone-400 tracking-wide mb-1.5">
                  Preview
                </p>
                <div className="rounded-xl border border-stone-300 bg-white p-3 overflow-hidden">
                  <div className="border-[3px] border-[#1d432f] rounded-xl p-2 bg-white">
                    <div className="relative border border-[#c9b78f] rounded-lg overflow-hidden bg-white">
                      <img src={certSvgUrl} alt="Certificate" className="w-full h-auto block" />
                      <div
                        className="absolute left-[8%] right-[8%] flex flex-col items-center justify-center text-center gap-1"
                        style={{ top: '19%', bottom: '21%' }}
                      >
                        <p className="font-serif font-bold text-[#1d432f] text-[15px]">
                          {certType === 'transfer'
                            ? 'শংসাপত্র / Transfer Certificate (TC)'
                            : 'প্রত্যয়ন পত্র / Certificate of Enrollment'}
                        </p>
                        <p className="text-[9px] text-stone-500">সামদানিয়া তালীমুল ইসলাম মাদ্রাসা</p>
                        <p className="text-[11px] text-stone-600">
                          {certType === 'transfer'
                            ? 'This is to certify that the following student was a student of this Madrasah'
                            : 'This is to certify that'}
                        </p>
                        <p className="font-bold text-[#111] text-lg leading-tight">{selected.name}</p>
                        <p className="text-[10px] text-stone-600">
                          ID: {selected.id} · Class Studied: {classStudied || selected.class} · Roll {selected.roll}
                        </p>
                        <p className="text-[10px] text-stone-600">
                          Father: {selected.fatherName || '-'} · Mother: {selected.motherName || '-'}
                        </p>
                        <p className="text-[10px] text-stone-600">
                          Guardian: {parentName || '-'} · Phone: {phoneNumber || '-'}
                        </p>
                        {certType === 'transfer' && (
                          <p className="text-[10px] text-stone-600 px-2">
                            He/She has studied here and is now leaving / transferring to another institution.
                          </p>
                        )}
                        <p className="text-[10px] italic text-stone-600 px-2">
                          {thanksText ||
                            (certType === 'transfer'
                              ? 'We pray for his/her continued success and good conduct in the new school.'
                              : 'We pray for his/her continued success and good conduct.')}
                        </p>
                      </div>
                      <div
                        className="absolute left-[6%] right-[6%] flex flex-col items-center"
                        style={{ bottom: '4.5%' }}
                      >
                        <div className="flex justify-between gap-6 w-full">
                          <div className="flex-1 text-center">
                            <div className="border-b border-stone-400 h-4" />
                            <p className="text-[8px] font-semibold text-stone-600 mt-1">অধ্যক্ষ</p>
                          </div>
                          <div className="flex-1 text-center">
                            <div className="border-b border-stone-400 h-4" />
                            <p className="text-[8px] font-semibold text-stone-600 mt-1">
                              অ্যাকাউন্টস অফিসার
                            </p>
                          </div>
                        </div>
                        <p className="text-[8px] text-stone-400 mt-1">Issue Date: {issueDate}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-5 py-3 border-t border-stone-200 bg-white flex items-center justify-end gap-2 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-stone-500 hover:text-[#2c332d] cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={() => void doPrint(false)}
            disabled={!canPrint || busy}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-white border border-[#4a5d4e] text-[#4a5d4e] rounded-lg hover:bg-[#4a5d4e]/5 disabled:opacity-40 cursor-pointer"
          >
            <Download className="h-4 w-4" />
            Download
          </button>
          <button
            onClick={() => void doPrint(true)}
            disabled={!canPrint || busy}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-[#4a5d4e] hover:bg-[#3d4d41] text-white rounded-lg disabled:opacity-40 cursor-pointer"
          >
            <Printer className="h-4 w-4" />
            Print
          </button>
        </div>
      </div>
    </div>
  );
}
