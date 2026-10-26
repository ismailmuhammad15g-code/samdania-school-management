import React from 'react';
import { fmt, type PeriodStat } from '../lib/ledgerStats';

// ── Elegant grouped bar chart (income vs expense) ────────────────────────────
export const BarChart: React.FC<{ data: PeriodStat[]; compact?: boolean }> = ({ data, compact }) => {
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
