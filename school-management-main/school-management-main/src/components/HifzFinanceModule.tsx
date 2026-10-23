import React, { useMemo, useState, useEffect } from 'react';
import { LedgerTransaction } from '../types';
import { dbGet, dbSet, isDbReady, onDbReady } from '../lib/localDb';
import PasswordConfirmModal from './PasswordConfirmModal';
import {
  TrendingUp,
  TrendingDown,
  Scale,
  Plus,
  X,
  Wallet,
  PieChart as PieIcon,
  CalendarDays,
  CalendarRange,
  Trash2,
  Tag
} from 'lucide-react';

interface HifzFinanceModuleProps {
  ledger: LedgerTransaction[];
  onAddTransaction: (tx: Omit<LedgerTransaction, 'id' | 'recordedBy'>) => void;
  readOnly?: boolean;
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

const groupByPeriod = (ledger: LedgerTransaction[], mode: 'month' | 'year'): PeriodStat[] => {
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

// ── Donut (circle) chart: Income vs Expense ──────────────────────────────────
const DonutChart: React.FC<{ income: number; expense: number }> = ({ income, expense }) => {
  const total = income + expense;
  const size = 210;
  const stroke = 30;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const C = 2 * Math.PI * r;
  const incFrac = total > 0 ? income / total : 0;
  const incLen = incFrac * C;

  return (
    <div className="relative flex items-center justify-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="#e7e0d3" strokeWidth={stroke} />
        {total > 0 && (
          <>
            <circle
              cx={cx} cy={cx} r={r} fill="none" stroke="#b27d6d" strokeWidth={stroke}
              strokeDasharray={`${C - incLen} ${incLen}`}
              strokeDashoffset={0}
              transform={`rotate(${incFrac * 360 - 90} ${cx} ${cx})`}
            />
            <circle
              cx={cx} cy={cx} r={r} fill="none" stroke="#4a5d4e" strokeWidth={stroke}
              strokeDasharray={`${incLen} ${C - incLen}`}
              strokeDashoffset={0}
              transform={`rotate(-90 ${cx} ${cx})`}
            />
          </>
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[10px] uppercase tracking-wider text-stone-500 font-semibold">Net Balance</span>
        <span className={`text-xl font-black font-mono ${(income - expense) >= 0 ? 'text-[#4a5d4e]' : 'text-[#b27d6d]'}`}>
          {fmt(income - expense)}
        </span>
      </div>
    </div>
  );
};

// ── Grouped bar chart (income vs expense) ────────────────────────────────────
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

const DEFAULT_INCOME_CATEGORIES = ['Hifz Fee Collection', 'Donation', 'Other Income'];
const DEFAULT_EXPENSE_CATEGORIES = ['Teacher Salary', 'Utilities', 'Rent', 'Food & Hostel', 'Other Expense'];

export default function HifzFinanceModule({ ledger, onAddTransaction, readOnly }: HifzFinanceModuleProps) {
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    type: 'Income' as 'Income' | 'Expense',
    category: 'Hifz Fee Collection',
    amount: '',
    description: '',
  });

  // ── Category lists (persisted to local SQL db, editable) ──
  const [incomeCats, setIncomeCats] = useState<string[]>(DEFAULT_INCOME_CATEGORIES);
  const [expenseCats, setExpenseCats] = useState<string[]>(DEFAULT_EXPENSE_CATEGORIES);

  useEffect(() => {
    onDbReady(() => {
      const v = dbGet('samdani_hifz_income_categories');
      if (v) setIncomeCats(v);
      const e = dbGet('samdani_hifz_expense_categories');
      if (e) setExpenseCats(e);
    });
  }, []);

  useEffect(() => { if (isDbReady()) dbSet('samdani_hifz_income_categories', incomeCats); }, [incomeCats]);
  useEffect(() => { if (isDbReady()) dbSet('samdani_hifz_expense_categories', expenseCats); }, [expenseCats]);

  // Category management UI state
  const [showAddCat, setShowAddCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [showManageCat, setShowManageCat] = useState(false);
  const [guardAction, setGuardAction] = useState<{ label: string; onConfirm: () => void } | null>(null);

  const activeCats = form.type === 'Income' ? incomeCats : expenseCats;

  const totalIncome = useMemo(() => ledger.filter((t) => t.type === 'Income').reduce((s, t) => s + t.amount, 0), [ledger]);
  const totalExpense = useMemo(() => ledger.filter((t) => t.type === 'Expense').reduce((s, t) => s + t.amount, 0), [ledger]);
  const net = totalIncome - totalExpense;

  const monthlyStats = useMemo(() => groupByPeriod(ledger, 'month'), [ledger]);
  const yearlyStats = useMemo(() => groupByPeriod(ledger, 'year'), [ledger]);
  const incomeBreakdown = useMemo(() => categoryBreakdown(ledger, 'Income'), [ledger]);
  const expenseBreakdown = useMemo(() => categoryBreakdown(ledger, 'Expense'), [ledger]);

  const openAdd = () => {
    setForm({
      date: new Date().toISOString().split('T')[0],
      type: 'Income',
      category: incomeCats[0] || 'Hifz Fee Collection',
      amount: '',
      description: '',
    });
    setAddOpen(true);
  };

  const confirmAddCategory = () => {
    const name = newCatName.trim();
    if (!name) return;
    const list = form.type === 'Income' ? incomeCats : expenseCats;
    if (list.some((c) => c.toLowerCase() === name.toLowerCase())) {
      alert('This category already exists.');
      return;
    }
    if (form.type === 'Income') setIncomeCats([...incomeCats, name]);
    else setExpenseCats([...expenseCats, name]);
    setForm((f) => ({ ...f, category: name }));
    setNewCatName('');
    setShowAddCat(false);
  };

  const confirmRemoveCategory = (name: string) => {
    if (form.type === 'Income') {
      const next = incomeCats.filter((c) => c !== name);
      setIncomeCats(next);
      if (form.category === name) setForm((f) => ({ ...f, category: next[0] || '' }));
    } else {
      const next = expenseCats.filter((c) => c !== name);
      setExpenseCats(next);
      if (form.category === name) setForm((f) => ({ ...f, category: next[0] || '' }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(form.amount);
    if (isNaN(amt) || amt <= 0) {
      alert('Please enter a valid amount.');
      return;
    }
    onAddTransaction({
      date: form.date,
      type: form.type,
      fund: 'General',
      category: form.category,
      amount: amt,
      description: form.description || `${form.type} — ${form.category}`,
    });
    setAddOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-xl border border-stone-200 shadow-sm flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="bg-[#4a5d4e]/10 p-2 rounded-xl border border-stone-200/50 flex items-center justify-center shrink-0">
            <PieIcon className="h-7 w-7 text-[#4a5d4e]" />
          </div>
          <div>
            <h2 className="text-2xl font-serif font-bold text-[#2c332d] tracking-tight">Income &amp; Expense</h2>
            <p className="text-stone-500 text-sm mt-1">হিফজ মাদ্রাসার আয়-ব্যয় — fully independent from the Fees ledger</p>
          </div>
        </div>
        {!readOnly && (
          <button
            onClick={openAdd}
            className="w-full lg:w-auto bg-[#4a5d4e] hover:bg-[#3d4d41] text-white text-xs font-bold px-4 py-2.5 rounded-lg transition-all flex items-center justify-center gap-1.5 shadow active:scale-95 cursor-pointer border border-[#3d4d41]"
          >
            <Plus className="h-4 w-4 text-[#d9c5b2]" />
            Add Transaction
          </button>
        )}
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm flex items-center gap-3">
          <div className="bg-[#4a5d4e]/10 text-[#4a5d4e] p-2.5 rounded-lg"><TrendingUp className="h-5 w-5" /></div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-[#4a5d4e] font-semibold">Total Income</p>
            <p className="text-lg font-bold text-[#4a5d4e] font-mono">{fmt(totalIncome)}</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm flex items-center gap-3">
          <div className="bg-[#b27d6d]/10 text-[#b27d6d] p-2.5 rounded-lg"><TrendingDown className="h-5 w-5" /></div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-[#b27d6d] font-semibold">Total Expense</p>
            <p className="text-lg font-bold text-[#b27d6d] font-mono">{fmt(totalExpense)}</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm flex items-center gap-3">
          <div className="bg-[#2c332d]/10 text-[#2c332d] p-2.5 rounded-lg"><Scale className="h-5 w-5" /></div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-[#2c332d] font-semibold">Net Balance</p>
            <p className="text-lg font-bold text-[#2c332d] font-mono">{fmt(net)}</p>
          </div>
        </div>
      </div>

      {/* Donut + Category breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-5 flex flex-col items-center">
          <h4 className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-3 self-start">Income vs Expense</h4>
          <DonutChart income={totalIncome} expense={totalExpense} />
          <div className="flex items-center gap-5 mt-4 text-[11px]">
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-[#4a5d4e]"></span>Income {fmt(totalIncome)}</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-[#b27d6d]"></span>Expense {fmt(totalExpense)}</span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-4">
          <h4 className="text-xs font-bold text-[#4a5d4e] uppercase tracking-wider mb-3">Income by Category</h4>
          <div className="space-y-2">
            {incomeBreakdown.length === 0 ? (
              <p className="text-[11px] italic text-stone-400">No income records.</p>
            ) : (
              incomeBreakdown.map((b) => (
                <div key={b.category} className="flex items-center justify-between text-[11px]">
                  <span className="text-stone-600 truncate pr-2">{b.category}</span>
                  <span className="font-mono font-semibold text-[#4a5d4e]">{fmt(b.amount)}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-4">
          <h4 className="text-xs font-bold text-[#b27d6d] uppercase tracking-wider mb-3">Expense by Category</h4>
          <div className="space-y-2">
            {expenseBreakdown.length === 0 ? (
              <p className="text-[11px] italic text-stone-400">No expense records.</p>
            ) : (
              expenseBreakdown.map((b) => (
                <div key={b.category} className="flex items-center justify-between text-[11px]">
                  <span className="text-stone-600 truncate pr-2">{b.category}</span>
                  <span className="font-mono font-semibold text-[#b27d6d]">{fmt(b.amount)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Monthly Income vs Expense chart */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-5">
        <h4 className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <CalendarDays className="h-4 w-4 text-[#4a5d4e]" />
          Monthly Income vs Expense
        </h4>
        <BarChart data={monthlyStats} />
        {monthlyStats.length > 0 && (
          <div className="flex items-center gap-4 mt-3 text-[11px] text-stone-500">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#4a5d4e]"></span>Income</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#b27d6d]"></span>Expense</span>
            <span className="ml-auto text-stone-400">Hover bars for exact amounts</span>
          </div>
        )}
      </div>

      {/* Monthly Closing table */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-stone-100 bg-gradient-to-r from-[#f5f2ed] to-[#fbf9f6]">
          <CalendarDays className="h-4 w-4 text-[#4a5d4e]" />
          <h3 className="text-sm font-serif font-bold text-[#2c332d]">Monthly Closing</h3>
        </div>
        <div className="overflow-x-auto p-4">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-[#f5f2ed] text-stone-600">
                <th className="text-left font-semibold px-3 py-2.5 border border-stone-200 rounded-tl-lg">Month</th>
                <th className="text-right font-semibold px-3 py-2.5 border border-stone-200">Income</th>
                <th className="text-right font-semibold px-3 py-2.5 border border-stone-200">Expense</th>
                <th className="text-right font-semibold px-3 py-2.5 border border-stone-200 rounded-tr-lg">Net</th>
              </tr>
            </thead>
            <tbody>
              {monthlyStats.length === 0 ? (
                <tr><td colSpan={4} className="text-center italic text-stone-400 py-6 border border-stone-200">No records found.</td></tr>
              ) : (
                monthlyStats.map((r) => (
                  <tr key={r.key} className="hover:bg-[#faf9f6] transition-colors">
                    <td className="font-semibold text-[#2c332d] px-3 py-2.5 border border-stone-200">{r.label}</td>
                    <td className="text-right text-[#4a5d4e] font-mono font-semibold px-3 py-2.5 border border-stone-200">{fmt(r.income)}</td>
                    <td className="text-right text-[#b27d6d] font-mono font-semibold px-3 py-2.5 border border-stone-200">{fmt(r.expense)}</td>
                    <td className="text-right text-[#2c332d] font-mono font-bold px-3 py-2.5 border border-stone-200">{netText(r.net)}</td>
                  </tr>
                ))
              )}
              {monthlyStats.length > 0 && (
                <tr className="bg-[#f5efe2]">
                  <td className="font-bold text-[#2c332d] px-3 py-2.5 border border-stone-200">TOTAL</td>
                  <td className="text-right text-[#4a5d4e] font-mono font-bold px-3 py-2.5 border border-stone-200">{fmt(totalIncome)}</td>
                  <td className="text-right text-[#b27d6d] font-mono font-bold px-3 py-2.5 border border-stone-200">{fmt(totalExpense)}</td>
                  <td className="text-right text-[#2c332d] font-mono font-bold px-3 py-2.5 border border-stone-200">{netText(net)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Yearly Closing table */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-stone-100 bg-gradient-to-r from-[#f5f2ed] to-[#fbf9f6]">
          <CalendarRange className="h-4 w-4 text-[#4a5d4e]" />
          <h3 className="text-sm font-serif font-bold text-[#2c332d]">Yearly Closing</h3>
        </div>
        <div className="overflow-x-auto p-4">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-[#f5f2ed] text-stone-600">
                <th className="text-left font-semibold px-3 py-2.5 border border-stone-200 rounded-tl-lg">Year</th>
                <th className="text-right font-semibold px-3 py-2.5 border border-stone-200">Income</th>
                <th className="text-right font-semibold px-3 py-2.5 border border-stone-200">Expense</th>
                <th className="text-right font-semibold px-3 py-2.5 border border-stone-200 rounded-tr-lg">Net</th>
              </tr>
            </thead>
            <tbody>
              {yearlyStats.length === 0 ? (
                <tr><td colSpan={4} className="text-center italic text-stone-400 py-6 border border-stone-200">No records found.</td></tr>
              ) : (
                yearlyStats.map((r) => (
                  <tr key={r.key} className="hover:bg-[#faf9f6] transition-colors">
                    <td className="font-semibold text-[#2c332d] px-3 py-2.5 border border-stone-200">{r.label}</td>
                    <td className="text-right text-[#4a5d4e] font-mono font-semibold px-3 py-2.5 border border-stone-200">{fmt(r.income)}</td>
                    <td className="text-right text-[#b27d6d] font-mono font-semibold px-3 py-2.5 border border-stone-200">{fmt(r.expense)}</td>
                    <td className="text-right text-[#2c332d] font-mono font-bold px-3 py-2.5 border border-stone-200">{netText(r.net)}</td>
                  </tr>
                ))
              )}
              {yearlyStats.length > 0 && (
                <tr className="bg-[#f5efe2]">
                  <td className="font-bold text-[#2c332d] px-3 py-2.5 border border-stone-200">TOTAL</td>
                  <td className="text-right text-[#4a5d4e] font-mono font-bold px-3 py-2.5 border border-stone-200">{fmt(totalIncome)}</td>
                  <td className="text-right text-[#b27d6d] font-mono font-bold px-3 py-2.5 border border-stone-200">{fmt(totalExpense)}</td>
                  <td className="text-right text-[#2c332d] font-mono font-bold px-3 py-2.5 border border-stone-200">{netText(net)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Transaction Modal */}
      {addOpen && (
        <div className="fixed inset-0 bg-[#2c332d]/45 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-stone-200 shadow-xl max-w-md w-full">
            <div className="bg-[#4a5d4e] text-stone-100 p-4 border-b border-[#3d4d41] flex justify-between items-center">
              <h3 className="font-serif font-bold text-sm flex items-center gap-1.5">
                <Wallet className="h-4.5 w-4.5 text-[#d9c5b2]" />
                Add Hifz Transaction
              </h3>
              <button onClick={() => setAddOpen(false)} className="text-stone-200 hover:text-white font-bold cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">Date *</label>
                  <input
                    type="date"
                    required
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="w-full bg-stone-50 text-xs border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#4a5d4e]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">Type *</label>
                  <select
                    value={form.type}
                    onChange={(e) => {
                      const type = e.target.value as 'Income' | 'Expense';
                      const first = (type === 'Income' ? incomeCats : expenseCats)[0] || '';
                      setForm({ ...form, type, category: first });
                    }}
                    className="w-full bg-stone-50 text-xs border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#4a5d4e]"
                  >
                    <option value="Income">Income</option>
                    <option value="Expense">Expense</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-700 mb-1">Category *</label>
                <div className="flex items-stretch gap-2">
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="flex-1 bg-stone-50 text-xs border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#4a5d4e]"
                  >
                    {activeCats.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => { setNewCatName(''); setShowAddCat(true); }}
                    title="Add new category"
                    className="bg-[#4a5d4e] hover:bg-[#3d4d41] text-white px-2.5 rounded-lg border border-[#3d4d41] flex items-center justify-center cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5 text-[#d9c5b2]" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowManageCat(true)}
                    title="Manage / remove categories"
                    className="bg-white hover:bg-stone-50 border border-stone-200 text-[#b27d6d] px-2.5 rounded-lg flex items-center justify-center cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-700 mb-1">Amount (৳) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  className="w-full bg-stone-50 text-xs border border-stone-200 rounded-lg px-3 py-2 font-mono font-bold focus:outline-none focus:border-[#4a5d4e]"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-700 mb-1">Description</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full bg-stone-50 text-xs border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#4a5d4e]"
                  placeholder="Optional note"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setAddOpen(false)}
                  className="bg-white hover:bg-stone-50 border border-stone-200 text-stone-700 text-xs px-4 py-2 rounded-lg cursor-pointer font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-[#4a5d4e] hover:bg-[#3d4d41] text-white text-xs font-bold px-5 py-2 rounded-lg shadow-sm active:scale-95 cursor-pointer border border-[#3d4d41]"
                >
                  Save Transaction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Category Modal */}
      {showAddCat && (
        <div className="fixed inset-0 bg-[#2c332d]/45 backdrop-blur-xs flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-xl border border-stone-200 shadow-xl max-w-sm w-full">
            <div className="bg-[#4a5d4e] text-stone-100 p-4 border-b border-[#3d4d41] flex justify-between items-center">
              <h3 className="font-serif font-bold text-sm flex items-center gap-1.5">
                <Tag className="h-4 w-4 text-[#d9c5b2]" />
                Add {form.type} Category
              </h3>
              <button onClick={() => setShowAddCat(false)} className="text-stone-200 hover:text-white font-bold cursor-pointer">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-stone-700 mb-1">New Category Name</label>
                <input
                  type="text"
                  autoFocus
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') setGuardAction({ label: `Add category "${newCatName.trim()}"`, onConfirm: confirmAddCategory }); }}
                  className="w-full bg-stone-50 text-xs border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#4a5d4e]"
                  placeholder="e.g. Building Fund"
                />
              </div>
              <div className="flex justify-end gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAddCat(false)}
                  className="bg-white hover:bg-stone-50 border border-stone-200 text-stone-700 text-xs px-4 py-2 rounded-lg cursor-pointer font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => setGuardAction({ label: `Add category "${newCatName.trim()}"`, onConfirm: confirmAddCategory })}
                  className="bg-[#4a5d4e] hover:bg-[#3d4d41] text-white text-xs font-bold px-5 py-2 rounded-lg shadow-sm active:scale-95 cursor-pointer border border-[#3d4d41]"
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manage / Remove Category Modal */}
      {showManageCat && (
        <div className="fixed inset-0 bg-[#2c332d]/45 backdrop-blur-xs flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-xl border border-stone-200 shadow-xl max-w-sm w-full max-h-[80vh] overflow-y-auto">
            <div className="bg-[#4a5d4e] text-stone-100 p-4 border-b border-[#3d4d41] flex justify-between items-center">
              <h3 className="font-serif font-bold text-sm flex items-center gap-1.5">
                <Trash2 className="h-4 w-4 text-[#d9c5b2]" />
                Manage {form.type} Categories
              </h3>
              <button onClick={() => setShowManageCat(false)} className="text-stone-200 hover:text-white font-bold cursor-pointer">✕</button>
            </div>
            <div className="p-4 space-y-2">
              {activeCats.length === 0 ? (
                <p className="text-[11px] italic text-stone-400 text-center py-4">No categories yet.</p>
              ) : (
                activeCats.map((c) => (
                  <div key={c} className="flex items-center justify-between bg-[#f5f2ed]/50 border border-stone-200 rounded-lg px-3 py-2">
                    <span className="text-xs font-semibold text-[#2c332d] truncate">{c}</span>
                    <button
                      onClick={() => setGuardAction({ label: `Remove category "${c}"`, onConfirm: () => confirmRemoveCategory(c) })}
                      className="text-red-500 hover:text-red-700 p-1.5 hover:bg-red-50 rounded-full transition-all cursor-pointer shrink-0"
                      title="Remove category"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {guardAction && (
        <PasswordConfirmModal
          isOpen={true}
          onClose={() => setGuardAction(null)}
          onConfirm={guardAction.onConfirm}
          actionLabel={guardAction.label}
        />
      )}
    </div>
  );
}
