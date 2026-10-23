import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { LedgerTransaction, Student, FeePayment } from '../types';
import { BENGALI_FONT_BASE64 } from './BengaliFont';

// Helper to format date nicely
const formatDate = (dateStr: string) => {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch (e) {
    return dateStr;
  }
};

// Register Bengali font in jsPDF
const registerBengaliFont = (doc: jsPDF) => {
  doc.addFileToVFS('SolaimanLipi.ttf', BENGALI_FONT_BASE64);
  doc.addFont('SolaimanLipi.ttf', 'SolaimanLipi', 'normal');
  doc.addFont('SolaimanLipi.ttf', 'SolaimanLipi', 'bold');
  doc.addFont('SolaimanLipi.ttf', 'SolaimanLipi', 'italic');
};

// Generate and save a Fee Payment Receipt
export const generateFeeReceiptPDF = (payment: FeePayment, student?: Student) => {
  const doc = new jsPDF();
  registerBengaliFont(doc);
  doc.setFont('SolaimanLipi', 'normal');

  const primaryColor: [number, number, number] = [15, 81, 50]; // Deep Emerald Green

  // Add Madrasah header
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(0, 0, 210, 40, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('SolaimanLipi', 'bold');
  doc.setFontSize(18); // Slightly smaller to avoid overflow with standard font size
  doc.text('SAMDANIA TALIMUL ISLAM MADRASAH', 105, 18, { align: 'center' });
  
  doc.setFont('SolaimanLipi', 'normal');
  doc.setFontSize(10);
  doc.text('Samdania, Dhaka, Bangladesh | Email: samdaniamadrasha@gmail.com', 105, 26, { align: 'center' });
  doc.text('FEE COLLECTION RECEIPT (ফি আদায় রশিদ)', 105, 33, { align: 'center' });

  // Receipt meta details
  doc.setTextColor(50, 50, 50);
  doc.setFontSize(10);
  doc.setFont('SolaimanLipi', 'bold');
  doc.text(`রশিদ নং (Receipt No): ${payment.receiptNo}`, 15, 50);
  doc.text(`তারিখ (Date): ${formatDate(payment.date)}`, 140, 50);

  // Student Details box
  doc.setFillColor(245, 247, 245);
  doc.rect(15, 55, 180, 25, 'F');
  doc.setDrawColor(220, 225, 220);
  doc.rect(15, 55, 180, 25, 'D');

  doc.setTextColor(50, 50, 50);
  doc.setFont('SolaimanLipi', 'bold');
  doc.text('ছাত্র বিবরণী (STUDENT INFORMATION)', 20, 61);
  
  doc.setFont('SolaimanLipi', 'normal');
  doc.text(`নাম (Name): ${payment.studentName}`, 20, 68);
  doc.text(`ছাত্র আইডি (ID): ${payment.studentId}`, 20, 74);
  doc.text(`শ্রেণী (Class): ${payment.class}`, 110, 68);
  doc.text(`ফি এর মাস (Month): ${payment.month}`, 110, 74);

  // Fee Breakdown Table
  doc.setFont('SolaimanLipi', 'bold');
  doc.text('ফি বিবরণী (PAYMENT BREAKDOWN)', 15, 92);

  const tableData = [
    ['পূর্ব বকেয়া (Previous Due)', `TK ${payment.previousDue.toFixed(2)}`],
    ['বর্তমান মাস (Current Month Fee)', `TK ${payment.currentMonthFee.toFixed(2)}`],
    ['পরীক্ষার ফি (Exam Fee)', `TK ${payment.examFee.toFixed(2)}`],
    ['গাড়ি ভাড়া / পরিবহন (Transport Fee)', `TK ${payment.transport.toFixed(2)}`],
    ['বিদ্যুৎ বিল (Electricity Bill)', `TK ${payment.electricity.toFixed(2)}`],
    ['পানি বিল (Water Bill)', `TK ${payment.water.toFixed(2)}`],
    ['মওকুফ / ডিসকাউন্ট (Waiver/Discount) - বাদ', `-TK ${payment.waiver.toFixed(2)}`],
    ['অগ্রিম পরিশোধ (Advance Paid) - বাদ', `-TK ${payment.advancePaid.toFixed(2)}`],
  ];

  autoTable(doc, {
    startY: 96,
    head: [['ফি এর বিবরণ (Fee Description)', 'টাকার পরিমাণ (Amount)']],
    body: tableData,
    theme: 'striped',
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    styles: {
      font: 'SolaimanLipi',
      fontSize: 9,
      cellPadding: 3,
    },
    columnStyles: {
      0: { cellWidth: 130 },
      1: { cellWidth: 50, halign: 'right' },
    },
  });

  // Calculations section at the bottom right
  const finalY = (doc as any).lastAutoTable.finalY + 10;
  
  doc.setFillColor(245, 247, 245);
  doc.rect(110, finalY, 85, 35, 'F');
  doc.setDrawColor(212, 175, 55); // Gold outline for total
  doc.rect(110, finalY, 85, 35, 'D');

  doc.setFont('SolaimanLipi', 'normal');
  doc.setFontSize(10);
  doc.text('মোট প্রদেয় (Total Payable):', 115, finalY + 8);
  doc.text(`TK ${payment.totalPayable.toFixed(2)}`, 185, finalY + 8, { align: 'right' });

  doc.setFont('SolaimanLipi', 'bold');
  doc.text('পরিশোধিত টাকা (Amount Paid):', 115, finalY + 18);
  doc.text(`TK ${payment.amountPaid.toFixed(2)}`, 185, finalY + 18, { align: 'right' });

  const remaining = payment.totalPayable - payment.amountPaid;
  doc.setFont('SolaimanLipi', 'bold');
  if (remaining > 0) {
    doc.setTextColor(180, 50, 50); // Red for outstanding
    doc.text('বকেয়া পাওনা (Outstanding Due):', 115, finalY + 28);
    doc.text(`TK ${remaining.toFixed(2)}`, 185, finalY + 28, { align: 'right' });
  } else {
    doc.setTextColor(15, 81, 50); // Green for advance/no due
    doc.text('অগ্রিম/ফেরত (Advance/Change):', 115, finalY + 28);
    doc.text(`TK ${Math.abs(remaining).toFixed(2)}`, 185, finalY + 28, { align: 'right' });
  }

  // Footer notes and signatures
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(8);
  doc.setFont('SolaimanLipi', 'normal'); // standard fonts usually don't have true italic fallback
  doc.text('এটি সামদানীয়া তালীমুল ইসলাম মাদ্রাসার একটি কম্পিউটার জেনারেটেড রশিদ। (This is computer generated.)', 15, finalY + 45);

  // Signatures
  doc.setTextColor(50, 50, 50);
  doc.setFont('SolaimanLipi', 'normal');
  doc.setFontSize(9);
  
  doc.line(20, finalY + 65, 70, finalY + 65);
  doc.text('হিসাবরক্ষকের স্বাক্ষর (Accountant Signature)', 45, finalY + 70, { align: 'center' });

  doc.line(135, finalY + 65, 185, finalY + 65);
  doc.text('অধ্যক্ষের স্বাক্ষর (Principal Signature)', 160, finalY + 70, { align: 'center' });

  // Save the PDF
  doc.save(`FeeReceipt_${payment.studentName.replace(/\s+/g, '_')}_${payment.receiptNo}.pdf`);
};

// Generate and save a Comprehensive Finance PDF Report
export const generateFinanceReportPDF = (
  transactions: LedgerTransaction[],
  fundBalances: { General: number; Zakat: number; Lillah: number }
) => {
  const doc = new jsPDF();
  registerBengaliFont(doc);
  doc.setFont('SolaimanLipi', 'normal');

  const primaryColor: [number, number, number] = [15, 81, 50]; // Deep Emerald Green
  
  // Header banner
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(0, 0, 210, 35, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('SolaimanLipi', 'bold');
  doc.setFontSize(18);
  doc.text('SAMDANIA TALIMUL ISLAM MADRASAH', 105, 15, { align: 'center' });
  
  doc.setFont('SolaimanLipi', 'normal');
  doc.setFontSize(10);
  doc.text('FINANCIAL LEDGER & FUND STATUS REPORT', 105, 23, { align: 'center' });
  doc.text(`Report Generated: ${new Date().toLocaleDateString('en-US', { hour: '2-digit', minute: '2-digit' })}`, 105, 29, { align: 'center' });

  // Funds status summary cards
  doc.setTextColor(50, 50, 50);
  doc.setFont('SolaimanLipi', 'bold');
  doc.setFontSize(11);
  doc.text('INSTITUTIONAL FUNDS STATUS (তহবিল অবস্থা)', 15, 48);

  const totalBalance = fundBalances.General + fundBalances.Zakat + fundBalances.Lillah;

  // Render cards
  const cardWidth = 57;
  const cardY = 53;
  const cardHeight = 22;

  // General Fund Card
  doc.setFillColor(240, 245, 242);
  doc.rect(15, cardY, cardWidth, cardHeight, 'F');
  doc.setDrawColor(15, 81, 50);
  doc.rect(15, cardY, cardWidth, cardHeight, 'D');
  doc.setFont('SolaimanLipi', 'bold');
  doc.setFontSize(9);
  doc.text('GENERAL FUND', 20, cardY + 7);
  doc.setFont('SolaimanLipi', 'bold');
  doc.setFontSize(12);
  doc.text(`TK ${fundBalances.General.toFixed(2)}`, 20, cardY + 16);

  // Zakat Fund Card
  doc.setFillColor(240, 245, 242);
  doc.rect(15 + cardWidth + 5, cardY, cardWidth, cardHeight, 'F');
  doc.setDrawColor(15, 81, 50);
  doc.rect(15 + cardWidth + 5, cardY, cardWidth, cardHeight, 'D');
  doc.setFont('SolaimanLipi', 'bold');
  doc.setFontSize(9);
  doc.text('ZAKAT FUND', 15 + cardWidth + 10, cardY + 7);
  doc.setFont('SolaimanLipi', 'bold');
  doc.setFontSize(12);
  doc.text(`TK ${fundBalances.Zakat.toFixed(2)}`, 15 + cardWidth + 10, cardY + 16);

  // Lillah Fund Card
  doc.setFillColor(240, 245, 242);
  doc.rect(15 + (cardWidth * 2) + 10, cardY, cardWidth, cardHeight, 'F');
  doc.setDrawColor(15, 81, 50);
  doc.rect(15 + (cardWidth * 2) + 10, cardY, cardWidth, cardHeight, 'D');
  doc.setFont('SolaimanLipi', 'bold');
  doc.setFontSize(9);
  doc.text('LILLAH FUND', 15 + (cardWidth * 2) + 15, cardY + 7);
  doc.setFont('SolaimanLipi', 'bold');
  doc.setFontSize(12);
  doc.text(`TK ${fundBalances.Lillah.toFixed(2)}`, 15 + (cardWidth * 2) + 15, cardY + 16);

  // Net Cash Balance Info
  doc.setFont('SolaimanLipi', 'bold');
  doc.setFontSize(11);
  doc.text(`Total Treasury Balance: TK ${totalBalance.toFixed(2)}`, 15, 83);

  // Transaction History table
  doc.text('DETAILED TRANSACTION LEDGER (লেনদেন খতিয়ান)', 15, 93);

  const transRows = transactions.map((t) => [
    formatDate(t.date),
    t.type.toUpperCase(),
    t.fund.toUpperCase(),
    t.category,
    t.type === 'Income' ? `+TK ${t.amount.toFixed(2)}` : `-TK ${t.amount.toFixed(2)}`,
    t.description,
  ]);

  autoTable(doc, {
    startY: 97,
    head: [['Date', 'Type', 'Fund', 'Category', 'Amount', 'Description']],
    body: transRows,
    theme: 'grid',
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
    },
    styles: {
      font: 'SolaimanLipi',
      fontSize: 8.5,
      cellPadding: 2,
    },
    columnStyles: {
      4: { fontStyle: 'bold' },
      5: { cellWidth: 50 },
    },
  });

  // Footer note
  const lastY = (doc as any).lastAutoTable.finalY + 15;
  doc.setTextColor(120, 120, 120);
  doc.setFontSize(8);
  doc.setFont('SolaimanLipi', 'normal');
  doc.text('Samdania Talimul Islam Madrasah financial report. All transactions are logged and verified.', 15, lastY);

  doc.save('Samdania_Madrasah_Finance_Report.pdf');
};
