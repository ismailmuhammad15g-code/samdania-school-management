import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { LedgerTransaction, FeePayment, FeeDigitInputs, StudentAttendanceRecord, LoanRecord, LoanPayment, Student } from '../types';
import { BENGALI_FONT_BASE64 } from './BengaliFont';
import { numberToBengaliWords, formatTakaBengali } from '../lib/bengaliNumbers';
import logoUrl from '../assets/images/logo2.png';
import certSvgUrl from '../assets/images/Certificate Of samdania-madrasah.svg';

// Institution name shown in the receipt header — differs per school/section
const SCHOOL_HEADERS: Record<'fees' | 'hifz', string> = {
  fees: 'সামদানিয়া তালীমুল ইসলাম মাদ্রাসা',
  hifz: 'সামদানিয়া তালীমূল ইসলাম হিফজুল কোরআন মাদ্রাসা',
};

const formatDate = (dateStr: string) => {
  try { return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); }
  catch { return dateStr; }
};

const formatDateBn = (dateStr: string) => {
  try { return new Date(dateStr).toLocaleDateString('bn-BD', { year: 'numeric', month: 'long', day: 'numeric' }); }
  catch { return dateStr; }
};

const escapeHtml = (s: string): string =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const formatFeeMoney = (amount: number, input?: string): string => {
  const formatted = amount.toFixed(2);
  return `৳ ${input && /[০-৯]/.test(input) ? formatTakaBengali(amount) : formatted}`;
};

const applyFeeReceiptFontSize = (root: HTMLElement): void => {
  const style = document.createElement('style');
  style.textContent = `
    #${root.id}.fee-receipt .summary-grid,
    #${root.id}.fee-receipt .summary-grid *,
    #${root.id}.fee-receipt .fee-table-box,
    #${root.id}.fee-receipt .fee-table-box *,
    #${root.id}.fee-receipt .calc-split,
    #${root.id}.fee-receipt .calc-split *,
    #${root.id}.fee-receipt .words-bar,
    #${root.id}.fee-receipt .words-bar *,
    #${root.id}.fee-receipt .received-by,
    #${root.id}.fee-receipt .received-by *,
    #${root.id}.fee-receipt #office-copy-section .card,
    #${root.id}.fee-receipt #office-copy-section .card * {
      font-size: 11pt !important;
    }
  `;
  root.prepend(style);
};

const BENGALI_MONTHS: Record<string, string> = {
  'January': 'জানুয়ারি', 'February': 'ফেব্রুয়ারি', 'March': 'মার্চ',
  'April': 'এপ্রিল', 'May': 'মে', 'June': 'জুন',
  'July': 'জুলাই', 'August': 'আগস্ট', 'September': 'সেপ্টেম্বর',
  'October': 'অক্টোবর', 'November': 'নভেম্বর', 'December': 'ডিসেম্বর',
};

const waitForFont = (fontFamily: string): Promise<void> => {
  return document.fonts.load(`14px "${fontFamily}"`).then(() => undefined);
};

/* ═══════════════════════════════════════════════════════════════════════════
   FAST NATIVE PRINTING
   The old flow was: HTML → html2canvas (raster) → base64 JPEG inside a PDF →
   `doc.output('dataurlnewwindow')`.  Chrome had to decode a multi-megabyte
   data: URL inside the PDF viewer before the print dialog appeared, which is
   why the user had to click on the blank page and wait for the lag.

   Now the *very same* HTML is printed straight from a hidden iframe with the
   browser's own print engine:
     • the print dialog opens instantly (no raster, no PDF, no extra window),
     • the text stays crisp/vector instead of a blurry screenshot,
     • nothing is downloaded and no popup-blocker prompt appears.
   The page geometry is byte-for-byte the same as the PDF (816×1056 px = US
   Letter portrait @96dpi) so the receipt keeps exactly the same size.
   ═══════════════════════════════════════════════════════════════════════════ */

const APP_FONT_STACK =
  '"Plus Jakarta Sans", "SolaimanLipi", "Inter", "Noto Sans Bengali", ui-sans-serif, sans-serif';

interface FastPrintOptions {
  /** Width of the printable area in CSS pixels (816 = Letter @96dpi). */
  pageWidthPx: number;
  /** Height of the printable area in CSS pixels (1056 = Letter @96dpi). */
  pageHeightPx: number;
  /** CSS @page size, e.g. '215.9mm 279.4mm' or 'A4 landscape'. */
  pageSize: string;
  /** id of the root element that has to be fitted into the page. */
  rootId: string;
}

/**
 * The top half of the receipt has to end exactly at the middle of the sheet —
 * that is where the "Cut here" line is.  When the fee table carries many rows
 * the top half can be taller than half a page; instead of clipping it, the
 * whole top half is scaled down (uniformly, so every element keeps its
 * proportion) until it fits exactly into its box.
 */
const fitTopHalf = (root: HTMLElement) => {
  const top = root.querySelector('.receipt-top') as HTMLElement | null;
  const inner = root.querySelector('.receipt-top-inner') as HTMLElement | null;
  if (!top || !inner) return;

  const avail = top.clientHeight;
  if (!avail) return;

  inner.style.transform = 'none';
  inner.style.width = '';

  const height = inner.scrollHeight;
  if (height <= avail + 1) return; // fits already — nothing to do

  let k = avail / height;
  for (let i = 0; i < 4; i++) {
    inner.style.width = `${100 / k}%`;
    inner.style.transform = `scale(${k})`;
    inner.style.transformOrigin = 'top left';
    const next = avail / inner.scrollHeight;
    if (!isFinite(next) || next <= 0) break;
    if (Math.abs(next - k) < 0.004) {
      k = next;
      break;
    }
    k = next;
  }
  inner.style.width = `${100 / k}%`;
  inner.style.transform = `scale(${k})`;
  inner.style.transformOrigin = 'top left';
};

const printHtmlDirect = async (bodyHtml: string, opts: FastPrintOptions): Promise<void> => {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('title', 'print-frame');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = `
    position: fixed;
    left: -10000px;
    top: 0;
    width: ${opts.pageWidthPx}px;
    height: ${opts.pageHeightPx}px;
    border: 0;
    margin: 0;
    padding: 0;
  `;
  document.body.appendChild(iframe);

  const pageHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Print</title>
<style>
  @font-face {
    font-family: 'SolaimanLipi';
    src: url('data:font/truetype;base64,${BENGALI_FONT_BASE64}') format('truetype');
    font-weight: normal;
    font-style: normal;
    unicode-range: U+0980-09FF;
  }
  @page { size: ${opts.pageSize}; margin: 0; }
  /* The page geometry comes from the viewport: the guardian copy always ends
     exactly at 50vh, the office copy fills the remaining 50vh. */
  #print-page-wrapper { --page-h: 100vh !important; --page-half: 50vh !important; }
  html, body {
    margin: 0 !important;
    padding: 0 !important;
    width: ${opts.pageWidthPx}px;
    height: ${opts.pageHeightPx}px;
    overflow: hidden;
    background: #ffffff;
    font-family: ${APP_FONT_STACK};
    color: #2c332d;
  }
  * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  #print-stage .fee-receipt .summary-grid,
  #print-stage .fee-receipt .summary-grid *,
  #print-stage .fee-receipt .fee-table-box,
  #print-stage .fee-receipt .fee-table-box *,
  #print-stage .fee-receipt .calc-split,
  #print-stage .fee-receipt .calc-split *,
  #print-stage .fee-receipt .words-bar,
  #print-stage .fee-receipt .words-bar *,
  #print-stage .fee-receipt .received-by,
  #print-stage .fee-receipt .received-by *,
  #print-stage .fee-receipt #office-copy-section .card,
  #print-stage .fee-receipt #office-copy-section .card * {
    font-size: 11pt !important;
  }
</style>
</head>
<body>
  <div id="print-stage" style="position:relative;width:${opts.pageWidthPx}px;height:${opts.pageHeightPx}px;overflow:hidden;background:#ffffff;">
    ${bodyHtml}
  </div>
