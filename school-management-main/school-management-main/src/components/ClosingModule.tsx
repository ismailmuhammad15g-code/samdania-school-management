import React, { useMemo, useState } from 'react';
import { LedgerTransaction } from '../types';
import logo2 from '../assets/images/logo2.png';
import { generateClosingReportPDF, ClosingReportRow } from './PDFGenerator';
import {
  FileStack,
  Download,
  Printer,
  TrendingUp,
  TrendingDown,
  Scale,
  CalendarDays,
  CalendarRange,
  Loader2
} from 'lucide-react';

interface ClosingModuleProps {
  ledger: LedgerTransaction[];
}

interface PeriodStat {
  key: string;
  label: string;
  income: number;
  expense: number;
  net: number;
}

const fmt = (n: number) =>
  `৳ ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const netText = (n: number) => (n < 0 ? `আপনি ঋণে আছেন ${fmt(n)}` : fmt(n));

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const monthLabel = (key: string) => {
  const [y, m] = key.split('-');
  const idx = parseInt(m, 10) - 1;
  return `${MONTH_NAMES[idx] || m} ${y}`;
};

const groupByPeriod = (
  ledger: LedgerTransaction[],
  mode: 'month' | 'year'
): PeriodStat[] => {
  const map = new Map<string, { income: number; expense: number }>();
  ledger.forEach((t) => {
    const d = new Date(t.date);
    if (isNaN(d.getTime())) return;
    const key = mode === 'month'
      ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      : `${d.getFullYear()}`;
    const cur = map.get(key) || { income: 0, expense: 0 };
    if (t.type === 'Income') cur.income += t.amount;
    else cur.expense += t.amount;
    map.set(key, cur);
  });

  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, v]) => ({
      key,
      label: mode === 'month' ? monthLabel(key) : key,
      income: v.income,
      expense: v.expense,
      net: v.income - v.expense,
    }));
};

const categoryBreakdown = (ledger: LedgerTransaction[], type: 'Income' | 'Expense') => {
  const map = new Map<string, number>();
  ledger.forEach((t) => {
    if (t.type !== type) return;
    map.set(t.category, (map.get(t.category) || 0) + t.amount);
  });
  return [...map.entries()]
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);
};

// ── Elegant grouped bar chart (income vs expense) ────────────────────────────
const BarChart: React.FC<{ data: PeriodStat[]; compact?: boolean }> = ({ data, compact }) => {
  const maxVal = Math.max(1, ...data.map((d) => Math.max(d.income, d.expense)));
  const chartH = compact ? 160 : 200;

  if (data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-stone-400 text-sm italic bg-[#faf9f6] rounded-xl border border-dashed border-stone-200">
        No transaction records found.
      </div>
    );
  }

  return (
    <div className={`overflow-x-auto ${compact ? '' : 'pb-1'}`}>
      <div className="flex items-end gap-3 min-w-max px-1" style={{ height: chartH }}>
        {data.map((d) => {
          const incH = (d.income / maxVal) * (chartH - 40);
          const expH = (d.expense / maxVal) * (chartH - 40);
          return (
            <div key={d.key} className="flex flex-col items-center justify-end" style={{ width: 46 }}>
              <div className="flex items-end gap-1" style={{ height: chartH - 24 }}>
                {/* Income bar */}
                <div className="flex flex-col items-center justify-end group relative">
                  <span className="text-[9px] font-bold text-[#4a5d4e] mb-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    {fmt(d.income)}
                  </span>
                  <div
                    className="w-4 rounded-t-sm bg-[#4a5d4e] hover:bg-[#3d4d41] transition-all"
                    style={{ height: `${Math.max(2, incH)}px` }}
                    title={`Income: ${fmt(d.income)}`}
                  ></div>
                </div>
                {/* Expense bar */}
                <div className="flex flex-col items-center justify-end group relative">
                  <span className="text-[9px] font-bold text-[#b27d6d] mb-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    {fmt(d.expense)}
                  </span>
                  <div
                    className="w-4 rounded-t-sm bg-[#b27d6d] hover:bg-[#a36b5c] transition-all"
                    style={{ height: `${Math.max(2, expH)}px` }}
                    title={`Expense: ${fmt(d.expense)}`}
                  ></div>
                </div>
              </div>
              <span className="text-[9px] font-semibold text-stone-500 mt-1.5 text-center leading-tight w-[60px] truncate">
                {d.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const ClosingSection: React.FC<{
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  stats: PeriodStat[];
  breakdownIncome: { category: string; amount: number }[];
  breakdownExpense: { category: string; amount: number }[];
  periodHeader: string;
  busy: boolean;
  onDownload: () => void;
  onPrint: () => void;
}> = ({ title, subtitle, icon, stats, breakdownIncome, breakdownExpense, periodHeader, busy, onDownload, onPrint }) => {
  const totalIncome = stats.reduce((s, r) => s + r.income, 0);
  const totalExpense = stats.reduce((s, r) => s + r.expense, 0);
  const totalNet = totalIncome - totalExpense;

  return (
    <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
      {/* Section header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-4 border-b border-stone-100 bg-gradient-to-r from-[#f5f2ed] to-[#fbf9f6]">
        <div className="flex items-center gap-3">
          <div className="bg-[#4a5d4e]/10 text-[#4a5d4e] p-2.5 rounded-lg">{icon}</div>
          <div>
            <h3 className="text-lg font-serif font-bold text-[#2c332d]">{title}</h3>
            <p className="text-[11px] text-stone-500">{subtitle}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onDownload}
            disabled={busy}
            className="flex items-center justify-center gap-1.5 bg-[#4a5d4e] hover:bg-[#3d4d41] text-white text-xs font-bold px-3 py-2 rounded-lg transition-all shadow active:scale-95 cursor-pointer border border-[#3d4d41] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            Download
          </button>
          <button
            onClick={onPrint}
            disabled={busy}
            className="flex items-center justify-center gap-1.5 bg-[#d9c5b2] hover:bg-[#ceb59c] text-[#2c332d] text-xs font-bold px-3 py-2 rounded-lg transition-all shadow active:scale-95 cursor-pointer border border-[#ceb59c] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />}
            Print
          </button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Total KPI strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-[#f5f2ed] p-4 rounded-xl border border-stone-200 flex items-center gap-3">
            <div className="bg-[#4a5d4e]/10 text-[#4a5d4e] p-2.5 rounded-lg"><TrendingUp className="h-5 w-5" /></div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[#4a5d4e] font-semibold">Total Income</p>
              <p className="text-lg font-bold text-[#4a5d4e] font-mono">{fmt(totalIncome)}</p>
            </div>
          </div>
          <div className="bg-[#fdfbf7] p-4 rounded-xl border border-stone-200 flex items-center gap-3">
            <div className="bg-[#b27d6d]/10 text-[#b27d6d] p-2.5 rounded-lg"><TrendingDown className="h-5 w-5" /></div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[#b27d6d] font-semibold">Total Expense</p>
              <p className="text-lg font-bold text-[#b27d6d] font-mono">{fmt(totalExpense)}</p>
            </div>
          </div>
          <div className="bg-[#f5efe2] p-4 rounded-xl border border-stone-200 flex items-center gap-3">
            <div className="bg-[#2c332d]/10 text-[#2c332d] p-2.5 rounded-lg"><Scale className="h-5 w-5" /></div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[#2c332d] font-semibold">Net Balance</p>
              <p className="text-lg font-bold text-[#2c332d] font-mono">{fmt(totalNet)}</p>
            </div>
          </div>
        </div>

        {/* Chart */}
        <div>
          <h4 className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-3">
            {periodHeader}-wise Income vs Expense
          </h4>
          <BarChart data={stats} />
          {stats.length > 0 && (
            <div className="flex items-center gap-4 mt-3 text-[11px] text-stone-500">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#4a5d4e]"></span>Income</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#b27d6d]"></span>Expense</span>
              <span className="ml-auto text-stone-400">Hover bars for exact amounts</span>
            </div>
          )}
        </div>

        {/* Period summary table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-[#f5f2ed] text-stone-600">
                <th className="text-left font-semibold px-3 py-2.5 border border-stone-200 rounded-tl-lg">{periodHeader}</th>
                <th className="text-right font-semibold px-3 py-2.5 border border-stone-200">Income</th>
                <th className="text-right font-semibold px-3 py-2.5 border border-stone-200">Expense</th>
                <th className="text-right font-semibold px-3 py-2.5 border border-stone-200 rounded-tr-lg">Net</th>
              </tr>
            </thead>
            <tbody>
              {stats.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center italic text-stone-400 py-6 border border-stone-200">No records found.</td>
                </tr>
              ) : (
                stats.map((r) => (
                  <tr key={r.key} className="hover:bg-[#faf9f6] transition-colors">
                    <td className="font-semibold text-[#2c332d] px-3 py-2.5 border border-stone-200">{r.label}</td>
                    <td className="text-right text-[#4a5d4e] font-mono font-semibold px-3 py-2.5 border border-stone-200">{fmt(r.income)}</td>
                    <td className="text-right text-[#b27d6d] font-mono font-semibold px-3 py-2.5 border border-stone-200">{fmt(r.expense)}</td>
                    <td className="text-right text-[#2c332d] font-mono font-bold px-3 py-2.5 border border-stone-200">{netText(r.net)}</td>
                  </tr>
                ))
              )}
              {stats.length > 0 && (
                <tr className="bg-[#f5efe2]">
                  <td className="font-bold text-[#2c332d] px-3 py-2.5 border border-stone-200">TOTAL</td>
                  <td className="text-right text-[#4a5d4e] font-mono font-bold px-3 py-2.5 border border-stone-200">{fmt(totalIncome)}</td>
                  <td className="text-right text-[#b27d6d] font-mono font-bold px-3 py-2.5 border border-stone-200">{fmt(totalExpense)}</td>
                  <td className="text-right text-[#2c332d] font-mono font-bold px-3 py-2.5 border border-stone-200">{netText(totalNet)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Category breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="bg-[#faf9f6] rounded-xl border border-stone-200 p-4">
            <h4 className="text-xs font-bold text-[#4a5d4e] uppercase tracking-wider mb-3">Income by Category</h4>
            <div className="space-y-2">
              {breakdownIncome.length === 0 ? (
                <p className="text-[11px] italic text-stone-400">No income records.</p>
              ) : (
                breakdownIncome.map((b) => (
                  <div key={b.category} className="flex items-center justify-between text-[11px]">
                    <span className="text-stone-600 truncate pr-2">{b.category}</span>
                    <span className="font-mono font-semibold text-[#4a5d4e]">{fmt(b.amount)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="bg-[#faf9f6] rounded-xl border border-stone-200 p-4">
            <h4 className="text-xs font-bold text-[#b27d6d] uppercase tracking-wider mb-3">Expense by Category</h4>
            <div className="space-y-2">
              {breakdownExpense.length === 0 ? (
                <p className="text-[11px] italic text-stone-400">No expense records.</p>
              ) : (
                breakdownExpense.map((b) => (
                  <div key={b.category} className="flex items-center justify-between text-[11px]">
                    <span className="text-stone-600 truncate pr-2">{b.category}</span>
                    <span className="font-mono font-semibold text-[#b27d6d]">{fmt(b.amount)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function ClosingModule({ ledger }: ClosingModuleProps) {
  const [busy, setBusy] = useState<null | 'monthly' | 'yearly'>(null);

  const monthlyStats = useMemo(() => groupByPeriod(ledger, 'month'), [ledger]);
  const yearlyStats = useMemo(() => groupByPeriod(ledger, 'year'), [ledger]);
  const incomeBreakdown = useMemo(() => categoryBreakdown(ledger, 'Income'), [ledger]);
  const expenseBreakdown = useMemo(() => categoryBreakdown(ledger, 'Expense'), [ledger]);

  const buildRows = (stats: PeriodStat[]): ClosingReportRow[] =>
    stats.map((s) => ({ period: s.label, income: s.income, expense: s.expense, net: s.net }));

  const handleMonthly = async (mode: 'download' | 'print') => {
    setBusy('monthly');
    try {
      await generateClosingReportPDF(
        {
          title: 'Monthly Closing Statement',
          subtitle: 'খতম / মাসভিত্তিক আয়-ব্যয় হিসাব',
          periodHeader: 'Month',
          rows: buildRows(monthlyStats),
          incomeBreakdown,
          expenseBreakdown,
        },
        { [mode]: true }
      );
    } finally {
      setBusy(null);
    }
  };

  const handleYearly = async (mode: 'download' | 'print') => {
    setBusy('yearly');
    try {
      await generateClosingReportPDF(
        {
          title: 'Yearly Closing Statement',
          subtitle: 'বার্ষিক / বছরভিত্তিক আয়-ব্যয় হিসাব',
          periodHeader: 'Year',
          rows: buildRows(yearlyStats),
          incomeBreakdown,
          expenseBreakdown,
        },
        { [mode]: true }
      );
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-xl border border-stone-200 shadow-sm flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="bg-[#f5f2ed] p-2 rounded-xl border border-stone-200/50 flex items-center justify-center shrink-0">
            <img src={logo2} alt="Samdania Madrasah Logo" style={{ width: 56, height: 56, objectFit: 'contain' }} />
          </div>
          <div>
            <h2 className="text-2xl font-serif font-bold text-[#2c332d] tracking-tight">Financial Closing</h2>
            <p className="text-stone-500 text-sm mt-1">খতম — Monthly &amp; Yearly Income / Expense Summary</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-stone-500 bg-[#f5f2ed] px-3 py-2 rounded-lg border border-stone-200">
          <FileStack className="h-4 w-4 text-[#4a5d4e]" />
          {ledger.length} ledger records processed
        </div>
      </div>

      {/* Monthly Closing */}
      <ClosingSection
        title="Monthly Closing"
        subtitle="সাময়িক খতম — every transaction aggregated by month with dates"
        icon={<CalendarDays className="h-5 w-5" />}
        stats={monthlyStats}
        breakdownIncome={incomeBreakdown}
        breakdownExpense={expenseBreakdown}
        periodHeader="Month"
        busy={busy === 'monthly'}
        onDownload={() => handleMonthly('download')}
        onPrint={() => handleMonthly('print')}
      />

      {/* Yearly Closing */}
      <ClosingSection
        title="Yearly Closing"
        subtitle="বার্ষিক খতম — income & expense calculated per year"
        icon={<CalendarRange className="h-5 w-5" />}
        stats={yearlyStats}
        breakdownIncome={incomeBreakdown}
        breakdownExpense={expenseBreakdown}
        periodHeader="Year"
        busy={busy === 'yearly'}
        onDownload={() => handleYearly('download')}
        onPrint={() => handleYearly('print')}
      />
    </div>
  );
}
