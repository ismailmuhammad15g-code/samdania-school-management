// Shared ledger reporting helpers (used by the Closing and Hifz Finance modules).
import type { LedgerTransaction } from '../types';

export interface PeriodStat {
  key: string;
  label: string;
  income: number;
  expense: number;
  net: number;
}

export const fmt = (n: number) =>
  `৳ ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const netText = (n: number) => (n < 0 ? `আপনি ঋণে আছেন ${fmt(n)}` : fmt(n));

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const monthLabel = (key: string) => {
  const [y, m] = key.split('-');
  const idx = parseInt(m, 10) - 1;
  return `${MONTH_NAMES[idx] || m} ${y}`;
};

export const groupByPeriod = (
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

export const categoryBreakdown = (ledger: LedgerTransaction[], type: 'Income' | 'Expense') => {
  const map = new Map<string, number>();
  ledger.forEach((t) => {
    if (t.type !== type) return;
    map.set(t.category, (map.get(t.category) || 0) + t.amount);
  });
  return [...map.entries()]
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);
};
