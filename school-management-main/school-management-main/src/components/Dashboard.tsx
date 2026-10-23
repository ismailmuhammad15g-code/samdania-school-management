import React from 'react';
import { LedgerTransaction, FeePayment, Student } from '../types';
import logo2 from '../assets/images/logo2.png';
import { 
  TrendingUp, 
  TrendingDown, 
  Coins, 
  UserCheck, 
  AlertCircle, 
  Calendar, 
  ArrowUpRight, 
  CreditCard,
  PlusCircle,
  FileSpreadsheet
} from 'lucide-react';

interface DashboardProps {
  students: Student[];
  ledger: LedgerTransaction[];
  payments: FeePayment[];
  onNavigate: (tab: 'finance' | 'fees' | 'salaries' | 'results' | 'loans') => void;
  openAddTransaction: () => void;
  openCollectPayment: () => void;
  readOnly?: boolean;
}

export default function Dashboard({
  students,
  ledger,
  payments,
  onNavigate,
  openAddTransaction,
  openCollectPayment,
  readOnly,
}: DashboardProps) {
  
  // Calculate Finances
  const totalIncome = ledger
    .filter((t) => t.type === 'Income')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpense = ledger
    .filter((t) => t.type === 'Expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalTreasury = totalIncome - totalExpense;

  // Calculate Fund Balances
  const fundBalances = ledger.reduce(
    (acc, t) => {
      const amt = t.type === 'Income' ? t.amount : -t.amount;
      acc[t.fund] = (acc[t.fund] || 0) + amt;
      return acc;
    },
    { General: 0, Zakat: 0, Lillah: 0, Loan: 0 } as Record<string, number>
  );

  // Total outstanding dues: previous dues + current month charges (matches per-student Total Payable)
  const totalOutstandingDues = students.reduce((sum, s) => {
    const payable = (s.previousDue + s.currentMonthFee + s.examFee + s.transport + s.electricity + s.water) - s.waiver - s.advancePaid;
    return sum + Math.max(0, payable);
  }, 0);

  // Fee collected all time
  const totalCollectedThisMonth = payments.reduce((sum, p) => sum + p.amountPaid, 0);

  // Today's date string for filtering
  const todayStr = new Date().toISOString().split('T')[0];

  // Today's expense
  const todayExpense = ledger
    .filter((t) => t.type === 'Expense' && t.date === todayStr)
    .reduce((sum, t) => sum + t.amount, 0);

  // Recent transactions (last 5)
  const recentTransactions = [...ledger]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  // Recent fee payments (last 5)
  const recentPayments = [...payments]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  // SVG Chart Computations
  const maxFund = Math.max(fundBalances.General, fundBalances.Zakat, fundBalances.Lillah, fundBalances.Loan || 0, fundBalances.Zakat + fundBalances.Lillah, 100);
  const generalHeight = Math.max(10, (fundBalances.General / maxFund) * 100);
  const zakatLillahHeight = Math.max(10, ((fundBalances.Zakat + fundBalances.Lillah) / maxFund) * 100);
  const loanHeight = Math.max(10, ((fundBalances.Loan || 0) / maxFund) * 100);

  const maxTx = Math.max(totalIncome, totalExpense, 100);
  const incomeHeight = (totalIncome / maxTx) * 100;
  const expenseHeight = (totalExpense / maxTx) * 100;

  return (
    <div className="space-y-6">
      {/* Dynamic Welcome Heading */}
      <div className="bg-white p-6 rounded-xl border border-stone-200 shadow-sm flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="bg-[#f5f2ed] p-2 rounded-xl border border-stone-200/50 flex items-center justify-center shrink-0">
            <img src={logo2} alt="Samdania Madrasah Logo" style={{ width: 60, height: 60, objectFit: 'contain' }} />
          </div>
          <div>
            <h2 className="text-2xl font-serif font-bold text-[#2c332d] tracking-tight">
              Assalamualaikum Samdania Madrasah
            </h2>
            <p className="text-stone-500 text-sm mt-1">
              <span className="font-bangla">আসসালামুয়ালাইকুম সামদানিয়া মাদ্রাসা</span>
            </p>
          </div>
        </div>
        
        {/* Quick Action Buttons */}
        <div className="flex gap-2.5 w-full lg:w-auto">
          {!readOnly && (
            <button
              onClick={openCollectPayment}
              className="flex-1 lg:flex-initial bg-[#4a5d4e] hover:bg-[#3d4d41] text-white text-xs font-bold px-4 py-2.5 rounded-lg transition-all flex items-center justify-center gap-1.5 shadow active:scale-95 cursor-pointer border border-[#3d4d41]"
            >
              <CreditCard className="h-4 w-4 text-[#d9c5b2]" />
              Collect Fees
            </button>
          )}
          {!readOnly && (
            <button
              onClick={openAddTransaction}
            className="flex-1 lg:flex-initial bg-[#d9c5b2] hover:bg-[#ceb59c] text-[#2c332d] text-xs font-bold px-4 py-2.5 rounded-lg transition-all flex items-center justify-center gap-1.5 shadow active:scale-95 cursor-pointer border border-[#ceb59c]"
          >
              <PlusCircle className="h-4 w-4 text-[#4a5d4e]" />
              Record Finance
            </button>
          )}
        </div>
      </div>

      {/* Main KPI Dashboard Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-5" id="kpi-cards">
        
        {/* Treasury Card */}
        <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-sm flex items-center gap-4 min-w-0">
          <div className="bg-[#4a5d4e]/10 text-[#4a5d4e] p-3.5 rounded-lg">
            <Coins className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-stone-500 font-medium font-sans uppercase tracking-wider">Treasury Balance</p>
            <h3 className="text-2xl font-bold break-words text-[#4a5d4e] mt-1 font-sans">
              ৳ {totalTreasury.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
            <span className="text-[10px] text-[#4a5d4e] font-semibold bg-[#f5f2ed] px-1.5 py-0.5 rounded mt-1.5 inline-block border border-stone-200">
              Net Capital Cash
            </span>
          </div>
        </div>

        {/* Total Expense Card */}
        <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-sm flex items-center gap-4 min-w-0">
          <div className="bg-[#b27d6d]/10 text-[#b27d6d] p-3.5 rounded-lg">
            <TrendingDown className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-stone-500 font-medium font-sans uppercase tracking-wider">Total Expense</p>
            <h3 className="text-2xl font-bold break-words text-[#b27d6d] mt-1 font-sans">
              ৳ {totalExpense.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
            <span className="text-[10px] text-[#b27d6d] font-semibold bg-[#fdfbf7] px-1.5 py-0.5 rounded mt-1.5 inline-block border border-stone-200">
              Today: ৳ {todayExpense.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Dynamic Outstanding Dues */}
        <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-sm flex items-center gap-4 min-w-0">
          <div className="bg-[#b27d6d]/10 text-[#b27d6d] p-3.5 rounded-lg">
            <AlertCircle className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-stone-500 font-medium font-sans uppercase tracking-wider">Total Outstanding Dues (সর্বমোট বকেয়া)</p>
            <h3 className="text-2xl font-bold break-words text-[#b27d6d] mt-1 font-sans">
              ৳ {totalOutstandingDues.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
            <button 
              onClick={() => onNavigate('fees')}
              className="text-[10px] text-[#b27d6d] hover:text-[#a36b5c] font-bold underline mt-1 block text-left cursor-pointer"
            >
              View Class-wise Breakdown →
            </button>
          </div>
        </div>

        {/* Current Month Collections */}
        <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-sm flex items-center gap-4 min-w-0">
          <div className="bg-[#4a5d4e]/15 text-[#4a5d4e] p-3.5 rounded-lg">
            <TrendingUp className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-stone-500 font-medium font-sans uppercase tracking-wider">Collected Fees (All Time)</p>
            <h3 className="text-2xl font-bold break-words text-[#4a5d4e] mt-1 font-sans">
              ৳ {totalCollectedThisMonth.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
            <span className="text-[10px] text-[#4a5d4e] font-semibold bg-[#f5f2ed] px-1.5 py-0.5 rounded mt-1.5 inline-block border border-stone-200">
              {payments.length} receipts generated
            </span>
          </div>
        </div>

        {/* Total Students Registered */}
        <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-sm flex items-center gap-4 min-w-0">
          <div className="bg-[#d9c5b2]/20 text-[#4a5d4e] p-3.5 rounded-lg">
            <UserCheck className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-stone-500 font-medium font-sans uppercase tracking-wider">Registered Students</p>
            <h3 className="text-2xl font-bold break-words text-[#2c332d] mt-1 font-sans">
              {students.length}
            </h3>
            <button 
              onClick={() => onNavigate('fees')}
              className="text-[10px] text-[#4a5d4e] hover:text-[#3d4d41] font-bold underline mt-1.5 block text-left cursor-pointer"
            >
              Manage Student Directory →
            </button>
          </div>
        </div>
      </div>

      {/* Fund balances specific cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5" id="funds-dashboard">
        <div className="bg-[#f5f2ed] p-5 rounded-xl border border-stone-200 shadow-sm relative overflow-hidden">
          <div className="absolute right-3 top-3 opacity-10 font-sans text-5xl font-black text-[#4a5d4e]">G</div>
          <p className="text-xs text-[#4a5d4e] font-bold">General Fund (সাধারণ তহবিল)</p>
          <h4 className="text-xl font-bold break-words text-[#2c332d] mt-1.5 font-sans">৳ {fundBalances.General.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h4>
          <p className="text-[10px] text-stone-500 mt-2">Salaries, utilities, general operations and repairs.</p>
        </div>
        <div className="bg-[#fdfbf7] p-5 rounded-xl border border-stone-200 shadow-sm relative overflow-hidden">
          <div className="absolute right-3 top-3 opacity-10 font-sans text-5xl font-black text-[#5e8c6a]">Z&amp;L</div>
          <p className="text-xs font-bold text-[#5e8c6a]">Zakat &amp; Lillah Fund (যাকাত ও লিল্লাহ ফান্ড)</p>
          <h4 className="text-xl font-bold break-words text-[#2c332d] mt-1.5 font-sans">৳ {(fundBalances.Zakat + fundBalances.Lillah).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h4>
          <p className="text-[10px] text-stone-500 mt-2">Zakat (যাকাত): ৳ {fundBalances.Zakat.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · Lillah (লিল্লাহ): ৳ {fundBalances.Lillah.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-[#fdfbf7] p-5 rounded-xl border border-stone-200 shadow-sm relative overflow-hidden">
          <div className="absolute right-3 top-3 opacity-10 font-sans text-5xl font-black text-amber-700">Q</div>
          <p className="text-xs font-bold text-amber-700">Loan Fund (ঋণ তহবিল / Qard)</p>
          <h4 className="text-xl font-bold break-words text-[#2c332d] mt-1.5 font-sans">৳ {(fundBalances.Loan || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h4>
          <p className="text-[10px] text-stone-500 mt-2">Temporary interest-free advances and givers book.</p>
        </div>
      </div>

      {/* Beautiful Dynamic Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Treasury Allocation SVG Chart */}
        <div className="bg-white p-6 rounded-xl border border-stone-200 shadow-sm">
          <h3 className="text-base font-serif font-bold text-[#2c332d] mb-5">Institutional Funds Allocation</h3>
          <div className="flex flex-col md:flex-row items-center gap-6">
            {/* Visual Bar representation */}
            <div className="w-full md:w-2/3 h-48 flex items-end justify-around border-b border-stone-200 pb-2">
              <div className="flex flex-col items-center w-14">
                <div 
                  className="w-10 bg-[#4a5d4e] hover:bg-[#3d4d41] transition-all rounded-t-md cursor-pointer"
                  style={{ height: `${generalHeight}px` }}
                ></div>
                <span className="text-[10px] font-bold mt-2 text-stone-600">General</span>
              </div>
              <div className="flex flex-col items-center w-14">
                <div 
                  className="w-10 bg-[#5e8c6a] hover:bg-[#4d7357] transition-all rounded-t-md cursor-pointer"
                  style={{ height: `${zakatLillahHeight}px` }}
                ></div>
                <span className="text-[10px] font-bold mt-2 text-stone-600">Zakat &amp; Lillah</span>
              </div>
              <div className="flex flex-col items-center w-14">
                <div 
                  className="w-10 bg-amber-600 hover:bg-amber-700 transition-all rounded-t-md cursor-pointer"
                  style={{ height: `${loanHeight}px` }}
                ></div>
                <span className="text-[10px] font-bold mt-2 text-stone-600">Loan</span>
              </div>
            </div>

            {/* Chart Legend */}
            <div className="w-full md:w-1/3 space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-[#4a5d4e]"></div>
                <div>
                  <p className="text-xs text-stone-500 leading-none">General Fund</p>
                  <p className="text-sm font-bold break-words text-[#2c332d] mt-1">৳ {fundBalances.General.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-[#5e8c6a]"></div>
                <div>
                  <p className="text-xs text-stone-500 leading-none">Zakat &amp; Lillah Fund</p>
                  <p className="text-sm font-bold break-words text-[#2c332d] mt-1">৳ {(fundBalances.Zakat + fundBalances.Lillah).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-amber-600"></div>
                <div>
                  <p className="text-xs text-stone-500 leading-none">Loan Fund</p>
                  <p className="text-sm font-bold break-words text-[#2c332d] mt-1">৳ {(fundBalances.Loan || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Income vs Expenses SVG Chart */}
        <div className="bg-white p-6 rounded-xl border border-stone-200 shadow-sm">
          <h3 className="text-base font-serif font-bold text-[#2c332d] mb-5">Income vs Expense Overview</h3>
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="w-full md:w-2/3 h-48 flex items-end justify-center gap-12 border-b border-stone-200 pb-2">
              <div className="flex flex-col items-center w-20">
                <div 
                  className="w-16 bg-[#4a5d4e] hover:bg-[#3d4d41] transition-all rounded-t-md cursor-pointer"
                  style={{ height: `${incomeHeight}px` }}
                ></div>
                <span className="text-[10px] font-bold mt-2 text-[#4a5d4e] flex items-center gap-0.5">
                  <TrendingUp className="h-3 w-3" /> Income
                </span>
              </div>
              <div className="flex flex-col items-center w-20">
                <div 
                  className="w-16 bg-[#b27d6d] hover:bg-[#a36b5c] transition-all rounded-t-md cursor-pointer"
                  style={{ height: `${expenseHeight}px` }}
                ></div>
                <span className="text-[10px] font-bold mt-2 text-[#b27d6d] flex items-center gap-0.5">
                  <TrendingDown className="h-3 w-3" /> Expense
                </span>
              </div>
            </div>

            <div className="w-full md:w-1/3 space-y-4">
              <div className="bg-[#f5f2ed] p-3 rounded-lg border border-stone-200/50">
                <p className="text-xs text-[#4a5d4e] font-bold">Total Inflow</p>
                <p className="text-lg font-bold break-words text-[#2c332d] mt-1">৳ {totalIncome.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
              <div className="bg-[#fdfbf7] p-3 rounded-lg border border-stone-200/50">
                <p className="text-xs text-[#b27d6d] font-bold">Total Outflow</p>
                <p className="text-lg font-bold break-words text-[#2c332d] mt-1">৳ {totalExpense.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Real-Time Activity Streams */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Recent Ledger Activity */}
        <div className="bg-white p-6 rounded-xl border border-stone-200 shadow-sm">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-stone-100">
            <h3 className="text-base font-serif font-bold text-[#2c332d] flex items-center gap-1.5">
              <ArrowUpRight className="h-4.5 w-4.5 text-[#4a5d4e]" />
              Recent Ledger Transactions
            </h3>
            <button
              onClick={() => onNavigate('finance')}
              className="text-xs text-[#4a5d4e] hover:text-[#3d4d41] font-semibold underline cursor-pointer"
            >
              View All
            </button>
          </div>

          {recentTransactions.length === 0 ? (
            <p className="text-stone-500 text-xs py-8 text-center italic">No transactions recorded yet.</p>
          ) : (
            <div className="space-y-3.5">
              {recentTransactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between text-xs p-2.5 hover:bg-[#f5f2ed]/55 rounded-lg transition-all border border-transparent hover:border-stone-200/50">
                  <div className="flex items-center gap-3">
                    <span className={`h-2.5 w-2.5 rounded-full ${tx.type === 'Income' ? 'bg-[#4a5d4e]' : 'bg-[#b27d6d]'}`}></span>
                    <div>
                      <p className="font-bold text-[#2c332d]">{tx.category}</p>
                      <p className="text-[10px] text-stone-500 mt-0.5">
                        {tx.date} • {tx.description.slice(0, 30)}{tx.description.length > 30 ? '...' : ''}
                      </p>
                    </div>
                  </div>
                  <div className="text-right break-words">
                    <span className={`font-bold font-mono text-sm ${tx.type === 'Income' ? 'text-[#4a5d4e]' : 'text-[#b27d6d]'}`}>
                      {tx.type === 'Income' ? '+' : '-'}৳ {tx.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className="block text-[9px] text-[#4a5d4e] font-bold bg-[#f5f2ed] px-1.5 py-0.5 rounded-full mt-1 border border-stone-200/50 uppercase text-center max-w-min mx-auto">
                      {tx.fund}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Student Fee Payments */}
        <div className="bg-white p-6 rounded-xl border border-stone-200 shadow-sm">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-stone-100">
            <h3 className="text-base font-serif font-bold text-[#2c332d] flex items-center gap-1.5">
              <CreditCard className="h-4.5 w-4.5 text-[#4a5d4e]" />
              Recent Fee Collections
            </h3>
            <button
              onClick={() => onNavigate('fees')}
              className="text-xs text-[#4a5d4e] hover:text-[#3d4d41] font-semibold underline cursor-pointer"
            >
              View All
            </button>
          </div>

          {recentPayments.length === 0 ? (
            <p className="text-stone-500 text-xs py-8 text-center italic">No fee payments collected yet.</p>
          ) : (
            <div className="space-y-3.5">
              {recentPayments.map((p) => (
                <div key={p.id} className="flex items-center justify-between text-xs p-2.5 hover:bg-[#f5f2ed]/55 rounded-lg transition-all border border-transparent hover:border-stone-200/50">
                  <div className="flex items-center gap-3">
                    <div className="bg-[#f5f2ed] text-[#4a5d4e] h-8 w-8 rounded border border-stone-200/60 flex items-center justify-center font-bold font-mono text-[10px]">
                      {p.class}
                    </div>
                    <div>
                      <p className="font-bold text-[#2c332d]">{p.studentName}</p>
                      <p className="text-[10px] text-stone-500 mt-0.5">
                        {p.date} • Month: <span className="font-bold text-[#4a5d4e]">{p.month}</span>
                      </p>
                    </div>
                  </div>
                  <div className="text-right break-words">
                    <span className="font-bold font-mono text-sm text-[#4a5d4e]">
                      ৳ {p.amountPaid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <p className="text-[9px] text-stone-400 mt-0.5">Receipt: {p.receiptNo}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
