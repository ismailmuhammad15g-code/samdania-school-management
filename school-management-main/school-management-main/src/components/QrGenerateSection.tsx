import React, { useEffect, useState } from 'react';
import { toDataURL as qrToDataURL } from 'qrcode';
import { QrCode, RefreshCw, Printer, Trash2, CalendarDays, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { AttendanceQRSet, AttendanceRecord } from '../types';
import { qrContent, todayISO, addDays } from '../lib/attendance';

interface QrGenerateSectionProps {
  qrSet: AttendanceQRSet | null;
  attendance: AttendanceRecord[];
  onGenerate: (startDate: string) => void;
  onDelete: () => void;
}

interface QrImage {
  index: number;
  date: string;
  dataUrl: string;
}

export default function QrGenerateSection({ qrSet, attendance, onGenerate, onDelete }: QrGenerateSectionProps) {
  const [startDate, setStartDate] = useState(todayISO());
  const [images, setImages] = useState<QrImage[]>([]);
  const [generating, setGenerating] = useState(false);

  // Generate QR images whenever the set changes.
  useEffect(() => {
    let alive = true;
    if (!qrSet) {
      setImages([]);
      return;
    }
    (async () => {
      const out: QrImage[] = [];
      for (const day of qrSet.days) {
        try {
          const dataUrl = await qrToDataURL(qrContent(qrSet.id, day.date, qrSet.secret), {
            width: 900,
            margin: 2,
            scale: 8,
            color: { dark: '#2c332d', light: '#ffffff' },
            errorCorrectionLevel: 'H',
          });
          out.push({ index: day.index, date: day.date, dataUrl });
        } catch {
          out.push({ index: day.index, date: day.date, dataUrl: '' });
        }
      }
      if (alive) setImages(out);
    })();
    return () => {
      alive = false;
    };
  }, [qrSet]);

  const today = todayISO();
  const lastDay = qrSet ? qrSet.days[qrSet.days.length - 1].date : null;
  const needsRegenerate = !!lastDay && today > lastDay;
  const daysElapsed = qrSet ? Math.max(0, dateDiff(qrSet.startDate, today)) : 0;
  const usedDates = new Set(attendance.map((a) => a.date));

  function dateDiff(a: string, b: string): number {
    const [ay, am, ad] = a.split('-').map(Number);
    const [by, bm, bd] = b.split('-').map(Number);
    const da = new Date(ay, am - 1, ad).getTime();
    const db = new Date(by, bm - 1, bd).getTime();
    return Math.floor((db - da) / 86400000);
  }

  const handleGenerate = () => {
    if (qrSet && !confirm('Regenerate a new 12-day set? The current codes will stop working.')) return;
    setGenerating(true);
    setTimeout(() => {
      onGenerate(startDate);
      setGenerating(false);
    }, 200);
  };

  const handlePrint = () => {
    const html = `
      <html><head><title>Attendance QR Codes</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;margin:0;padding:20px;color:#2c332d;}
        h1{font-size:18px;text-align:center;margin:0 0 4px;}
        .sub{text-align:center;font-size:11px;color:#666;margin-bottom:16px;}
        .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;}
        .cell{border:2px solid #2c332d;border-radius:10px;padding:10px;text-align:center;page-break-inside:avoid;}
        .cell img{width:130px;height:130px;}
        .day{font-weight:bold;font-size:13px;margin-top:6px;}
        .date{font-size:11px;color:#555;}
        .foot{margin-top:18px;text-align:center;font-size:10px;color:#888;}
      </style></head><body>
      <h1>Samdania Talimul Islam Madrasah</h1>
      <div class="sub">Teacher Attendance QR Codes · ${qrSet?.startDate} – ${lastDay}</div>
      <div class="grid">
        ${images
          .map(
            (im) => `<div class="cell">
              ${im.dataUrl ? `<img src="${im.dataUrl}"/>` : '<div style="width:130px;height:130px;background:#eee"></div>'}
              <div class="day">Day ${im.index}</div>
              <div class="date">${im.date}</div>
            </div>`
          )
          .join('')}
      </div>
      <div class="foot">Scan with the teacher portal → Attendance (الحضور). First scan = Arrival, second = Departure.</div>
      </body></html>`;
    const w = window.open('', '_blank', 'width=800,height=900');
    if (!w) {
      alert('Popup blocked. Please allow popups to print the QR codes.');
      return;
    }
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 350);
  };

  return (
    <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
      <div className="bg-stone-50 px-5 py-3 border-b border-stone-200 flex items-center gap-2">
        <QrCode className="h-4 w-4 text-[#4a5d4e]" />
        <h3 className="text-sm font-bold text-[#2c332d]">Attendance QR Codes (১২ দিনের কিউআর কোড)</h3>
      </div>

      <div className="p-5 space-y-4">
        <p className="text-xs text-stone-500">
          Generate a set of 12 unique, signed QR codes — one for each day. Teachers scan today's code from their
          portal: the <span className="font-bold text-[#4a5d4e]">first scan marks arrival</span> and the
          <span className="font-bold text-[#4a5d4e]"> second marks departure</span>. Each code is tamper-proof and
          only works on its assigned date.
        </p>

        {needsRegenerate && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2.5">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-[11px] font-bold text-amber-800">12 days completed — please regenerate!</p>
              <p className="text-[10px] text-amber-700 mt-0.5">
                The last code expired on {lastDay}. Generate a fresh 12-day set so attendance can continue.
              </p>
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="flex-1">
            <label className="block text-[10px] font-bold text-stone-500 mb-1">Start Date (শুরুর তারিখ)</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-stone-50 text-xs border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#4a5d4e] font-mono"
            />
          </div>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="bg-[#4a5d4e] hover:bg-[#3d4d41] disabled:bg-[#6a7d6e] text-white text-xs font-bold px-4 py-2.5 rounded-lg shadow-sm active:scale-95 cursor-pointer border border-[#3d4d41] flex items-center justify-center gap-1.5"
          >
            {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Generate 12-Day QR Set
          </button>
        </div>

        {qrSet && (
          <>
            {/* Status bar */}
            <div className="flex items-center justify-between bg-[#f5f2ed]/60 border border-stone-200 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2 text-[11px] text-stone-600">
                <CalendarDays className="h-4 w-4 text-[#4a5d4e]" />
                <span>
                  Set <span className="font-mono font-bold">{qrSet.id}</span> · Day {Math.min(daysElapsed + 1, 12)} of 12
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrint}
                  className="bg-white border border-stone-300 hover:bg-stone-50 text-stone-700 text-[11px] font-bold px-3 py-1.5 rounded-lg cursor-pointer flex items-center gap-1.5"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Print All
                </button>
                <button
                  onClick={() => {
                    if (confirm('Delete the current QR set? Teachers will not be able to scan until you regenerate.'))
                      onDelete();
                  }}
                  className="text-red-500 hover:text-red-700 hover:bg-red-50 text-[11px] font-bold px-2 py-1.5 rounded-lg cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              </div>
            </div>

            {/* 12 QR grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {images.map((im) => {
                const isToday = im.date === today;
                const isUsed = usedDates.has(im.date);
                return (
                  <div
                    key={im.index}
                    className={`relative border rounded-xl p-3 flex flex-col items-center text-center ${
                      isToday ? 'border-[#4a5d4e] bg-emerald-50/60 ring-1 ring-[#4a5d4e]' : 'border-stone-200 bg-[#fdfbf7]'
                    }`}
                  >
                    {isToday && (
                      <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-[#4a5d4e] text-[#d9c5b2] text-[9px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
                        TODAY (আজ)
                      </span>
                    )}
                    {im.dataUrl ? (
                      <img src={im.dataUrl} alt={`Day ${im.index}`} className="w-24 h-24 mt-1" />
                    ) : (
                      <div className="w-24 h-24 mt-1 bg-stone-200 rounded" />
                    )}
                    <p className="text-xs font-black text-[#2c332d] mt-1.5">Day {im.index}</p>
                    <p className="text-[10px] font-mono text-stone-500">{im.date}</p>
                    {isUsed && (
                      <span className="mt-1 inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                        <CheckCircle2 className="h-2.5 w-2.5" /> Used
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="text-[10px] text-stone-400 text-center">
              Print and display the QR for each day. Only the code whose date matches today can be scanned.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
