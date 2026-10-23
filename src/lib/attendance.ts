import { sha256Hex } from './sha256';
import type { AttendanceQRSet, AttendanceQRDay } from '../types';

// Public URL-looking prefix so the printed QR reads like a real "link".
// Use the current origin dynamically so local/dev and deployed environments work.
const MAGIC = 'SAMDANIA_ATT';

function attendanceBaseUrl(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/attend/`;
  }
  return 'http://localhost:3000/attend/';
}

function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  (typeof crypto !== 'undefined' && crypto.getRandomValues
    ? crypto.getRandomValues(arr)
    : Array.from(arr, () => Math.floor(Math.random() * 256)));
  return Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return toISODate(dt);
}

export function todayISO(): string {
  return toISODate(new Date());
}

// Build the signed, tamper-proof token for a given day in a set.
function signToken(setId: string, date: string, secret: string): string {
  const payload = `${MAGIC}|${setId}|${date}`;
  const sig = sha256Hex(`${payload}|${secret}`).slice(0, 32);
  return `${payload}|${sig}`;
}

// Produce the human-readable QR content (a link whose tail is the token).
export function qrContent(setId: string, date: string, secret: string): string {
  return attendanceBaseUrl() + signToken(setId, date, secret);
}

export function generateQRSet(startDate: string = todayISO()): AttendanceQRSet {
  const id = `ATT-${Date.now().toString(36).toUpperCase()}-${randomHex(4).toUpperCase()}`;
  const secret = randomHex(32);
  const days: AttendanceQRDay[] = [];
  for (let i = 0; i < 12; i++) {
    const date = addDays(startDate, i);
    days.push({ index: i + 1, date, token: signToken(id, date, secret) });
  }
  return {
    id,
    generatedAt: new Date().toISOString(),
    startDate,
    secret,
    days,
  };
}

export type VerifiedToken =
  | { ok: true; setId: string; date: string }
  | { ok: false };

// Verify a scanned string against a set's secret. Returns the day's date if valid.
export function verifyScanned(set: AttendanceQRSet | null, scanned: string): VerifiedToken {
  if (!set) return { ok: false };
  let token = scanned.trim();

  if (/^https?:\/\//i.test(token)) {
    const match = token.match(/^https?:\/\/[^/]+\/attend\/(.+)$/i);
    token = match ? match[1] : token;
  }

  try {
    const parts = token.split('|');
    if (parts.length !== 4) return { ok: false };
    const [magic, setId, date, sig] = parts;
    if (magic !== MAGIC) return { ok: false };
    if (setId !== set.id) return { ok: false };
    const expected = sha256Hex(`${MAGIC}|${setId}|${date}|${set.secret}`).slice(0, 32);
    if (expected !== sig) return { ok: false };
    // Confirm the day actually belongs to this set
    if (!set.days.some((d) => d.date === date)) return { ok: false };
    return { ok: true, setId, date };
  } catch {
    return { ok: false };
  }
}

// Play a short confirmation "beep" when a QR is captured.
export function playBeep(): void {
  try {
    const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.26);
    osc.onended = () => ctx.close();
  } catch {
    /* audio unavailable — ignore */
  }
}

export type AttendanceScanResult =
  | { status: 'arrived'; time: string }            // first scan → arrived
  | { status: 'departed'; time: string }           // second scan → left
  | { status: 'already'; entryTime: string; exitTime: string | null } // already recorded
  | { status: 'wrongday'; qrDate: string }         // QR not for today
  | { status: 'invalid' };                         // forged / unrecognised

// Start of the current ISO week (Monday 00:00 local).
export function startOfWeekISO(ref: Date = new Date()): string {
  const d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  const dow = (d.getDay() + 6) % 7; // 0 = Monday
  d.setDate(d.getDate() - dow);
  return toISODate(d);
}