</body>
</html>`;

  // Wait until the srcdoc document is fully parsed (and its stylesheets are in).
  // Polling is used instead of the `load` event because the initial
  // about:blank load can fire before the srcdoc navigation starts.
  await new Promise<void>((resolve) => {
    const deadline = Date.now() + 4000;
    const check = () => {
      const d = iframe.contentDocument;
      if (d && d.readyState === 'complete' && d.getElementById('print-stage')) {
        resolve();
        return;
      }
      if (Date.now() > deadline) {
        resolve();
        return;
      }
      window.setTimeout(check, 30);
    };
    iframe.srcdoc = pageHtml;
    check();
  });

  // The document object is replaced when the iframe navigates to the srcdoc,
  // so it has to be read *after* the document is ready.
  const doc = iframe.contentDocument;
  const win = iframe.contentWindow;
  if (!doc || !win) {
    iframe.remove();
    return;
  }

  // Re-use the fonts the app already loaded so the print matches the screen.
  try {
    Array.from(document.fonts).forEach((face) => {
      try {
        doc.fonts.add(face);
      } catch {
        /* a face that cannot be shared is simply skipped */
      }
    });
  } catch {
    /* ignore */
  }

  try {
    await doc.fonts.load('14px "SolaimanLipi"');
    await doc.fonts.load('14px "Plus Jakarta Sans"');
    await doc.fonts.ready;
  } catch {
    /* ignore */
  }

  // Wait for the logo / signature artwork so nothing is missing on the paper.
  const images = Array.from(doc.images);
  await Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (!img.getAttribute('src') || img.complete) return resolve();
          let settled = false;
          const done = () => {
            if (!settled) {
              settled = true;
              resolve();
            }
          };
          img.onload = done;
          img.onerror = done;
          window.setTimeout(done, 3000);
        })
    )
  );

  // Let the layout settle before measuring / printing.
  await new Promise<void>((resolve) => window.setTimeout(resolve, 60));

  // Fit the content into a single page (mirrors the old "contain-fit" behaviour).
  const root = doc.getElementById(opts.rootId) as HTMLElement | null;
  if (root) {
    // The guardian copy always ends exactly at the middle of the sheet.
    fitTopHalf(root);

    const contentW = root.offsetWidth || opts.pageWidthPx;
    const contentH = root.offsetHeight || opts.pageHeightPx;
    const k = Math.min(opts.pageWidthPx / contentW, opts.pageHeightPx / contentH);
    if (k < 0.999) {
      root.style.position = 'absolute';
      root.style.left = `${Math.max(0, (opts.pageWidthPx - contentW * k) / 2)}px`;
      root.style.top = `${Math.max(0, (opts.pageHeightPx - contentH * k) / 2)}px`;
      root.style.transformOrigin = 'top left';
      root.style.transform = `scale(${k})`;
    }
  }

  const cleanup = () => {
    try {
      iframe.remove();
    } catch {
      /* already detached */
    }
  };

  // Clean the frame up once the print dialog is closed (plus a safety net in
  // case the browser never fires `afterprint`).
  win.addEventListener('afterprint', cleanup, { once: true });
  try {
    win.focus();
    win.print();
  } catch (err) {
    console.error('Print failed:', err);
    cleanup();
  }
  window.setTimeout(cleanup, 15000);
};

export const generateFeeReceiptPDF = async (
  payment: FeePayment,
  options: { download?: boolean; print?: boolean; school?: 'fees' | 'hifz'; studentRoll?: string; digitInputs?: FeeDigitInputs } = { download: true }
) => {
  // Letter Portrait Dimensions — the receipt fills the whole page
  const pageW = 215.9;   // mm
  const pageH = 279.4;   // mm

  const bnMonth = BENGALI_MONTHS[payment.month] || payment.month;
  const digitInputs = { ...options.digitInputs, ...payment.digitInputs };
  const formatPaymentMoney = (amount: number, key: keyof FeeDigitInputs): string =>
    formatFeeMoney(amount, digitInputs[key] ?? digitInputs.amountPaid);
  
  const remaining = payment.totalPayable - payment.amountPaid;
  let remainingLabel: string;
  let remainingValue: string;
  let remainingColor: string;

  if (remaining > 0) {
    remainingLabel = 'বকেয়া';
    remainingValue = formatPaymentMoney(remaining, 'amountPaid');
    remainingColor = '#aa3333';
  } else if (remaining < 0) {
    remainingLabel = 'অগ্রিম';
    remainingValue = formatPaymentMoney(Math.abs(remaining), 'amountPaid');
    remainingColor = '#227722';
  } else {
    remainingLabel = 'পরিশোধিত';
    remainingValue = 'সম্পূর্ণ পরিশোধিত';
    remainingColor = '#227722';
  }

  // ── Values for the new boxy summary blocks ───────────────────────────────
  const dueAmount = remaining;                       // negative = advance
  const dueLabel = remaining < 0 ? 'অগ্রিম' : 'বকেয়া';
  const dueValue = formatPaymentMoney(Math.abs(dueAmount), 'amountPaid');

  // Left column of Block 2 — the message shown next to the calculation grid
  const leftColumnHtml =
    remaining === 0
      ? `<span style="font-size: 14px;">সম্পূর্ণ পরিশোধ করার জন্য আপনাকে</span>
         <h1>ধন্যবাদ</h1>`
      : remaining > 0
        ? `<h1>আপনার বকেয়া: ${formatPaymentMoney(dueAmount, 'amountPaid')}</h1>`
        : `<h1>আপনার অগ্রিম: ${formatPaymentMoney(Math.abs(dueAmount), 'amountPaid')}</h1>`;

  const tableRowsHtml = ([
    { num: '০১', label: 'পূর্ব বকেয়া', val: payment.previousDue, minus: false, key: 'previousDue' },
    { num: '০২', label: 'বর্তমান মাস', val: payment.currentMonthFee, minus: false, key: 'currentMonthFee' },
    { num: '০৩', label: 'পরীক্ষার ফি', val: payment.examFee, minus: false, key: 'examFee' },
    { num: '০৪', label: 'গাড়ি ভাড়া', val: payment.transport, minus: false, key: 'transport' },
    { num: '০৫', label: 'বিদ্যুৎ বিল', val: payment.electricity, minus: false, key: 'electricity' },
    { num: '০৬', label: 'পানি বিল', val: payment.water, minus: false, key: 'water' },
    { num: '০৭', label: 'মওকুফ', val: payment.waiver, minus: true, key: 'waiver' },
    { num: '০৮', label: 'অগ্রিম', val: payment.advancePaid, minus: true, key: 'advancePaid' },
  ] satisfies Array<{ num: string; label: string; val: number; minus: boolean; key: keyof FeeDigitInputs }>)
    // Only the heads that really carry an amount (the ones that get a ✔ tick)
    // are printed — unselected and zero-taka heads are left out completely.
    .filter((r) => Math.abs(Number(r.val) || 0) > 0.005)
    .map((r, i) => {
      const value = Number(r.val) || 0;
      const amount = `${r.minus ? '- ' : ''}${formatPaymentMoney(Math.abs(value), r.key)}`;
      const color = '#1f2f26';
      const tick = '<span style="font-family:Arial,sans-serif;color:#1f7a3d;font-weight:bold;">✔</span>';
      const num = ['০১', '০২', '০৩', '০৪', '০৫', '০৬', '০৭', '০৮'][i] ?? r.num;
      return `
      <tr>
        <td style="border:1px solid #d7c7a9;padding:6px 10px;font-size:14px;line-height:1.3;text-align:center;color:#3c3c3c;">${num}</td>
        <td style="border:1px solid #d7c7a9;padding:6px 10px;font-size:14px;line-height:1.3;color:#2f2f2f;vertical-align:middle;">${r.label}</td>
        <td style="border:1px solid #d7c7a9;padding:6px 10px;font-size:14px;line-height:1.3;text-align:center;vertical-align:middle;">${tick}</td>
        <td style="border:1px solid #d7c7a9;padding:6px 10px;font-size:14px;line-height:1.3;text-align:right;font-weight:700;color:${color};">${amount}</td>
      </tr>`;
    })
    .join('') ||
    `<tr><td colspan="4" style="border:1px solid #d7c7a9;padding:6px 10px;font-size:14px;line-height:1.3;text-align:center;color:#6b6b6b;">কোনো ফির অঙ্ক নেই / No fee heads</td></tr>`;

  // The layout is strict to 1123px width by 794px height (Exact A4 Landscape at 96 DPI)
  // Left side takes 50% (561.5px), Right side takes 50%
  const html = `
