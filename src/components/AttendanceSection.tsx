import React, { useState, useRef } from 'react';
import { ScanLine, CheckCircle2, LogIn, LogOut, XCircle, Clock, AlertTriangle, Fingerprint, Loader2 } from 'lucide-react';
import QrScanner from './QrScanner';
import { playBeep, type AttendanceScanResult } from '../lib/attendance';
import { AttendanceQRSet, AttendanceRecord } from '../types';

interface AttendanceSectionProps {
  qrSet: AttendanceQRSet | null;
  todayRecord: AttendanceRecord | null;
  onScan: (raw: string) => AttendanceScanResult;
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export default function AttendanceSection({ qrSet, todayRecord, onScan }: AttendanceSectionProps) {
  const [scannerOpen, setScannerOpen] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'loading' | 'result'>('idle');
  const [result, setResult] = useState<AttendanceScanResult | null>(null);
  const timerRef = useRef<number | null>(null);

  const handleScan = (raw: string) => {
    // 1) instant confirmation beep
    playBeep();
    // 2) show a brief "verifying" state, then reveal the result
    setPhase('loading');
    const res = onScan(raw);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      setResult(res);
      setPhase('result');
    }, 1300);
  };

  const closeAll = () => {
    setScannerOpen(false);
    setPhase('idle');
    setResult(null);
  };

  const hasEntered = !!todayRecord?.entryTime;
  const hasLeft = !!todayRecord?.exitTime;

  // ── Result overlay (after scanning) ──
  if (scannerOpen && phase === 'result' && result) {
    const cfg = (() => {
      switch (result.status) {
        case 'arrived':
          return {
            icon: <LogIn className="h-9 w-9 text-emerald-600" />,
            title: 'Verified — You Have Arrived',
            sub: 'আপনি উপস্থিত হয়েছেন (নিবন্ধিত)',
            detail: `Arrival time: ${fmtTime(result.time)}`,
            tone: 'emerald' as const,
          };
        case 'departed':
          return {
            icon: <LogOut className="h-9 w-9 text-sky-600" />,
            title: 'Verified — You Have Checked Out',
            sub: 'আপনি বিদায় নিয়েছেন (প্রস্থান)',
            detail: `Departure time: ${fmtTime(result.time)}`,
            tone: 'sky' as const,
          };
        case 'already':
          return {
            icon: <Clock className="h-9 w-9 text-amber-600" />,
            title: 'Already Recorded Today',
            sub: 'আজ ইতিমধ্যে নিবন্ধিত',
            detail: hasLeft
              ? `Arrived ${fmtTime(todayRecord!.entryTime!)} · Left ${fmtTime(todayRecord!.exitTime!)}`
              : `Arrived ${fmtTime(result.entryTime)} · Awaiting checkout`,
            tone: 'amber' as const,
          };
        case 'wrongday':
          return {
            icon: <AlertTriangle className="h-9 w-9 text-amber-600" />,
            title: 'Wrong QR Code (ভুল কোড)',
            sub: 'This QR is not for today',
            detail: `Scanned code belongs to ${result.qrDate}. Please scan today's QR.`,
            tone: 'amber' as const,
          };
        case 'invalid':
        default:
          return {
            icon: <XCircle className="h-9 w-9 text-red-600" />,
            title: 'Invalid QR Code (অবৈধ কোড)',
            sub: 'Verification failed — please try again',
            detail: 'The code could not be verified. It may be forged or expired.',
            tone: 'red' as const,
          };
      }
    })();

    const toneCls = {
      emerald: 'bg-emerald-50 border-emerald-200',
      sky: 'bg-sky-50 border-sky-200',
      amber: 'bg-amber-50 border-amber-200',
      red: 'bg-red-50 border-red-200',
    }[cfg.tone];

    return (
      <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden">
          <div className={`flex flex-col items-center text-center gap-2 px-6 py-8 ${toneCls}`}>
            {cfg.icon}
            <h3 className="text-base font-serif font-bold text-[#2c332d] mt-1">{cfg.title}</h3>
            <p className="text-xs font-semibold text-stone-600">{cfg.sub}</p>
            <p className="text-[11px] text-stone-500 mt-1">{cfg.detail}</p>
          </div>
          <div className="px-6 pb-5">
            <button
              onClick={closeAll}
              className="w-full bg-[#4a5d4e] hover:bg-[#3d4d41] text-white text-xs font-bold py-2.5 rounded-lg shadow-sm active:scale-95 cursor-pointer border border-[#3d4d41]"
            >
              Done (সম্পন্ন)
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Loading overlay (verifying after beep) ──
  if (scannerOpen && phase === 'loading') {
    return (
      <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
        <div className="flex flex-col items-center justify-center gap-3 bg-[#2c332d] rounded-2xl border border-[#3d4d41] px-10 py-8">
          <Loader2 className="h-12 w-12 text-[#d9c5b2] animate-spin" />
          <p className="text-sm font-bold text-stone-100">Verifying (যাচাই করা হচ্ছে)…</p>
        </div>
      </div>
    );
  }

  // ── Scanner modal ──
  if (scannerOpen) {
    return (
      <QrScannerShell onClose={closeAll}>
        <QrScanner onResult={handleScan} onClose={closeAll} />
      </QrScannerShell>
    );
  }

  // ── Idle attendance card (shown under Class Routines) ──
  return (
    <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-3">
        <Fingerprint className="h-4 w-4 text-[#4a5d4e]" />
        <h2 className="text-sm font-serif font-bold text-[#2c332d]">Attendance (الحضور)</h2>
      </div>

      {!qrSet ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-start gap-2.5">
          <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-[11px] text-amber-800 leading-relaxed">
            Attendance QR codes have not been generated yet. The admin must generate them from
            <span className="font-bold"> Settings → Attendance QR Codes (কিউআর কোড)</span>.
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 bg-[#fdfbf7] border border-stone-200 rounded-xl p-4">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-[#2c332d] leading-snug">
                Scan with your phone to mark your attendance
              </p>
              <p className="text-[11px] text-[#4a5d4e] font-semibold mt-0.5">
                উপস্থিতি নিবন্ধন করতে আপনার ফোন দিয়ে স্ক্যান করুন
              </p>
              <p className="text-[10px] text-stone-400 mt-1.5">
                First scan = Arrival (আগমন) · Second scan = Departure (প্রস্থান)
              </p>
            </div>
            <button
              onClick={() => setScannerOpen(true)}
              className="shrink-0 flex items-center justify-center gap-2 bg-[#4a5d4e] hover:bg-[#3d4d41] text-white text-xs font-bold px-5 py-3 rounded-xl shadow-sm active:scale-95 cursor-pointer border border-[#3d4d41]"
            >
              <ScanLine className="h-4 w-4 text-[#d9c5b2]" />
              Scan (স্ক্যান)
            </button>
          </div>

          {/* Today's status strip */}
          <div
            className={`mt-3 flex items-center gap-2.5 rounded-xl px-3 py-2.5 border ${
              hasLeft
                ? 'bg-sky-50 border-sky-200'
                : hasEntered
                ? 'bg-emerald-50 border-emerald-200'
                : 'bg-stone-50 border-stone-200'
            }`}
          >
            {hasLeft ? (
              <LogOut className="h-4 w-4 text-sky-600 shrink-0" />
            ) : hasEntered ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            ) : (
              <Clock className="h-4 w-4 text-stone-400 shrink-0" />
            )}
            <p className="text-[11px] font-semibold text-stone-700">
              {hasLeft ? (
                <>Present · Checked out at <span className="font-bold">{fmtTime(todayRecord!.exitTime!)}</span></>
              ) : hasEntered ? (
                <>Present · Arrived at <span className="font-bold">{fmtTime(todayRecord!.entryTime!)}</span></>
              ) : (
                <>Not marked yet today — scan to record your arrival.</>
              )}
            </p>
          </div>
        </>
      )}
    </div>
  );
}

// Wrapper that reuses the scanner's full-screen dark backdrop but lets us
// overlay our own loading/result content on top.
function QrScannerShell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md relative">{children}</div>
    </div>
  );
}