<div id="invoice-root" class="fee-receipt">
  <style>
    html, body { margin: 0; padding: 0; width: 100%; min-height: 100vh; }
    body { background: #ffffff; }
    
    /* MAIN PAGE LAYOUT - FIXED FLEXBOX STRUCTURE */
    #print-page-wrapper {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
      width: 100%;
    }

    /* ── Customer Copy Section (Top Half) ───────────────────────────────────── */
    #customer-copy-section {
      display: flex;
      flex-direction: column;
      flex-grow: 1;
      width: 100%;
      padding: 16px;
      box-sizing: border-box;
      background: #ffffff;
    }

    /* ── Bottom Half (Office Copy Section) ──────────────────────────────────── */
    #office-copy-section {
      flex-shrink: 0;
      width: 100%;
      padding: 14px 16px;
      box-sizing: border-box;
      background: #ffffff;
      position: relative;
    }

    /* Signature wrapper for auto margin */
    .signature-wrapper { margin-top: auto; }

    /* Legacy structures for compatibility */
    #invoice-root {
      --page-h: 1056px;
      --page-half: 528px;
      --wrap-pad: 16px;
      width: 816px; 
      min-height: var(--page-h); 
      margin: 0; 
      padding: 0; 
      box-sizing: border-box; 
      background: #ffffff; 
      position: relative; 
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    #invoice-root #invoice-wrapper {
      width: 100%; 
      padding: var(--wrap-pad); 
      box-sizing: border-box; 
      background: #ffffff; 
      border: 1px solid #dcd1ba; 
      border-radius: 12px; 
      display: flex;
      flex-direction: column;
      flex: 1 1 auto;
      min-height: 0;
    }

    /* ── Top half (guardian copy) ───────────────────────────────────── */
    #invoice-root .receipt-top {
      flex: 0 0 auto;
      height: calc(var(--page-half) - var(--wrap-pad));
      position: relative;
      overflow: hidden;
    }
    #invoice-root .receipt-top-inner { width: 100%; padding-bottom: 10px; }

    /* ── Bottom half (office copy) ──────────────────────────────────── */
    #invoice-root .receipt-bottom {
      flex: 1 1 auto;
      min-height: 0;
      display: flex;
      flex-direction: column;
      padding-top: 14px;
      position: relative;
    }
    #invoice-root .sign-row { display: flex; justify-content: space-between; gap: 24px; margin-top: auto; }
    #invoice-root .received-by { margin-top: auto; text-align: center; }

    /* Typography: headline 20px, table rows 14px, everything else 12px */
    #invoice-root .title { font-size: 20px; margin: 0; line-height: 1.1; color: #1b3929; font-weight: 800; text-align: center; }
    #invoice-root .subtitle { font-size: 12px; margin-top: 6px; color: #5b5b5b; text-align: center; }
    #invoice-root .section-heading { font-size: 14px; margin: 0 0 8px 0; color: #314234; font-weight: bold; }
    #invoice-root .label { font-size: 14px; color: #444444; margin: 4px 0; font-weight: bold; }
    #invoice-root .value { font-size: 14px; font-weight: 700; color: #111111; }
    #invoice-root .small { font-size: 14px; color: #555555; line-height: 1.3; }
    
    #invoice-root .kv-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 12px; }
    #invoice-root .kv-grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 4px 10px; }
    #invoice-root .kv { font-size: 14px; color: #444444; margin: 0; }
    
    #invoice-root table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    #invoice-root th, #invoice-root td { border: 1px solid #d7c7a9; padding: 6px 10px; }
    #invoice-root th { background: #ffffff; font-size: 14px; font-weight: 700; }
    
    #invoice-root .summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 12px; }
    #invoice-root .card { border: 1px solid #e2d4b5; border-radius: 8px; padding: 10px; background: #ffffff; }
    
    /* The cut line is the top edge of the bottom half → exactly 50vh. */
    #invoice-root .cutline { position: absolute; left: 0; right: 0; top: -1px; border-top: 1px dashed #999999; margin: 0; }
    #invoice-root .cutline span { position: absolute; top: 1px; left: 15px; background: #ffffff; padding: 0 8px; font-size: 12px; color: #666666; }
    #invoice-root .footer-note { font-size: 12px; color: #6b6b6b; margin-top: 10px; text-align: center; }

    /* ── Boxy summary blocks ─────────────────────────────────────────── */
    /* Outer black frame around the itemised table (inner borders untouched) */
    #invoice-root .fee-table-box { border: 2px solid #000; margin-top: 12px; background: #ffffff; }
    #invoice-root .fee-table-box table { margin-top: 0; }

    /* Block 1 — empty spacer bar */
    #invoice-root .block-spacer { height: 24px; border: 1px solid #000; margin-top: -1px; background: #ffffff; }

    /* Block 2 — split: message on the left, calculation grid on the right */
    #invoice-root .calc-split { display: flex; align-items: stretch; border: 1px solid #000; margin-top: -1px; background: #ffffff; }
    #invoice-root .calc-left {
      width: 60%;
      border-right: 1px solid #000;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 10px 14px;
    }
    #invoice-root .calc-left h1 {
      font-family: 'SolaimanLipi', sans-serif;
      font-size: 26px;
      font-weight: 900;
      color: #1b3929;
      line-height: 1.15;
      margin: 4px 0 0 0;
    }
    #invoice-root .calc-right { width: 40%; }
    #invoice-root .calc-right table { width: 100%; border-collapse: collapse; margin: 0 -1px -1px 0; }
    #invoice-root .calc-right td { border: 1px solid #000; padding: 6px 10px; font-size: 14px; vertical-align: middle; text-align: left; }
    #invoice-root .calc-right td.calc-label { font-weight: 700; color: #2f2f26; }
    #invoice-root .calc-right td.calc-value { font-weight: 700; color: #1f2f26; }
    #invoice-root .calc-right tr:first-child td { border-top: none; }
    #invoice-root .calc-right td:first-child { border-left: none; }
    #invoice-root .calc-right tr:last-child td { border-bottom: none; }

    /* Block 3 — amount in words bar */
    #invoice-root .words-bar {
      border: 1px solid #000;
      margin-top: -1px;
      padding: 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      font-size: 14px;
      color: #2f2f26;
      background: #ffffff;
    }
  </style>

  <div id="print-page-wrapper">
    <div id="customer-copy-section">
  <div id="print-page-wrapper">
    <div id="customer-copy-section">
      <div id="invoice-wrapper">

        <!-- ══════════ TOP HALF — guardian copy (ends exactly at 50vh) ══════════ -->
        <div class="receipt-top">
          <div class="receipt-top-inner">
       <!-- Header -->
       <div style="display: flex; justify-content: space-between; gap: 14px; align-items: center;">
         <div style="display: flex; align-items: center; gap: 14px; flex: 1;">
           <img src="${logoUrl}" alt="Logo" style="width: 84px; height: auto; max-width: 100%; object-fit: contain; display: block;" />
           <div style="flex: 1;">
             <div style="font-size: 26px; font-weight: 900; color: #1d432f; line-height: 1.1;">${SCHOOL_HEADERS[options.school ?? 'fees']}</div>
             <div style="font-size: 18px; font-weight: 700; color: #4d4d4d; margin-top: 4px;">المدرسة الصمدانية للتعليم الإسلامي بغلاجيبه</div>
             <div class="small" style="margin-top: 6px;">Pir Badrul Islam Samdani Complex, Khanqah-e-Furfura Sharif, Darul Aman, Ward 02, Golachipa, Patuakhali.</div>
           </div>
         </div>
         <div style="text-align: right; min-width: 140px;">
           <div class="label">মোবাইল: +8801792776433</div>
           <div class="small" style="margin-top: 4px;">পীর বদরুল ইসলাম সামদানী কমপ্লেক্স</div>
           <div class="small">গলাচিপা, পটুয়াখালী</div>
         </div>
       </div>

      <div style="margin-top: 16px;">
        <h1 class="title">ছাত্র/ছাত্রীদের বেতন আদায়ের রশিদ</h1>
        <div class="subtitle">Monthly Fee Receipt</div>
      </div>

      <!-- Student & Receipt Details -->
      <div class="summary-grid">
        <div class="card">
          <div class="section-heading">ছাত্রের তথ্য / Student</div>
          <div class="kv-grid">
            <div class="kv"><b>নাম:</b> <span class="value">${escapeHtml(payment.studentName)}</span></div>
            <div class="kv"><b>আইডি:</b> <span class="value">${escapeHtml(payment.studentId)}</span></div>
            <div class="kv"><b>শ্রেণী:</b> <span class="value">${escapeHtml(payment.class)}</span></div>
            ${options.studentRoll ? `<div class="kv"><b>রোল:</b> <span class="value">${escapeHtml(options.studentRoll)}</span></div>` : ''}
            <div class="kv"><b>মাস:</b> <span class="value">${escapeHtml(payment.month)} (${escapeHtml(bnMonth)})</span></div>
          </div>
        </div>
        <div class="card">
          <div class="section-heading">রশিদ বিবরণ / Receipt</div>
          <div class="kv-grid" style="grid-template-columns: 1fr;">
            <div class="kv"><b>রশিদ নং:</b> <span class="value">${escapeHtml(payment.receiptNo)}</span></div>
            <div class="kv"><b>চালান নং:</b> <span class="value">#${escapeHtml(String(payment.invoiceNo))}</span></div>
            <div class="kv"><b>তারিখ:</b> <span class="value">${formatDateBn(payment.date)}</span></div>
          </div>
        </div>
      </div>

      <!-- Fee Table (thick black outer frame, inner borders unchanged) -->
      <div class="fee-table-box">
        <table>
          <thead>
            <tr>
              <th style="width: 12%;">ক্র নং</th>
              <th style="width: 48%; text-align: left;">বিবরণ</th>
              <th style="width: 10%;"></th>
              <th style="width: 30%; text-align: right;">টাকা</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml}
          </tbody>
        </table>
      </div>

      <!-- Block 1 — empty spacer bar -->
      <div class="block-spacer"></div>

      <!-- Block 2 — message + calculation grid -->
      <div class="calc-split">
        <div class="calc-left">
          ${leftColumnHtml}
        </div>
        <div class="calc-right">
          <table>
            <tbody>
              <tr>
                <td class="calc-label">মোট টাকা</td>
                <td class="calc-value">${formatPaymentMoney(payment.totalPayable, 'amountPaid')}</td>
              </tr>
              <tr>
                <td class="calc-label">জমা টাকা</td>
                <td class="calc-value">${formatPaymentMoney(payment.amountPaid, 'amountPaid')}</td>
              </tr>
              <tr>
                <td class="calc-label">${dueLabel} টাকা</td>
                <td class="calc-value">${dueValue}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Block 3 — amount in words -->
      <div class="words-bar">
        <div>জমা টাকা: ${numberToBengaliWords(payment.amountPaid)} মাত্র</div>
        <div>${dueLabel} টাকা: ${numberToBengaliWords(Math.abs(dueAmount))} মাত্র</div>
      </div>

      </div><!-- /.receipt-top-inner -->
      </div><!-- /.receipt-top -->

      <!-- ══════════ SIGNATURES — forced to bottom of Customer Copy section ══════════ -->
      <div class="signature-wrapper">
        <div class="sign-row">
          <div style="flex: 1; text-align: center;">
            <div style="border-bottom: 1px solid #333333; height: 30px;"></div>
            <div class="label" style="margin-top: 4px;">অধ্যক্ষ</div>
          </div>
          <div style="flex: 1; text-align: center;">
            <div style="border-bottom: 1px solid #333333; height: 30px;"></div>
            <div class="label" style="margin-top: 4px;">অ্যাকাউন্টস অফিসার</div>
          </div>
        </div>

        <!-- Received By — margin-top:auto pushes it to the very bottom of the Customer Copy section -->
        <div class="received-by">
          <div class="label"> / Received By: <span class="value">${escapeHtml(payment.receivedBy || '—')}</span></div>
        </div>
      </div>

    </div><!-- /.customer-copy-section -->

    <!-- ══════════ BOTTOM HALF — office copy (fills the rest of the sheet) ══════════ -->
    <div id="office-copy-section">

      <!-- The "Cut here" line = top edge of the bottom half = middle of the page -->
      <div class="cutline"><span>✂ Cut here</span></div>

      <!-- Admin Copy Section -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px;">
        <div class="card">
          <div class="section-heading">অফিস কপি / Admin</div>
          <div class="kv-grid" style="grid-template-columns: 1fr;">
            <div class="kv"><b>আইডি:</b> <span class="value">${escapeHtml(payment.studentId)}</span></div>
            <div class="kv"><b>নাম:</b> <span class="value">${escapeHtml(payment.studentName)}</span></div>
            ${options.studentRoll ? `<div class="kv"><b>রোল:</b> <span class="value">${escapeHtml(options.studentRoll)}</span></div>` : ''}
            <div class="kv"><b>শ্রেণী:</b> <span class="value">${escapeHtml(payment.class)}</span></div>
            <div class="kv"><b>তারিখ:</b> <span class="value">${formatDateBn(payment.date)}</span></div>
          </div>
        </div>
        <div class="card">
          <div class="section-heading">সংক্ষেপ / Summary</div>
          <div class="kv-grid" style="grid-template-columns: 1fr;">
            <div class="kv"><b>রশিদ নং:</b> <span class="value">${escapeHtml(payment.receiptNo)}</span></div>
            <div class="kv"><b>জমা :</b> <span class="value">${formatPaymentMoney(payment.amountPaid, 'amountPaid')}</span> <span class="small">(${numberToBengaliWords(payment.amountPaid)})</span></div>
            <div class="kv"><b>${remainingLabel} :</b> <span class="value" style="color: ${remainingColor};">${remainingValue}</span></div>
            <div class="kv"><b>প্রাপ্ত / Received By:</b> <span class="value">${escapeHtml(payment.receivedBy || '—')}</span></div>
          </div>
        </div>
      </div>

      <div class="footer-note">Email: samdaniamadrasha@gmail.com</div>
    </div><!-- /.office-copy-section -->
  </div><!-- /#print-page-wrapper -->
  `;

  // ── Print: straight to the browser's print engine (instant, no PDF round-trip)
  if (options.print) {
    await printHtmlDirect(html, {
      pageWidthPx: 816,
      pageHeightPx: 1056,
      pageSize: '215.9mm 279.4mm',
      rootId: 'invoice-root',
    });
    return;
  }

  const styleTag = document.createElement('style');
  styleTag.textContent = `
    @font-face {
      font-family: 'SolaimanLipi';
      src: url('data:font/truetype;base64,${BENGALI_FONT_BASE64}') format('truetype');
      font-weight: normal;
      font-style: normal;
    }
  `;
  document.head.appendChild(styleTag);

  const wrapper = document.createElement('div');
  wrapper.style.cssText = `
    position:fixed;
    top:0;
    left:0;
    z-index:-9999;
    pointer-events:none;
    opacity:1;
    width:816px; /* Full Letter width @96dpi */
    overflow:visible;
  `;
  wrapper.innerHTML = html;
  document.body.appendChild(wrapper);

  const container = wrapper.querySelector('#invoice-root') as HTMLElement;
  applyFeeReceiptFontSize(container);

  // Make sure the logo image is fully decoded before we capture it
  await new Promise<void>((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = logoUrl;
    if (img.complete) resolve();
  });
  await new Promise((resolve) => setTimeout(resolve, 300)); // allow layout to settle

  // The guardian copy must end exactly at the middle of the sheet (same rule
  // as the print path) so the PDF and the printout are identical.
  fitTopHalf(container);

  try {
    const canvas = await html2canvas(container, {
      scale: 2, // High resolution
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      width: container.offsetWidth,
      height: container.scrollHeight,
      windowWidth: 816,
      windowHeight: container.scrollHeight,
      x: 0,
      y: 0,
      scrollY: -window.scrollY // Crucial to prevent cut-off if user is scrolled down
    });

    // Create jsPDF in PORTRAIT mode on LETTER paper
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });

    // Fill the WHOLE A4 page. Contain-fit guarantees the entire receipt
    // (top and bottom) is always visible with no cropping.
    const scale = Math.min(pageW / canvas.width, pageH / canvas.height);
    const drawW = canvas.width * scale;
    const drawH = canvas.height * scale;
    doc.addImage(canvas.toDataURL('image/jpeg', 1.0), 'JPEG', (pageW - drawW) / 2, (pageH - drawH) / 2, drawW, drawH);

    doc.save(`FeeInvoice_${payment.studentName.replace(/\s+/g, '_')}_${payment.receiptNo}.pdf`);
  } finally {
    // Cleanup DOM
    document.body.removeChild(wrapper);
    document.head.removeChild(styleTag);
  }
};

/* ═══════════════════════════════════════════════════════════════════════════
   LOAN REPAYMENT RECEIPT
   Mirrors the fee-receipt design (logo, school header, signatures, Bengali
   typography) but for a loan installment — it always shows the loan holder,
   the amount paid this installment, and the remaining balance (never empty).
   ═══════════════════════════════════════════════════════════════════════════ */
export interface LoanReceiptParams {
  personName: string;
  loanId: string;
  type: 'Taken' | 'Given' | 'ZakatLillah';
  date: string;
  amountPaid: number;
  totalAmount: number;
  repaidBefore: number;
  remaining: number;
  note?: string;
  receiptNo: string;
}

export const generateLoanReceiptPDF = async (
  data: LoanReceiptParams,
  options: { download?: boolean; print?: boolean } = { download: true }
) => {
  const pageW = 215.9;   // mm (Letter)
  const pageH = 279.4;   // mm

  const typeLabel = data.type === 'Taken' ? 'গৃহীত ঋণ (Taken Loan)' : data.type === 'Given' ? 'প্রদত্ত ঋণ (Given Loan)' : 'যাকাত ও লিল্লাহ ফান্ড (Zakat & Lillah Fund)';
  const remainingColor = data.remaining > 0 ? '#aa3333' : '#227722';
  const remainingText = data.remaining > 0 ? `৳ ${data.remaining.toFixed(2)}` : 'সম্পূর্ণ পরিশোধিত';

  const html = `
<div id="invoice-root">
  <style>
    html, body { margin: 0; padding: 0; width: 100%; min-height: 100%; }
    body { background: #ffffff; }
    #invoice-root {
      width: 816px; 
      min-height: 1056px; 
      margin: 0; 
      padding: 0; 
      box-sizing: border-box; 
      background: #ffffff; 
      position: relative; 
      overflow: hidden;
    }
    #invoice-root #invoice-wrapper {
      width: 100%; 
      padding: 16px; 
      box-sizing: border-box; 
      background: #ffffff; 
      border: 1px solid #dcd1ba; 
      border-radius: 12px; 
      display: flex;
      flex-direction: column;
    }
    .title { font-size: 20px; margin: 0; line-height: 1.1; color: #1b3929; font-weight: 800; text-align: center; }
    .subtitle { font-size: 12px; margin-top: 6px; color: #5b5b5b; text-align: center; }
    .section-heading { font-size: 14px; margin: 0 0 8px 0; color: #314234; font-weight: bold; }
    .label { font-size: 14px; color: #444444; margin: 4px 0; font-weight: bold; }
    .value { font-size: 14px; font-weight: 700; color: #111111; }
    .small { font-size: 14px; color: #555555; line-height: 1.3; }
    .kv-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 12px; }
    .kv { font-size: 14px; color: #444444; margin: 0; }
    .card { border: 1px solid #e2d4b5; border-radius: 8px; padding: 10px; background: #ffffff; }
    .cutline { width: 100%; border-top: 1px dashed #999999; margin-top: 16px; margin-bottom: 8px; position: relative; }
    .cutline span { position: absolute; top: -9px; left: 15px; background: #ffffff; padding: 0 8px; font-size: 12px; color: #666666; }
    .footer-note { font-size: 12px; color: #6b6b6b; margin-top: auto; text-align: center; }
  </style>

  <div id="invoice-wrapper">
     <!-- Header -->
     <div style="display: flex; justify-content: space-between; gap: 14px; align-items: center;">
       <div style="display: flex; align-items: center; gap: 14px; flex: 1;">
         <img src="${logoUrl}" alt="Logo" style="width: 84px; height: auto; max-width: 100%; object-fit: contain; display: block;" />
         <div style="flex: 1;">
           <div style="font-size: 26px; font-weight: 900; color: #1d432f; line-height: 1.1;">${SCHOOL_HEADERS.fees}</div>
           <div style="font-size: 18px; font-weight: 700; color: #4d4d4d; margin-top: 4px;">المدرسة الصمدانية للتعليم الإسلامي بغلاجيبه</div>
           <div class="small" style="margin-top: 6px;">Pir Badrul Islam Samdani Complex, Khanqah-e-Furfura Sharif, Darul Aman, Ward 02, Golachipa, Patuakhali.</div>
         </div>
       </div>
       <div style="text-align: right; min-width: 140px;">
         <div class="label">মোবাইল: +8801792776433</div>
         <div class="small" style="margin-top: 4px;">পীর বদরুল ইসলাম সামদানী কমপ্লেক্স</div>
         <div class="small">গলাচিপা, পটুয়াখালী</div>
       </div>
     </div>

    <div style="margin-top: 16px;">
      <h1 class="title">ঋণ পরিশোধের রশিদ</h1>
      <div class="subtitle">Loan Repayment Receipt (কিস্তি পরিশোধ)</div>
    </div>

    <!-- Loan & Receipt Details -->
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:12px;">
      <div class="card">
        <div class="section-heading">ঋণ বিবরণ / Loan</div>
        <div class="kv-grid">
          <div class="kv"><b>নাম:</b> <span class="value">${escapeHtml(data.personName)}</span></div>
          <div class="kv"><b>ঋণ আইডি:</b> <span class="value">${escapeHtml(data.loanId)}</span></div>
          <div class="kv"><b>ধরণ:</b> <span class="value">${typeLabel}</span></div>
          <div class="kv"><b>তারিখ:</b> <span class="value">${formatDateBn(data.date)}</span></div>
        </div>
      </div>
      <div class="card">
        <div class="section-heading">রশিদ বিবরণ / Receipt</div>
        <div class="kv-grid" style="grid-template-columns: 1fr;">
          <div class="kv"><b>রশিদ নং:</b> <span class="value">${escapeHtml(data.receiptNo)}</span></div>
          <div class="kv"><b>পূর্বে পরিশোধ:</b> <span class="value">৳ ${data.repaidBefore.toFixed(2)}</span></div>
          ${data.note ? `<div class="kv"><b>মন্তব্য:</b> <span class="value">${escapeHtml(data.note)}</span></div>` : ''}
        </div>
      </div>
    </div>

    <!-- Summary: Total, Paid this installment, Remaining -->
    <div class="card" style="margin-top: 10px;">
      <div class="section-heading">সারসংক্ষেপ / Summary</div>
      <div class="kv-grid" style="grid-template-columns: 1fr 1fr 1fr; gap: 8px;">
        <div class="kv"><b>মোট ঋণ :</b> <span class="value">৳ ${data.totalAmount.toFixed(2)}</span></div>
        <div class="kv"><b>এই কিস্তিতে জমা :</b> <span class="value">৳ ${data.amountPaid.toFixed(2)}</span> <span class="small">(${numberToBengaliWords(data.amountPaid)})</span></div>
        <div class="kv"><b>অবশিষ্ট বাকী :</b> <span class="value" style="color: ${remainingColor};">${remainingText}</span></div>
      </div>
    </div>

    <!-- Signature line -->
    <div style="display: flex; justify-content: space-between; gap: 24px; margin-top: 14px;">
      <div style="flex: 1; text-align: center;">
        <div style="border-bottom: 1px solid #333333; height: 30px;"></div>
        <div class="label" style="margin-top: 4px;">অধ্যক্ষ</div>
      </div>
      <div style="flex: 1; text-align: center;">
        <div style="border-bottom: 1px solid #333333; height: 30px;"></div>
        <div class="label" style="margin-top: 4px;">অ্যাকাউন্টস অফিসার</div>
      </div>
    </div>

    <div style="margin-top: 10px; text-align: center;">
      <div class="label">/ Received By: <span class="value">সামদানিয়া মাদ্রাসা</span></div>
    </div>

    <div class="cutline"><span>✂ Cut here</span></div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px;">
      <div class="card">
        <div class="section-heading">অফিস কপি / Admin</div>
        <div class="kv-grid" style="grid-template-columns: 1fr;">
          <div class="kv"><b>নাম:</b> <span class="value">${escapeHtml(data.personName)}</span></div>
          <div class="kv"><b>ঋণ আইডি:</b> <span class="value">${escapeHtml(data.loanId)}</span></div>
          <div class="kv"><b>ধরণ:</b> <span class="value">${typeLabel}</span></div>
        </div>
      </div>
      <div class="card">
        <div class="section-heading">সংক্ষেপ / Summary</div>
        <div class="kv-grid" style="grid-template-columns: 1fr;">
          <div class="kv"><b>রশিদ নং:</b> <span class="value">${escapeHtml(data.receiptNo)}</span></div>
          <div class="kv"><b>এই কিস্তিতে জমা :</b> <span class="value">৳ ${data.amountPaid.toFixed(2)}</span> <span class="small">(${numberToBengaliWords(data.amountPaid)})</span></div>
          <div class="kv"><b>অবশিষ্ট বাকী :</b> <span class="value" style="color: ${remainingColor};">${remainingText}</span></div>
        </div>
      </div>
    </div>

    <div class="footer-note">Email: samdaniamadrasha@gmail.com</div>
  </div>
</div>
  `;

  // ── Print: straight to the browser's print engine (instant, no PDF round-trip)
  if (options.print) {
    await printHtmlDirect(html, {
      pageWidthPx: 816,
      pageHeightPx: 1056,
      pageSize: '215.9mm 279.4mm',
      rootId: 'invoice-root',
    });
    return;
  }

  const styleTag = document.createElement('style');
  styleTag.textContent = `
    @font-face {
      font-family: 'SolaimanLipi';
      src: url('data:font/truetype;base64,${BENGALI_FONT_BASE64}') format('truetype');
      font-weight: normal;
      font-style: normal;
    }
  `;
  document.head.appendChild(styleTag);

  const wrapper = document.createElement('div');
  wrapper.style.cssText = `
    position:fixed;
    top:0;
    left:0;
    z-index:-9999;
    pointer-events:none;
    opacity:1;
    width:816px;
    overflow:visible;
  `;
  wrapper.innerHTML = html;
  document.body.appendChild(wrapper);

  const container = wrapper.querySelector('#invoice-root') as HTMLElement;

  await waitForFont('SolaimanLipi');
  await new Promise<void>((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = logoUrl;
    if (img.complete) resolve();
  });
  await new Promise((resolve) => setTimeout(resolve, 300));

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      width: container.offsetWidth,
      height: container.scrollHeight,
      windowWidth: 816,
      windowHeight: container.scrollHeight,
      x: 0,
      y: 0,
      scrollY: -window.scrollY
    });

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
    const scale = Math.min(pageW / canvas.width, pageH / canvas.height);
    const drawW = canvas.width * scale;
    const drawH = canvas.height * scale;
    doc.addImage(canvas.toDataURL('image/jpeg', 1.0), 'JPEG', (pageW - drawW) / 2, (pageH - drawH) / 2, drawW, drawH);

    doc.save(`LoanReceipt_${data.personName.replace(/\s+/g, '_')}_${data.receiptNo}.pdf`);
  } finally {
    document.body.removeChild(wrapper);
    document.head.removeChild(styleTag);
  }
};

// ── Finance Report (jsPDF native) ────────────────────────────────────────────
export const generateFinanceReportPDF = (
  transactions: LedgerTransaction[],
  fundBalances: { General: number; Zakat: number; Lillah: number }
) => {
  const doc = new jsPDF();
  const registerBengaliFont = (doc: jsPDF) => {
    doc.addFileToVFS('SolaimanLipi.ttf', BENGALI_FONT_BASE64);
    doc.addFont('SolaimanLipi.ttf', 'SolaimanLipi', 'normal');
    doc.addFont('SolaimanLipi.ttf', 'SolaimanLipi', 'bold');
  };
  registerBengaliFont(doc);
  doc.setFont('SolaimanLipi', 'normal');

  const dark: [number, number, number] = [30, 30, 30];

  doc.setFillColor(...dark);
  doc.rect(0, 0, 210, 35, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('SolaimanLipi', 'bold');
  doc.setFontSize(16);
  doc.text('SAMDANIA TALIMUL ISLAM MADRASAH', 105, 13, { align: 'center' });
  doc.setFontSize(9);
  doc.setFont('SolaimanLipi', 'normal');
  doc.text('FINANCIAL LEDGER & FUND STATUS REPORT', 105, 21, { align: 'center' });
  doc.text(`Generated: ${new Date().toLocaleString('en-US')}`, 105, 28, { align: 'center' });

  doc.setTextColor(40, 40, 40);
  doc.setFont('SolaimanLipi', 'bold');
  doc.setFontSize(10);
  doc.text('INSTITUTIONAL FUNDS STATUS', 15, 46);

  const totalBalance = fundBalances.General + fundBalances.Zakat + fundBalances.Lillah;
  const cardW = 57;
  const cardY = 50;
  const cardH = 22;

  const funds = [
    { label: 'GENERAL FUND',  val: fundBalances.General,  x: 15 },
    { label: 'ZAKAT FUND',    val: fundBalances.Zakat,    x: 15 + cardW + 5 },
    { label: 'LILLAH FUND',   val: fundBalances.Lillah,   x: 15 + (cardW + 5) * 2 },
  ];
  funds.forEach(f => {
    doc.setFillColor(248, 248, 248);
    doc.rect(f.x, cardY, cardW, cardH, 'F');
    doc.setDrawColor(30, 30, 30);
    doc.rect(f.x, cardY, cardW, cardH, 'D');
    doc.setFont('SolaimanLipi', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(60, 60, 60);
    doc.text(f.label, f.x + 4, cardY + 7);
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(`TK ${f.val.toFixed(2)}`, f.x + 4, cardY + 17);
  });

  doc.setFont('SolaimanLipi', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30, 30, 30);
  doc.text(`TOTAL TREASURY BALANCE: TK ${totalBalance.toFixed(2)}`, 15, 82);

  doc.setFontSize(10);
  doc.text('DETAILED TRANSACTION LEDGER', 15, 91);

  autoTable(doc, {
    startY: 95,
    head: [['Date', 'Type', 'Fund', 'Category', 'Amount', 'Description']],
    body: transactions.map(t => [
      formatDate(t.date),
      t.type.toUpperCase(),
      t.fund.toUpperCase(),
      t.category,
      (t.type === 'Income' ? '+' : '-') + `TK ${t.amount.toFixed(2)}`,
      t.description,
    ]),
    theme: 'grid',
    headStyles: { fillColor: dark, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { font: 'SolaimanLipi', fontSize: 8, cellPadding: 2 },
    columnStyles: { 4: { fontStyle: 'bold' }, 5: { cellWidth: 50 } },
    styles: { font: 'SolaimanLipi' },
  });

  const footY = (doc as any).lastAutoTable.finalY + 12;
  doc.setTextColor(120, 120, 120);
  doc.setFontSize(7.5);
  doc.setFont('SolaimanLipi', 'normal');
  doc.text('Samdania Talimul Islam Madrasah — All transactions are logged and verified.', 15, footY);

  doc.save('Samdania_Finance_Report.pdf');
};

// ── Monthly Class Attendance Invoice / Report ─────────────────────────────
export const generateAttendanceInvoicePDF = async (
  records: StudentAttendanceRecord[],
  monthLabel: string,
  year: number,
  options: { download?: boolean; print?: boolean } = {}
) => {
  const pageW = 215.9;
  const pageH = 279.4;

  const sorted = [...records].sort((a, b) =>
    a.className === b.className ? a.date.localeCompare(b.date) : a.className.localeCompare(b.className)
  );

  const byClass = new Map<string, StudentAttendanceRecord[]>();
  for (const r of sorted) {
    if (!byClass.has(r.className)) byClass.set(r.className, []);
    byClass.get(r.className)!.push(r);
  }

  let totalPresent = 0;
  let totalAbsent = 0;
  let totalStudents = 0;
  for (const r of sorted) {
    for (const s of r.statuses) {
      totalStudents++;
      if (s.present) totalPresent++;
      else totalAbsent++;
    }
  }

  const classSummaryRows = [...byClass.entries()].map(([cls, recs]) => {
    let p = 0;
    let a = 0;
    for (const r of recs) for (const s of r.statuses) {
      if (s.present) p++;
      else a++;
    }
    return `
      <tr>
        <td style="border:1px solid #d7c7a9;padding:6px 10px;font-size:13px;text-align:left;color:#2f2f2f;font-weight:600;">${cls}</td>
        <td style="border:1px solid #d7c7a9;padding:6px 10px;font-size:13px;text-align:center;color:#1f2f26;font-weight:700;">${recs.length}</td>
        <td style="border:1px solid #d7c7a9;padding:6px 10px;font-size:13px;text-align:center;color:#2f6b43;font-weight:700;">${p}</td>
        <td style="border:1px solid #d7c7a9;padding:6px 10px;font-size:13px;text-align:center;color:#a8483a;font-weight:700;">${a}</td>
        <td style="border:1px solid #d7c7a9;padding:6px 10px;font-size:13px;text-align:center;color:#1f2f26;font-weight:800;">${p + a}</td>
      </tr>`;
  }).join('');

  const detailRows = sorted.map((r) => {
    const p = r.statuses.filter((s) => s.present).length;
    const a = r.statuses.length - p;
    return `
      <tr>
        <td style="border:1px solid #d7c7a9;padding:6px 10px;font-size:13px;text-align:left;color:#2f2f2f;font-weight:600;">${r.className}</td>
        <td style="border:1px solid #d7c7a9;padding:6px 10px;font-size:13px;text-align:center;color:#3c3c3c;">${r.date}</td>
        <td style="border:1px solid #d7c7a9;padding:6px 10px;font-size:13px;text-align:left;color:#3c3c3c;">${r.teacherName}</td>
        <td style="border:1px solid #d7c7a9;padding:6px 10px;font-size:13px;text-align:center;color:#2f6b43;font-weight:700;">${p}</td>
        <td style="border:1px solid #d7c7a9;padding:6px 10px;font-size:13px;text-align:center;color:#a8483a;font-weight:700;">${a}</td>
        <td style="border:1px solid #d7c7a9;padding:6px 10px;font-size:13px;text-align:center;color:#1f2f26;font-weight:800;">${r.statuses.length}</td>
      </tr>`;
  }).join('');

  const monthBn = BENGALI_MONTHS[monthLabel] || monthLabel;

  const html = `
<div id="att-root">
  <style>
    html, body { margin: 0; padding: 0; width: 100%; }
    body { background: #ffffff; }
    #att-root { width: 816px; min-height: 1056px; margin: 0; padding: 0; box-sizing: border-box; background: #ffffff; overflow: hidden; }
    #att-wrapper { width: 100%; padding: 18px; box-sizing: border-box; background: #ffffff; border: 1px solid #dcd1ba; border-radius: 12px; display: flex; flex-direction: column; }
    .att-title { font-size: 22px; margin: 0; color: #1b3929; font-weight: 800; text-align: center; }
    .att-subtitle { font-size: 13px; margin-top: 4px; color: #5b5b5b; text-align: center; }
    .att-section { font-size: 14px; margin: 16px 0 8px 0; color: #314234; font-weight: bold; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #d7c7a9; }
    th { background: #ebe3d2; font-size: 13px; font-weight: 700; padding: 7px 10px; }
    .att-total-row td { background: #f5efe2; font-weight: 800; font-size: 13px; }
    .att-grand { display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; margin-top:16px; }
    .att-card { border:1px solid #e2d4b5; border-radius:8px; padding:10px; background:#fbf8f3; text-align:center; }
    .att-footer { font-size: 11px; color: #6b6b6b; margin-top: auto; text-align: center; padding-top: 14px; }
  </style>

  <div id="att-wrapper">
    <!-- Header with logo on the top-left -->
    <div style="display: flex; justify-content: space-between; gap: 14px; align-items: center;">
      <div style="display: flex; align-items: center; gap: 14px; flex: 1;">
        <img src="${logoUrl}" alt="Logo" style="width: 78px; height: auto; max-width: 100%; object-fit: contain; display: block;" />
        <div style="flex: 1;">
          <div style="font-size: 24px; font-weight: 900; color: #1d432f; line-height: 1.1;">সামদানিয়া তালীমুল ইসলাম মাদ্রাসা</div>
          <div style="font-size: 16px; font-weight: 700; color: #4d4d4d; margin-top: 4px;">المدرسة الصمدانية للتعليم الإسلامي بغلاجيبه</div>
          <div style="font-size: 11px; color: #555; margin-top: 6px;">Pir Badrul Islam Samdani Complex, Khanqah-e-Furfura Sharif, Darul Aman, Ward 02, Golachipa, Patuakhali.</div>
        </div>
      </div>
      <div style="text-align: right; min-width: 140px;">
        <div style="font-size: 13px; font-weight: 700; color: #444;">মোবাইল: +8801792776433</div>
        <div style="font-size: 11px; color: #555; margin-top: 4px;">পীর বদরুল ইসলাম সামদানী কমপ্লেক্স</div>
        <div style="font-size: 11px; color: #555;">গলাচিপা, পটুয়াখালী</div>
      </div>
    </div>

    <div style="margin-top: 16px;">
      <h1 class="att-title">ক্লাস উপস্থিতির মাসিক রিপোর্ট</h1>
      <div class="att-subtitle">Monthly Class Attendance Invoice · ${monthLabel} (${monthBn}) ${year}</div>
    </div>

    <div class="att-grand">
      <div class="att-card">
        <div style="font-size:11px;font-weight:700;color:#2f6b43;">Total Present (হাজির)</div>
        <div style="font-size:15px;font-weight:800;color:#2f6b43;margin-top:4px;">${totalPresent}</div>
      </div>
      <div class="att-card">
        <div style="font-size:11px;font-weight:700;color:#a8483a;">Total Absent (অনুপস্থিত)</div>
        <div style="font-size:15px;font-weight:800;color:#a8483a;margin-top:4px;">${totalAbsent}</div>
      </div>
      <div class="att-card">
        <div style="font-size:11px;font-weight:700;color:#1f2f26;">Records (রেকর্ড)</div>
        <div style="font-size:15px;font-weight:800;color:#1f2f26;margin-top:4px;">${totalStudents}</div>
      </div>
    </div>

    <div class="att-section">Class Summary / শ্রেণীভিত্তিক সারসংক্ষেপ</div>
    <table>
      <thead>
        <tr>
          <th style="text-align:left;">Class (শ্রেণী)</th>
          <th style="text-align:center;">Days</th>
          <th style="text-align:center;">Present (হাজির)</th>
          <th style="text-align:center;">Absent (অনুপস্থিত)</th>
          <th style="text-align:center;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${classSummaryRows || `<tr><td colspan="5" style="border:1px solid #d7c7a9;padding:7px 10px;font-size:12px;text-align:center;color:#888;">No records (কোনো রেকর্ড নেই)</td></tr>`}
      </tbody>
    </table>

    <div class="att-section">Daily Detail / দৈনন্দিন বিবরণ</div>
    <table>
      <thead>
        <tr>
          <th style="text-align:left;">Class (শ্রেণী)</th>
          <th style="text-align:center;">Date (তারিখ)</th>
          <th style="text-align:left;">Teacher (শিক্ষক)</th>
          <th style="text-align:center;">Present (হাজির)</th>
          <th style="text-align:center;">Absent (অনুপস্থিত)</th>
          <th style="text-align:center;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${detailRows || `<tr><td colspan="6" style="border:1px solid #d7c7a9;padding:7px 10px;font-size:12px;text-align:center;color:#888;">No records (কোনো রেকর্ড নেই)</td></tr>`}
      </tbody>
    </table>

    <div class="att-footer">Email: samdaniamadrasha@gmail.com &nbsp;•&nbsp; Generated: ${new Date().toLocaleString('en-US')}</div>
  </div>
</div>
  `;

  // ── Print: straight to the browser's print engine (instant, no PDF round-trip)
  if (options.print) {
    await printHtmlDirect(html, {
      pageWidthPx: 816,
      pageHeightPx: 1056,
      pageSize: '215.9mm 279.4mm',
      rootId: 'print-page-wrapper',
    });
    return;
  }

  const styleTag = document.createElement('style');
  styleTag.textContent = `
    @font-face {
      font-family: 'SolaimanLipi';
      src: url('data:font/truetype;base64,${BENGALI_FONT_BASE64}') format('truetype');
      font-weight: normal;
      font-style: normal;
    }
  `;
  document.head.appendChild(styleTag);

  const wrapper = document.createElement('div');
  wrapper.style.cssText = `
    position:fixed; top:0; left:0; z-index:-9999; pointer-events:none; opacity:1;
    width:816px; overflow:visible;
  `;
  wrapper.innerHTML = html;
  document.body.appendChild(wrapper);

  const container = wrapper.querySelector('#att-root') as HTMLElement;

  await waitForFont('SolaimanLipi');
  await new Promise<void>((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = logoUrl;
    if (img.complete) resolve();
  });
  await new Promise((resolve) => setTimeout(resolve, 300));

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      width: container.offsetWidth,
      height: container.scrollHeight,
      windowWidth: 816,
      windowHeight: container.scrollHeight,
      x: 0,
      y: 0,
      scrollY: -window.scrollY,
    });

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
    const scale = Math.min(pageW / canvas.width, pageH / canvas.height);
    const drawW = canvas.width * scale;
    const drawH = canvas.height * scale;
    doc.addImage(canvas.toDataURL('image/jpeg', 1.0), 'JPEG', (pageW - drawW) / 2, (pageH - drawH) / 2, drawW, drawH);

    doc.save(`Samdania_Attendance_${monthLabel}_${year}.pdf`);
  } finally {
    document.body.removeChild(wrapper);
    document.head.removeChild(styleTag);
  }
};
export interface ClosingReportRow {
  period: string;
  income: number;
  expense: number;
  net: number;
}

export interface ClosingReportData {
  title: string;          // e.g. "Monthly Closing Statement"
  subtitle: string;       // e.g. "খতম / মাসভিত্তিক হিসাব"
  periodHeader: string;   // "Month" or "Year"
  rows: ClosingReportRow[];
  incomeBreakdown: { category: string; amount: number }[];
  expenseBreakdown: { category: string; amount: number }[];
}

export const generateClosingReportPDF = async (
  data: ClosingReportData,
  options: { download?: boolean; print?: boolean } = {}
) => {
  const totalIncome = data.rows.reduce((s, r) => s + r.income, 0);
  const totalExpense = data.rows.reduce((s, r) => s + r.expense, 0);
  const totalNet = totalIncome - totalExpense;

  const fmt = (n: number) => `৳ ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const netText = (n: number) => (n < 0 ? `আপনি ঋণে আছেন ${fmt(n)}` : fmt(n));

  const summaryRows = data.rows.map((r) => `
    <tr>
      <td style="border:1px solid #d7c7a9;padding:7px 10px;font-size:13px;text-align:left;color:#2f2f2f;font-weight:600;">${r.period}</td>
      <td style="border:1px solid #d7c7a9;padding:7px 10px;font-size:13px;text-align:right;color:#2f6b43;font-weight:700;">${fmt(r.income)}</td>
      <td style="border:1px solid #d7c7a9;padding:7px 10px;font-size:13px;text-align:right;color:#a8483a;font-weight:700;">${fmt(r.expense)}</td>
      <td style="border:1px solid #d7c7a9;padding:7px 10px;font-size:13px;text-align:right;color:#1f2f26;font-weight:800;">${netText(r.net)}</td>
    </tr>`).join('');

  const breakdownRows = (items: { category: string; amount: number }[]) =>
    items.length === 0
      ? `<tr><td colspan="2" style="border:1px solid #d7c7a9;padding:7px 10px;font-size:12px;text-align:center;color:#888;">কোনো রেকর্ড নেই / No records</td></tr>`
      : items.map((b) => `
        <tr>
          <td style="border:1px solid #d7c7a9;padding:6px 10px;font-size:12px;text-align:left;color:#2f2f2f;">${b.category}</td>
          <td style="border:1px solid #d7c7a9;padding:6px 10px;font-size:12px;text-align:right;font-weight:700;color:#1f2f26;">${fmt(b.amount)}</td>
        </tr>`).join('');

  const html = `
<div id="closing-root">
  <style>
    html, body { margin: 0; padding: 0; width: 100%; }
    body { background: #ffffff; }
    #closing-root { width: 816px; min-height: 1056px; margin: 0; padding: 0; box-sizing: border-box; background: #ffffff; overflow: hidden; }
    #closing-wrapper { width: 100%; padding: 18px; box-sizing: border-box; background: #ffffff; border: 1px solid #dcd1ba; border-radius: 12px; display: flex; flex-direction: column; }
    .cl-title { font-size: 22px; margin: 0; color: #1b3929; font-weight: 800; text-align: center; }
    .cl-subtitle { font-size: 13px; margin-top: 4px; color: #5b5b5b; text-align: center; }
    .cl-section { font-size: 14px; margin: 14px 0 8px 0; color: #314234; font-weight: bold; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #d7c7a9; }
    th { background: #ebe3d2; font-size: 13px; font-weight: 700; padding: 7px 10px; }
    .cl-total-row td { background: #f5efe2; font-weight: 800; font-size: 13px; }
    .cl-breakdown-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .cl-footer { font-size: 11px; color: #6b6b6b; margin-top: auto; text-align: center; padding-top: 14px; }
  </style>

  <div id="closing-wrapper">
    <!-- Header with logo -->
    <div style="display: flex; justify-content: space-between; gap: 14px; align-items: center;">
      <div style="display: flex; align-items: center; gap: 14px; flex: 1;">
        <img src="${logoUrl}" alt="Logo" style="width: 78px; height: auto; max-width: 100%; object-fit: contain; display: block;" />
        <div style="flex: 1;">
          <div style="font-size: 24px; font-weight: 900; color: #1d432f; line-height: 1.1;">সামদানিয়া তালীমুল ইসলাম মাদ্রাসা</div>
          <div style="font-size: 16px; font-weight: 700; color: #4d4d4d; margin-top: 4px;">المدرسة الصمدانية للتعليم الإسلامي بغلاجيبه</div>
          <div style="font-size: 11px; color: #555; margin-top: 6px;">Pir Badrul Islam Samdani Complex, Khanqah-e-Furfura Sharif, Darul Aman, Ward 02, Golachipa, Patuakhali.</div>
        </div>
      </div>
    </div>

    <div style="margin-top: 16px;">
      <h1 class="cl-title">${data.title}</h1>
      <div class="cl-subtitle">${data.subtitle}</div>
    </div>

    <!-- Grand totals -->
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-top:16px;">
      <div style="border:1px solid #e2d4b5;border-radius:8px;padding:10px;background:#fbf8f3;text-align:center;">
        <div style="font-size:11px;font-weight:700;color:#2f6b43;">Total Income (আয়)</div>
        <div style="font-size:15px;font-weight:800;color:#2f6b43;margin-top:4px;">${fmt(totalIncome)}</div>
      </div>
      <div style="border:1px solid #e2d4b5;border-radius:8px;padding:10px;background:#fbf8f3;text-align:center;">
        <div style="font-size:11px;font-weight:700;color:#a8483a;">Total Expense (ব্যয়)</div>
        <div style="font-size:15px;font-weight:800;color:#a8483a;margin-top:4px;">${fmt(totalExpense)}</div>
      </div>
      <div style="border:1px solid #e2d4b5;border-radius:8px;padding:10px;background:#f5efe2;text-align:center;">
        <div style="font-size:11px;font-weight:700;color:#1f2f26;">Net Balance (অবশিষ্ট)</div>
        <div style="font-size:15px;font-weight:800;color:#1f2f26;margin-top:4px;">${netText(totalNet)}</div>
      </div>
    </div>

    <!-- Period summary table -->
    <div class="cl-section">${data.periodHeader}-wise Summary / সারসংক্ষেপ</div>
    <table>
      <thead>
        <tr>
          <th style="width:40%;text-align:left;">${data.periodHeader}</th>
          <th style="width:20%;text-align:right;">Income</th>
          <th style="width:20%;text-align:right;">Expense</th>
          <th style="width:20%;text-align:right;">Net</th>
        </tr>
      </thead>
      <tbody>
        ${summaryRows}
        <tr class="cl-total-row">
          <td style="border:1px solid #d7c7a9;padding:7px 10px;font-size:13px;text-align:left;">TOTAL</td>
          <td style="border:1px solid #d7c7a9;padding:7px 10px;font-size:13px;text-align:right;color:#2f6b43;">${fmt(totalIncome)}</td>
          <td style="border:1px solid #d7c7a9;padding:7px 10px;font-size:13px;text-align:right;color:#a8483a;">${fmt(totalExpense)}</td>
          <td style="border:1px solid #d7c7a9;padding:7px 10px;font-size:13px;text-align:right;">${netText(totalNet)}</td>
        </tr>
      </tbody>
    </table>

    <!-- Category breakdown -->
    <div class="cl-breakdown-grid">
      <div>
        <div class="cl-section" style="margin-top:6px;">Income by Category / আয়ের খাত</div>
        <table>
          <thead>
            <tr><th style="text-align:left;">Category</th><th style="text-align:right;">Amount</th></tr>
          </thead>
          <tbody>${breakdownRows(data.incomeBreakdown)}</tbody>
        </table>
      </div>
      <div>
        <div class="cl-section" style="margin-top:6px;">Expense by Category / ব্যয়ের খাত</div>
        <table>
          <thead>
            <tr><th style="text-align:left;">Category</th><th style="text-align:right;">Amount</th></tr>
          </thead>
          <tbody>${breakdownRows(data.expenseBreakdown)}</tbody>
        </table>
      </div>
    </div>

    <!-- Signature block: অধ্যক্ষ (left) / অ্যাকাউন্টস অফিসার (right) -->
    <div style="display:flex;justify-content:space-between;gap:24px;margin-top:20px;">
      <div style="flex:1;text-align:center;">
        <div style="border-bottom:1px solid #333333;height:32px;"></div>
        <div style="font-size:12px;font-weight:bold;color:#2f2f2f;margin-top:6px;font-family:'SolaimanLipi',sans-serif;">অধ্যক্ষ</div>
      </div>
      <div style="flex:1;text-align:center;">
        <div style="border-bottom:1px solid #333333;height:32px;"></div>
        <div style="font-size:12px;font-weight:bold;color:#2f2f2f;margin-top:6px;font-family:'SolaimanLipi',sans-serif;">অ্যাকাউন্টস অফিসার</div>
      </div>
    </div>

    <div class="cl-footer">Email: samdaniamadrasha@gmail.com &nbsp;•&nbsp; Generated: ${new Date().toLocaleString('en-US')}</div>
  </div>
</div>
  `;

  // ── Print: straight to the browser's print engine (instant, no PDF round-trip)
  if (options.print) {
    await printHtmlDirect(html, {
      pageWidthPx: 816,
      pageHeightPx: 1056,
      pageSize: '215.9mm 279.4mm',
      rootId: 'closing-root',
    });
    return;
  }

  const styleTag = document.createElement('style');
  styleTag.textContent = `
    @font-face {
      font-family: 'SolaimanLipi';
      src: url('data:font/truetype;base64,${BENGALI_FONT_BASE64}') format('truetype');
      font-weight: normal;
      font-style: normal;
    }
  `;
  document.head.appendChild(styleTag);

  const wrapper = document.createElement('div');
  wrapper.style.cssText = `
    position:fixed; top:0; left:0; z-index:-9999; pointer-events:none; opacity:1;
    width:816px; overflow:visible;
  `;
  wrapper.innerHTML = html;
  document.body.appendChild(wrapper);

  const container = wrapper.querySelector('#closing-root') as HTMLElement;

  await waitForFont('SolaimanLipi');
  await new Promise<void>((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = logoUrl;
    if (img.complete) resolve();
  });
  await new Promise((resolve) => setTimeout(resolve, 300));

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      width: container.offsetWidth,
      height: container.scrollHeight,
      windowWidth: 816,
      windowHeight: container.scrollHeight,
      x: 0,
      y: 0,
      scrollY: -window.scrollY,
    });

    const pageW = 215.9;
    const pageH = 279.4;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
    const scale = Math.min(pageW / canvas.width, pageH / canvas.height);
    const drawW = canvas.width * scale;
    const drawH = canvas.height * scale;
    doc.addImage(canvas.toDataURL('image/jpeg', 1.0), 'JPEG', (pageW - drawW) / 2, (pageH - drawH) / 2, drawW, drawH);

    const safe = data.title.replace(/\s+/g, '_');
    doc.save(`Samdania_${safe}.pdf`);
  } finally {
    document.body.removeChild(wrapper);
    document.head.removeChild(styleTag);
  }
};

/* ═══════════════════════════════════════════════════════════════════════════
   CERTIFICATE  (প্রত্যয়ন পত্র)
   Generates a clean, printable certificate. The official school certificate
   SVG is shown at the top; the student's details, guardian name, phone number
   and the appreciation text (كلمه الشكر) are laid out inside a white border.
   ═══════════════════════════════════════════════════════════════════════════ */
export interface CertificateParams {
  certType: 'enrollment' | 'transfer';
  classStudied: string;
  parentName: string;
  phoneNumber: string;
  thanksText: string;
  issueDate: string;
}

export const generateCertificatePDF = async (
  student: Student,
  data: CertificateParams,
  options: { download?: boolean; print?: boolean } = {}
) => {
  const fmtDate = (s: string) => {
    try {
      return new Date(s).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
      return s;
    }
  };

  const esc = (s: string) =>
    String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const isTransfer = data.certType === 'transfer';
  const title = isTransfer
    ? 'শংসাপত্র / Transfer Certificate (TC)'
    : 'প্রত্যয়ন পত্র / Certificate of Enrollment';
  const thisLine = isTransfer
    ? 'This is to certify that the following student was a student of this Madrasah'
    : 'This is to certify that';
  const bodyLine = isTransfer
    ? 'He/She has studied at Samdania Talimul Islam Madrasah and is now leaving / transferring to another institution. We wish him/her every success.'
    : '';

  const html = `
<div id="cert-root">
  <style>
   @font-face {
      font-family: 'SolaimanLipi';
      src: url('data:font/truetype;base64,${BENGALI_FONT_BASE64}') format('truetype');
      font-weight: normal; font-style: normal;
    }
    html, body { margin: 0; padding: 0; background: #ffffff; }
    #cert-root { width: 1123px; min-height: 794px; box-sizing: border-box; background: #ffffff; padding: 22px; }
    #cert-frame { border: 3px solid #1d432f; border-radius: 14px; padding: 18px; box-sizing: border-box; background: #ffffff; }
    #cert-inner { position: relative; border: 1px solid #c9b78f; border-radius: 10px; overflow: hidden; box-sizing: border-box; background: #ffffff; }
    .cert-img { width: 100%; height: auto; display: block; }
    .cert-center { position: absolute; top: 19%; left: 8%; right: 8%; bottom: 21%; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 7px; }
    .cert-bottom { position: absolute; left: 6%; right: 6%; bottom: 4.5%; display: flex; flex-direction: column; align-items: center; }
    .cert-title { font-family: 'SolaimanLipi', sans-serif; font-size: 30px; font-weight: 800; color: #1d432f; }
    .cert-sub { font-size: 14px; color: #5b5b5b; }
    .cert-this { font-size: 16px; color: #333; }
    .cert-name { font-family: 'SolaimanLipi', sans-serif; font-size: 42px; font-weight: 900; color: #111; line-height: 1.1; }
    .cert-meta { font-size: 17px; color: #2f2f2f; }
    .cert-meta b { color: #1d432f; }
    .cert-body { font-size: 17px; color: #333; max-width: 880px; line-height: 1.45; }
    .cert-thanks { font-family: 'SolaimanLipi', sans-serif; font-style: italic; font-size: 18px; color: #333; max-width: 860px; line-height: 1.5; }
    .cert-sign { display: flex; justify-content: space-between; gap: 40px; width: 100%; margin-top: 6px; }
    .cert-sign > div { flex: 1; text-align: center; }
    .cert-sign .line { border-bottom: 1px solid #333; height: 26px; }
    .cert-sign .lbl { font-size: 12px; font-weight: bold; color: #2f2f2f; margin-top: 5px; font-family: 'SolaimanLipi', sans-serif; }
    .cert-footer { text-align: center; font-size: 12px; color: #6b6b6b; margin-top: 6px; }
  </style>

  <div id="cert-frame">
    <div id="cert-inner">
      <img class="cert-img" src="${certSvgUrl}" alt="Samdania Madrasah Certificate" />

      <div class="cert-center">
        <div class="cert-title">${title}</div>
        <div class="cert-sub">সামদানিয়া তালীমুল ইসলাম মাদ্রাসা · Samdania Talimul Islam Madrasah</div>
        <div class="cert-this">${thisLine}</div>
        <div class="cert-name">${esc(student.name)}</div>
        <div class="cert-meta">
          Student ID: <b>${esc(student.id)}</b> &nbsp;•&nbsp; Class Studied: <b>${esc(data.classStudied || student.class)}</b> &nbsp;•&nbsp; Roll: <b>${esc(String(student.roll))}</b>
        </div>
        <div class="cert-meta">
          Father: <b>${esc(student.fatherName || '-')}</b> &nbsp;•&nbsp; Mother: <b>${esc(student.motherName || '-')}</b>
        </div>
        <div class="cert-meta">
          Guardian: <b>${esc(data.parentName || '-')}</b> &nbsp;•&nbsp; Phone: <b>${esc(data.phoneNumber || '-')}</b>
        </div>
        ${bodyLine ? `<div class="cert-body">${esc(bodyLine)}</div>` : ''}
        <div class="cert-thanks">${esc(data.thanksText || (isTransfer ? 'We pray for his/her continued success and good conduct in the new school.' : 'We pray for his/her continued success and good conduct.'))}</div>
      </div>

      <div class="cert-bottom">
        <div class="cert-sign">
          <div>
            <div class="line"></div>
            <div class="lbl">অধ্যক্ষ / Principal</div>
          </div>
          <div>
            <div class="line"></div>
            <div class="lbl">অ্যাকাউন্টস অফিসার / Accounts Officer</div>
          </div>
        </div>
        <div class="cert-footer">Issue Date: ${fmtDate(data.issueDate)} &nbsp;•&nbsp; Email: samdaniamadrasha@gmail.com</div>
      </div>
    </div>
  </div>
</div>
  `;

  // ── Print: straight to the browser's print engine (instant, no PDF round-trip)
  if (options.print) {
    await printHtmlDirect(html, {
      pageWidthPx: 1123,
      pageHeightPx: 794,
      pageSize: 'A4 landscape',
      rootId: 'cert-root',
    });
    return;
  }

  const styleTag = document.createElement('style');
  styleTag.textContent = `
    @font-face {
      font-family: 'SolaimanLipi';
      src: url('data:font/truetype;base64,${BENGALI_FONT_BASE64}') format('truetype');
      font-weight: normal; font-style: normal;
    }
  `;
  document.head.appendChild(styleTag);

  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'position:fixed; top:0; left:0; z-index:-9999; pointer-events:none; opacity:1; width:1123px; overflow:visible;';
  wrapper.innerHTML = html;
  document.body.appendChild(wrapper);

  const container = wrapper.querySelector('#print-page-wrapper') as HTMLElement;

  // Make sure the logo image is fully decoded before we capture it
  await new Promise<void>((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = logoUrl;
    if (img.complete) resolve();
  });
  await new Promise((resolve) => setTimeout(resolve, 350));

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      width: container.offsetWidth,
      height: container.scrollHeight,
      windowWidth: 1123,
      windowHeight: container.scrollHeight,
      x: 0,
      y: 0,
      scrollY: -window.scrollY,
    });

    // A4 Landscape (297 x 210 mm) — matches the certificate's 1.414 aspect ratio
    const pageW = 297;
    const pageH = 210;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    doc.addImage(canvas.toDataURL('image/jpeg', 1.0), 'JPEG', 0, 0, pageW, pageH);

    doc.save(`Certificate_${student.name.replace(/\s+/g, '_')}_${student.id}.pdf`);
  } finally {
    document.body.removeChild(wrapper);
    document.head.removeChild(styleTag);
  }
};
