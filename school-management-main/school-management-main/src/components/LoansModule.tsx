import React, { useState, useMemo } from 'react';
import { LoanRecord, LoanPayment, LedgerTransaction } from '../types';
import PasswordConfirmModal from './PasswordConfirmModal';
import { generateLoanReceiptPDF } from './PDFGenerator';
import { 
  PiggyBank, 
  Plus, 
  Search, 
  TrendingUp, 
  TrendingDown, 
  CheckCircle, 
  XCircle, 
  Trash2, 
  Lock, 
  ArrowUpRight, 
  ArrowDownLeft, 
  History, 
  Edit2,
  Eye,
  Calculator,
  FileText,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Coins
} from 'lucide-react';

const BENGALI_MONTHS: Record<string, string> = {
  'January': 'জানুয়ারি', 'February': 'ফেব্রুয়ারি', 'March': 'মার্চ',
  'April': 'এপ্রিল', 'May': 'মে', 'June': 'জুন',
  'July': 'জুলাই', 'August': 'আগস্ট', 'September': 'সেপ্টেম্বর',
  'October': 'অক্টোবর', 'November': 'নভেম্বর', 'December': 'ডিসেম্বর',
};

const loanTypeMeta = (type: LoanRecord['type']) => {
  if (type === 'Taken') return { label: 'গৃহীত', color: 'bg-amber-100 text-amber-700' };
  if (type === 'Given') return { label: 'প্রদত্ত', color: 'bg-blue-100 text-blue-700' };
  return { label: 'যাকাত ও লিল্লাহ', color: 'bg-emerald-100 text-emerald-700' };
};

const formatDate = (dateStr: string) => {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('bn-BD', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return dateStr; }
};

const formatDateShort = (dateStr: string) => {
  try { return new Date(dateStr).toLocaleDateString('en-GB'); } catch { return dateStr; }
};

const toBengaliDigits = (num: number | string) => {
  const map: Record<string, string> = { '0':'০','1':'১','2':'২','3':'৩','4':'৪','5':'৫','6':'৬','7':'৭','8':'৮','9':'৯' };
  return String(num).replace(/\d/g, d => map[d] || d);
};

const formatTaka = (n: number) => `৳ ${n.toFixed(2)}`;
const formatTakaBn = (n: number) => `৳ ${toBengaliDigits(n.toFixed(2))}`;

interface LoansModuleProps {
  loans: LoanRecord[];
  loanPayments: LoanPayment[];
  ledger: LedgerTransaction[];
  onAddLoan: (loan: Omit<LoanRecord, 'id' | 'repaidAmount' | 'status' | 'recordedBy'>) => void;
  onRecordLoanPayment: (payment: Omit<LoanPayment, 'id' | 'recordedBy'>) => void;
  onDeleteLoan: (id: string) => void;
  onEditLoan?: (loan: LoanRecord) => void;
  readOnly?: boolean;
}

export default function LoansModule({
  loans,
  loanPayments,
  ledger,
  onAddLoan,
  onRecordLoanPayment,
  onDeleteLoan,
  onEditLoan,
  readOnly,
}: LoansModuleProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'directory' | 'payments' | 'summary'>('overview');
  const [loanSearch, setLoanSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'All' | 'Taken' | 'Given'>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Settled'>('All');
  const [guardAction, setGuardAction] = useState<{ label: string; onConfirm: () => void } | null>(null);

  // Forms
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingLoan, setEditingLoan] = useState<LoanRecord | null>(null);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    type: 'Given' as 'Taken' | 'Given',
    personName: '',
    contact: '',
    amount: '',
    description: ''
  });

  // Repayment
  const [repayLoan, setRepayLoan] = useState<LoanRecord | null>(null);
  const [repayAmount, setRepayAmount] = useState('');
  const [repayDate, setRepayDate] = useState(new Date().toISOString().split('T')[0]);
  const [repayNote, setRepayNote] = useState('');

  // View detail
  const [viewLoan, setViewLoan] = useState<LoanRecord | null>(null);

  // ── Computed Stats ──
  const stats = useMemo(() => {
    const takenLoans = loans.filter(l => l.type === 'Taken');
    const givenLoans = loans.filter(l => l.type === 'Given');
    
    const totalTaken = takenLoans.reduce((s, l) => s + l.amount, 0);
    const repaidTaken = takenLoans.reduce((s, l) => s + l.repaidAmount, 0);
    const outstandingTaken = totalTaken - repaidTaken;

    const totalGiven = givenLoans.reduce((s, l) => s + l.amount, 0);
    const recoveredGiven = givenLoans.reduce((s, l) => s + l.repaidAmount, 0);
    const outstandingGiven = totalGiven - recoveredGiven;

    const fundIncome = ledger
      .filter(tx => tx.fund === 'Loan' && tx.type === 'Income')
      .reduce((s, tx) => s + tx.amount, 0);
    const fundExpense = ledger
      .filter(tx => tx.fund === 'Loan' && tx.type === 'Expense')
      .reduce((s, tx) => s + tx.amount, 0);
    const fundBalance = fundIncome - fundExpense;

    // Real Zakat & Lillah fund balances straight from the ledger (income - expense).
    const zakatBalance = ledger
      .filter(tx => tx.fund === 'Zakat' && tx.type === 'Income')
      .reduce((s, tx) => s + tx.amount, 0)
      - ledger
      .filter(tx => tx.fund === 'Zakat' && tx.type === 'Expense')
      .reduce((s, tx) => s + tx.amount, 0);
    const lillahBalance = ledger
      .filter(tx => tx.fund === 'Lillah' && tx.type === 'Income')
      .reduce((s, tx) => s + tx.amount, 0)
      - ledger
      .filter(tx => tx.fund === 'Lillah' && tx.type === 'Expense')
      .reduce((s, tx) => s + tx.amount, 0);
    const zakatLillah = zakatBalance + lillahBalance;

    const activeCount = loans.filter(l => l.status === 'Active').length;
    const settledCount = loans.filter(l => l.status === 'Settled').length;

    return {
      totalTaken, repaidTaken, outstandingTaken,
      totalGiven, recoveredGiven, outstandingGiven,
      fundBalance,
      zakatBalance, lillahBalance, zakatLillah,
      activeCount, settledCount,
      totalLoans: loans.length,
      netPosition: outstandingGiven - outstandingTaken,
    };
  }, [loans, loanPayments, ledger]);

  // ── Filtered Loans ──
  const filteredLoans = useMemo(() => 
    loans.filter(l => {
      const ms = l.personName.toLowerCase().includes(loanSearch.toLowerCase()) || 
                 l.description.toLowerCase().includes(loanSearch.toLowerCase()) ||
                 l.id.toLowerCase().includes(loanSearch.toLowerCase());
      const mt = typeFilter === 'All' || l.type === typeFilter;
      const mst = statusFilter === 'All' || l.status === statusFilter;
      return ms && mt && mst;
    }), [loans, loanSearch, typeFilter, statusFilter]);

  // ── Form Handlers ──
  const resetForm = () => {
    setFormData({
      date: new Date().toISOString().split('T')[0],
      type: 'Given',
      personName: '',
      contact: '',
      amount: '',
      description: ''
    });
    setEditingLoan(null);
    setIsFormOpen(false);
  };

  const openAddForm = () => {
    resetForm();
    setIsFormOpen(true);
  };

  const openEditForm = (loan: LoanRecord) => {
    setEditingLoan(loan);
    setFormData({
      date: loan.date,
      type: loan.type,
      personName: loan.personName,
      contact: loan.contact,
      amount: loan.amount.toString(),
      description: loan.description
    });
    setIsFormOpen(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(formData.amount);
    if (!formData.personName || isNaN(amount) || amount <= 0) {
      alert('নাম ও đúng পরিমাণ লিখুন / Enter name and valid amount.');
      return;
    }
    if (editingLoan) {
      onEditLoan?.({ ...editingLoan, ...formData, amount });
    } else {
      onAddLoan({ ...formData, amount });
    }
    resetForm();
  };

  const handleRepay = (e: React.FormEvent) => {
    e.preventDefault();
    if (!repayLoan) return;
    const amt = parseFloat(repayAmount);
    const maxPayable = repayLoan.amount - repayLoan.repaidAmount;
    if (isNaN(amt) || amt <= 0) { alert('পরিমাণ লিখুন / Enter amount'); return; }
    if (amt > maxPayable + 0.01) { alert(`বকেয়া থেকে বেশি / Exceeds due: ${formatTaka(maxPayable)}`); return; }

    onRecordLoanPayment({
      loanId: repayLoan.id,
      date: repayDate,
      amount: amt,
      type: repayLoan.type !== 'Given' ? 'Repayment' : 'Recovery'
    });

    // Generate a Loan Repayment Receipt (same design as the fee invoices,
    // with the logo and the remaining balance clearly shown).
    const newRepaid = repayLoan.repaidAmount + amt;
    const remaining = repayLoan.amount - newRepaid;
    const receiptNo = `LOAN-${repayLoan.id.slice(-4).toUpperCase()}-${Date.now().toString().slice(-5)}`;
    generateLoanReceiptPDF({
      personName: repayLoan.personName,
      loanId: repayLoan.id,
      type: repayLoan.type,
      date: repayDate,
      amountPaid: amt,
      totalAmount: repayLoan.amount,
      repaidBefore: repayLoan.repaidAmount,
      remaining,
      note: repayNote,
      receiptNo,
    });

    alert(`পরিশোধ রেকর্ড হয়েছে / Repayment recorded for ${repayLoan.personName}`);
    setRepayLoan(null); setRepayAmount(''); setRepayNote('');
    setActiveTab('payments');
  };

  const handleDelete = (id: string) => {
    setGuardAction({ label: `Delete loan account`, onConfirm: () => onDeleteLoan(id) });
  };

  const getPaymentsForLoan = (loanId: string) => 
    loanPayments.filter(p => p.loanId === loanId).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const getPaymentSummary = (loan: LoanRecord) => {
    const payments = getPaymentsForLoan(loan.id);
    return payments.map((p, i) => ({
      ...p,
      installment: i + 1,
      runningBalance: loan.amount - loan.repaidAmount + (loan.type !== 'Given' ? 
        payments.slice(0, i+1).reduce((s, x) => s + x.amount, 0) : 
        -payments.slice(0, i+1).reduce((s, x) => s + x.amount, 0))
    }));
  };

  // ── Render ──
  return (
    <>
      <div className="space-y-6 animate-fade-in">
        
        {/* ═══ HEADER ═══ */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-xl font-serif font-bold text-[#2c332d] tracking-tight flex items-center gap-2">
              <PiggyBank className="h-5 w-5 text-[#4a5d4e]" />
              Loan Fund Manager (ঋণ তহবিল ব্যবস্থাপনা)
            </h2>
            <p className="text-xs text-stone-500 mt-1">
              Interest-free Qard Al-Hasan tracker · Record liabilities (Taken) & advances (Given) · Monitor repayments
            </p>
          </div>
          {!readOnly && (
            <button onClick={openAddForm} className="w-full sm:w-auto bg-[#4a5d4e] hover:bg-[#3d4d41] text-white text-xs font-bold px-4 py-2.5 rounded-lg flex items-center justify-center gap-1.5 border border-[#3d4d41] shadow-sm active:scale-95">
              <Plus className="h-4 w-4 text-[#d9c5b2]" /> New Loan Account (নতুন খাতা)
            </button>
          )}
        </div>

        {/* ═══ STAT CARDS ═══ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard 
            label="Total Loan Taken (মোট ঋণ গ্রহণ)" 
            value={formatTaka(stats.totalTaken)} 
            valueBn={formatTakaBn(stats.totalTaken)}
            icon={<PiggyBank className="h-5 w-5" />}
            color="bg-emerald-50 border-emerald-200 text-emerald-800"
            trend="positive"
          />
          <StatCard 
            label="Loan Repaid (ঋণ পরিশোধ)" 
            value={formatTaka(stats.repaidTaken)} 
            valueBn={formatTakaBn(stats.repaidTaken)}
            sub={formatTaka(stats.outstandingTaken)} 
            subLabel="Remaining (বাকী)"
            icon={<ArrowDownLeft className="h-5 w-5" />}
            color="bg-amber-50 border-amber-200 text-amber-800"
            total={formatTaka(stats.totalTaken)}
          />
          <StatCard 
            label="Loan Outstanding (ঋণ পরিশোধ বাকী)" 
            value={formatTaka(stats.outstandingTaken)} 
            valueBn={formatTakaBn(stats.outstandingTaken)}
            sub={formatTaka(stats.repaidTaken)} 
            subLabel="Repaid (পরিশোধিত)"
            icon={<ArrowUpRight className="h-5 w-5" />}
            color="bg-blue-50 border-blue-200 text-blue-800"
            total={formatTaka(stats.totalTaken)}
          />
          <StatCard 
            label="Zakat & Lillah Fund (যাকাত এবং লিল্লাহ ফান্ড)" 
            value={formatTaka(stats.zakatLillah)} 
            valueBn={formatTakaBn(stats.zakatLillah)}
            sub={formatTaka(stats.zakatBalance)} 
            subLabel="Zakat (যাকাত)"
            icon={<Coins className="h-5 w-5" />}
            color="bg-green-50 border-green-200 text-green-800"
            total={formatTaka(stats.lillahBalance)}
          />
        </div>

        {/* ═══ QUICK ACTION CARDS ═══ */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
          {!readOnly && (
            <QuickAction icon={<Plus className="h-4 w-4" />} label="New Loan" bn="নতুন খাতা" onClick={openAddForm} color="bg-[#4a5d4e] hover:bg-[#3d4d41]" />
          )}
          <QuickAction icon={<History className="h-4 w-4" />} label="Payments" bn="পরিশোধ ইতিহাস" onClick={() => setActiveTab('payments')} color="bg-blue-600 hover:bg-blue-700" />
          <QuickAction icon={<FileText className="h-4 w-4" />} label="Summary" bn="সারসংক্ষেপ" onClick={() => setActiveTab('summary')} color="bg-amber-600 hover:bg-amber-700" />
          <QuickAction icon={<Eye className="h-4 w-4" />} label="Overview" bn="ওভারভিউ" onClick={() => setActiveTab('overview')} color="bg-stone-600 hover:bg-stone-700" />
        </div>

        {/* ═══ TABS ═══ */}
        <div className="border-b border-stone-100 flex flex-wrap gap-1">
          {[
            { key: 'overview', label: 'Overview (ওভারভিউ)', icon: <TrendingUp className="h-3.5 w-3.5" /> },
            { key: 'directory', label: `Loan Ledger (ঋণ খাতা) ${stats.totalLoans ? `(${stats.totalLoans})` : ''}`, icon: <PiggyBank className="h-3.5 w-3.5" /> },
            { key: 'payments', label: `Installments (কিস্তি ইতিহাস) ${loanPayments.length ? `(${loanPayments.length})` : ''}`, icon: <History className="h-3.5 w-3.5" /> },
            { key: 'summary', label: 'Summary Report (সারসংক্ষেপ)', icon: <FileText className="h-3.5 w-3.5" /> },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key as any)}
              className={`px-3 py-1.5 text-xs font-bold transition-all border-b-2 flex items-center gap-1 cursor-pointer ${
                activeTab === t.key
                  ? 'border-[#4a5d4e] text-[#4a5d4e] font-extrabold bg-[#4a5d4e]/5'
                  : 'border-transparent text-stone-500 hover:text-[#2c332d] hover:bg-stone-50'
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* ═══ TAB: OVERVIEW ═══ */}
        {activeTab === 'overview' && (
          <OverviewTab stats={stats} loans={loans} onRepay={setRepayLoan} />
        )}

        {/* ═══ TAB: DIRECTORY ═══ */}
        {activeTab === 'directory' && (
          <DirectoryTab 
            loans={filteredLoans} 
            search={loanSearch} onSearch={setLoanSearch}
            typeFilter={typeFilter} onTypeFilter={setTypeFilter}
            statusFilter={statusFilter} onStatusFilter={setStatusFilter}
            onEdit={openEditForm}
            onView={setViewLoan}
            onRepay={setRepayLoan}
            onDelete={handleDelete}
            readOnly={readOnly}
          />
        )}

        {/* ═══ TAB: PAYMENTS ═══ */}
        {activeTab === 'payments' && (
          <PaymentsTab loans={loans} loanPayments={loanPayments} />
        )}

        {/* ═══ TAB: SUMMARY ═══ */}
        {activeTab === 'summary' && (
          <SummaryTab loans={loans} loanPayments={loanPayments} stats={stats} />
        )}

        {/* ═══ MODALS ═══ */}
        {isFormOpen && !readOnly && (
          <LoanFormModal 
            isOpen={isFormOpen} 
            onClose={resetForm} 
            onSubmit={handleFormSubmit}
            formData={formData} 
            setFormData={setFormData}
            editing={editingLoan}
          />
        )}

        {repayLoan && !readOnly && (
          <RepaymentModal
            loan={repayLoan}
            isOpen={true}
            onClose={() => setRepayLoan(null)}
            onSubmit={handleRepay}
            amount={repayAmount}
            setAmount={setRepayAmount}
            date={repayDate}
            setDate={setRepayDate}
            note={repayNote}
            setNote={setRepayNote}
          />
        )}

        {viewLoan && (
          <LoanDetailModal
            loan={viewLoan}
            payments={getPaymentsForLoan(viewLoan.id)}
            isOpen={true}
            onClose={() => setViewLoan(null)}
            onRepay={() => { setViewLoan(null); setRepayLoan(viewLoan); }}
            onEdit={() => { setViewLoan(null); openEditForm(viewLoan); }}
            onDelete={() => { setViewLoan(null); handleDelete(viewLoan.id); }}
            readOnly={readOnly}
          />
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
    </>
  );
}

/* ═══════════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════════ */

interface StatCardProps {
  label: string;
  value: string;
  valueBn: string;
  icon: React.ReactNode;
  color: string;
  trend?: 'positive' | 'negative';
  sub?: string;
  subLabel?: string;
  total?: string;
}
function StatCard({ label, value, valueBn, icon, color, trend, sub, subLabel, total }: StatCardProps) {
  return (
    <div className={`bg-white rounded-xl border p-3 shadow-sm flex flex-col ${color}`}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wide text-stone-500">{label}</span>
        <span className="text-stone-400">{icon}</span>
      </div>
      <div className="mt-1">
        <div className="text-xl font-black font-mono">{value}</div>
        <div className="text-xs font-medium mt-0.5 opacity-80">{valueBn}</div>
        {sub && (
          <div className="flex items-center justify-between mt-2 text-[10px] opacity-70 border-t border-current/20 pt-1">
            <span>{subLabel}: {sub}</span>
            {total && <span>Total: {total}</span>}
          </div>
        )}
      </div>
      {trend && (
        <div className="mt-2 text-[10px] font-medium flex items-center gap-1">
          {trend === 'positive' ? (
            <> <TrendingUp className="h-3 w-3 text-green-600" /> Surplus Positive </>
          ) : (
            <> <TrendingDown className="h-3 w-3 text-red-600" /> Negative </>
          )}
        </div>
      )}
    </div>
  );
}

function QuickAction({ icon, label, bn, onClick, color }: { 
  icon: React.ReactNode; label: string; bn: string; onClick: () => void; color: string 
}) {
  return (
    <button onClick={onClick} className={`${color} text-white text-xs font-bold py-2.5 rounded-lg flex flex-col items-center gap-0.5 transition-all active:scale-95 shadow-sm`}>
      {icon} <span>{label}</span> <span className="text-[9px] opacity-80">{bn}</span>
    </button>
  );
}

/* ═══ OVERVIEW TAB ═══ */
interface OverviewTabProps {
  stats: ReturnType<typeof useMemo>;
  loans: LoanRecord[];
  onRepay: (loan: LoanRecord) => void;
}
function OverviewTab({ stats, loans, onRepay }: OverviewTabProps) {
  const activeLoans = loans.filter(l => l.status === 'Active');
  const urgent = activeLoans.filter(l => (l.amount - l.repaidAmount) > 0).slice(0, 5);

  return (
    <div className="space-y-4">
      {/* Quick Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <InfoBox title="Active Accounts (চলতি খাতা)" value={stats.activeCount} icon={<CheckCircle className="h-5 w-5" />} color="bg-green-50 text-green-700 border-green-200" />
        <InfoBox title="Settled (পরিশোধিত)" value={stats.settledCount} icon={<XCircle className="h-5 w-5" />} color="bg-emerald-50 text-emerald-700 border-emerald-200" />
        <InfoBox title="Total Records (মোট রেকর্ড)" value={stats.totalLoans} icon={<FileText className="h-5 w-5" />} color="bg-blue-50 text-blue-700 border-blue-200" />
      </div>

      {/* Urgent / Upcoming */}
      {urgent.length > 0 && (
        <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-sm">
          <h4 className="text-xs font-bold text-stone-700 flex items-center gap-1 mb-3">
            <AlertCircle className="h-4 w-4 text-amber-600" /> Pending Repayments / Recovery (বকেয়া দাবি)
          </h4>
          <div className="space-y-2">
            {urgent.map(l => {
              const due = l.amount - l.repaidAmount;
              const isTaken = l.type === 'Taken';
              return (
                <div key={l.id} className="bg-stone-50/50 rounded-lg border border-stone-200 p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      isTaken ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {isTaken ? '↙' : '↗'}
                    </span>
                    <div>
                      <p className="font-bold text-sm text-[#2c332d]">{l.personName}</p>
                      <p className="text-[10px] text-stone-500">{l.description} · {formatDateShort(l.date)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-sm text-[#b27d6d]">{formatTaka(due)}</p>
                    <p className="text-[10px] text-stone-500">{isTaken ? 'Payable (পরিশোধ্য)' : 'Receivable (আদায়যোগ্য)'}</p>
                  </div>
                  <button onClick={() => onRepay(l)} className="bg-[#4a5d4e] hover:bg-[#3d4d41] text-white text-[10px] font-bold px-3 py-1.5 rounded border border-[#3d4d41] flex items-center gap-1">
                    <Calculator className="h-3 w-3" /> Repay
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Loans */}
      <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-sm">
        <h4 className="text-xs font-bold text-stone-700 mb-3 flex items-center gap-1">
          <History className="h-4 w-4" /> Recent Loan Accounts (সাম্প্রতিক খাতাসমূহ)
        </h4>
        <div className="space-y-2">
          {loans.slice(0, 5).map(l => (
            <div key={l.id} className="flex items-center justify-between p-2 bg-stone-50/50 rounded-lg border border-stone-100 hover:bg-stone-50 transition">
              <div className="flex items-center gap-2">
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  loanTypeMeta(l.type).color
                }`}>
                  {loanTypeMeta(l.type).label}
                </span>
                <div>
                  <p className="font-medium text-sm">{l.personName}</p>
                  <p className="text-[10px] text-stone-500">{formatTaka(l.amount)} · Due: {formatTaka(l.amount - l.repaidAmount)}</p>
                </div>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                l.status === 'Settled' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
              }`}>
                {l.status === 'Settled' ? 'পরিশোধিত' : 'চলতি'}
              </span>
            </div>
          ))}
          {loans.length === 0 && <p className="text-center text-stone-500 py-4 text-sm">No loan accounts yet. Click "New Loan" to start.</p>}
        </div>
      </div>
    </div>
  );
}

function InfoBox({ title, value, icon, color }: { title: string; value: number; icon: React.ReactNode; color: string }) {
  return (
    <div className={`bg-white rounded-xl border p-3 shadow-sm flex items-center gap-3 ${color}`}>
      <div className="w-10 h-10 rounded-lg bg-white/70 flex items-center justify-center">{icon}</div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wide opacity-80">{title}</p>
        <p className="text-2xl font-black font-mono">{value}</p>
      </div>
    </div>
  );
}

/* ═══ DIRECTORY TAB ═══ */
interface DirectoryTabProps {
  loans: LoanRecord[];
  search: string; onSearch: (v: string) => void;
  typeFilter: 'All' | 'Taken' | 'Given'; onTypeFilter: (v: 'All' | 'Taken' | 'Given') => void;
  statusFilter: 'All' | 'Active' | 'Settled'; onStatusFilter: (v: 'All' | 'Active' | 'Settled') => void;
  onEdit: (l: LoanRecord) => void;
  onView: (l: LoanRecord) => void;
  onRepay: (l: LoanRecord) => void;
  onDelete: (id: string) => void;
  readOnly?: boolean;
}
function DirectoryTab({ loans, search, onSearch, typeFilter, onTypeFilter, statusFilter, onStatusFilter, onEdit, onView, onRepay, onDelete, readOnly }: DirectoryTabProps) {
  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 bg-[#f5f2ed]/55 p-3 rounded-xl border border-stone-200">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
          <input type="text" placeholder="Search name, ID, description..." value={search} onChange={e => onSearch(e.target.value)}
            className="w-full bg-white text-xs border border-stone-200 rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:border-[#4a5d4e] focus:ring-1 focus:ring-[#4a5d4e]" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={typeFilter} onChange={e => onTypeFilter(e.target.value as any)} className="bg-white border border-stone-200 rounded px-2 py-1.5 text-xs">
            <option value="All">All Types (সকল ধরন)</option>
            <option value="Taken">Taken — গৃহীত ঋণ</option>
            <option value="Given">Given — প্রদত্ত ঋণ</option>
          </select>
          <select value={statusFilter} onChange={e => onStatusFilter(e.target.value as any)} className="bg-white border border-stone-200 rounded px-2 py-1.5 text-xs">
            <option value="All">All Status (সকল অবস্থা)</option>
            <option value="Active">Active — চলতি</option>
            <option value="Settled">Settled — পরিশোধিত</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#4a5d4e] text-stone-100 font-semibold uppercase">
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Type (ধরণ)</th>
                <th className="py-2.5 px-3">Person (ব্যক্তি)</th>
                <th className="py-2.5 px-3">Contact</th>
                <th className="py-2.5 px-3 text-right font-mono">Principal (মূলধন)</th>
                <th className="py-2.5 px-3 text-right font-mono">Paid/Recovered (পরিশোধ/আদায়)</th>
                <th className="py-2.5 px-3 text-right font-mono">Remaining (বকেয়া)</th>
                <th className="py-2.5 px-3 text-center">Status (অবস্থা)</th>
                <th className="py-2.5 px-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {loans.length === 0 ? (
                <tr><td colSpan={9} className="py-8 text-center text-stone-500 italic">No loan accounts found. (কোনো খাতা পাওয়া যায়নি)</td></tr>
              ) : (
                loans.map(l => {
                  const remaining = l.amount - l.repaidAmount;
                  const isTaken = l.type === 'Taken';
                  return (
                    <tr key={l.id} className="hover:bg-[#f5f2ed]/50 transition-all">
                      <td className="py-2.5 px-3 font-mono text-stone-500 whitespace-nowrap">{formatDateShort(l.date)}</td>
                      <td className="py-2.5 px-3 font-bold whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${loanTypeMeta(l.type).color}`}>
                          {l.type === 'Given' ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownLeft className="h-3 w-3" />}
                          {loanTypeMeta(l.type).label}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <p className="font-bold text-[#2c332d]">{l.personName}</p>
                        <p className="text-[10px] text-stone-400 truncate max-w-xs">{l.description}</p>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-stone-500">{l.contact || '—'}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-stone-700 text-sm">{formatTaka(l.amount)}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-green-600">{formatTaka(l.repaidAmount)}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-black text-[#b27d6d] text-sm">{formatTaka(remaining)}</td>
                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                          l.status === 'Settled' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200/50'
                        }`}>
                          {l.status === 'Settled' ? 'পরিশোধিত' : 'চলতি'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => onView(l)} title="View Details (বিস্তারিত দেখুন)" className="text-blue-600 hover:text-blue-800 p-1.5 hover:bg-blue-50 rounded transition">
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          {!readOnly && (
                            <button onClick={() => onEdit(l)} title="Edit (সম্পাদনা)" className="text-stone-500 hover:text-[#4a5d4e] p-1.5 hover:bg-stone-100 rounded transition">
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {!readOnly && l.status === 'Active' && (
                            <button onClick={() => onRepay(l)} title="Log Repayment (পরishোধ লগ করুন)" className="bg-[#4a5d4e] hover:bg-[#3d4d41] text-white text-[10px] font-bold px-2 py-1 rounded border border-[#3d4d41] flex items-center gap-0.5">
                              ৳ Repay
                            </button>
                          )}
                          {!readOnly && (
                            <button onClick={() => onDelete(l.id)} title="Delete (মুছুন)" className="text-red-500 hover:text-red-700 p-1.5 hover:bg-red-50 rounded transition">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="bg-[#f5f2ed]/40 px-4 py-2 border-t border-stone-100 text-stone-400 text-[10px] font-mono flex justify-between">
          <span>Showing {loans.length} accounts</span>
          <span>Admin Panel</span>
        </div>
      </div>
    </div>
  );
}

/* ═══ PAYMENTS TAB ═══ */
interface PaymentsTabProps {
  loans: LoanRecord[];
  loanPayments: LoanPayment[];
}
function PaymentsTab({ loans, loanPayments }: PaymentsTabProps) {
  const sortedPayments = [...loanPayments].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
      <div className="p-3 bg-[#f5f2ed]/50 border-b border-stone-200/60">
        <h3 className="text-xs font-serif font-bold text-[#2c332d] uppercase flex items-center gap-1">
          <History className="h-4 w-4" /> Repayment & Recovery Ledger (পরিশোধ ও আদায় খতিয়ান)
        </h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-[#4a5d4e] text-stone-100 font-semibold uppercase">
              <th className="py-2.5 px-3">Date (তারিখ)</th>
              <th className="py-2.5 px-3">Loan Ref (খাতা রেফ)</th>
              <th className="py-2.5 px-3">Borrower/Lender (ব্যক্তি)</th>
              <th className="py-2.5 px-3">Type (ধরণ)</th>
              <th className="py-2.5 px-3 font-mono text-right">Amount (পরিমাণ)</th>
              <th className="py-2.5 px-3">Running Balance (ব্যালেন্স)</th>
              <th className="py-2.5 px-3">Recorded By (রেকর্ডার)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {sortedPayments.length === 0 ? (
              <tr><td colSpan={7} className="py-8 text-center text-stone-500 italic">No installment transactions recorded yet. (কোনো কিস্তি লেনদেন নেই)</td></tr>
            ) : (
              sortedPayments.map((p, idx) => {
                const loan = loans.find(l => l.id === p.loanId);
                const paymentsForLoan = loanPayments.filter(x => x.loanId === p.loanId)
                  .sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                const installmentNo = paymentsForLoan.findIndex(x => x.id === p.id) + 1;
                const paidSoFar = paymentsForLoan.slice(0, installmentNo).reduce((s, x) => s + x.amount, 0);
                const runningBalance = loan ? loan.amount - paidSoFar : 0;
                
                return (
                  <tr key={p.id} className="hover:bg-[#f5f2ed]/50">
                    <td className="py-2.5 px-3 font-mono text-stone-500 whitespace-nowrap">{formatDateShort(p.date)}</td>
                    <td className="py-2.5 px-3 font-mono text-stone-400">{loan ? `${loan.id} (#${installmentNo})` : '—'}</td>
                    <td className="py-2.5 px-3">
                      <span className="font-medium text-[#2c332d]">{loan?.personName || 'Unknown'}</span>
                      <p className="text-[10px] text-stone-400">{loan?.description}</p>
                    </td>
                    <td className="py-2.5 px-3 font-bold">
                      {p.type === 'Repayment' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          Repayment (পরিশোধ)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          Recovery (আদায়)
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-black text-stone-800 text-sm">{formatTaka(p.amount)}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-medium text-stone-600">{formatTaka(runningBalance)}</td>
                    <td className="py-2.5 px-3 text-stone-500 font-semibold">{p.recordedBy}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ═══ SUMMARY TAB ═══ */
interface SummaryTabProps {
  loans: LoanRecord[];
  loanPayments: LoanPayment[];
  stats: ReturnType<typeof useMemo>;
}
function SummaryTab({ loans, loanPayments, stats }: SummaryTabProps) {
  const monthlyData = useMemo(() => {
    const map: Record<string, { given: number; taken: number; repay: number; recover: number }> = {};
    [...loans, ...loanPayments].forEach(item => {
      const month = item.date.slice(0, 7); // YYYY-MM
      if (!map[month]) map[month] = { given: 0, taken: 0, repay: 0, recover: 0 };
      if ('type' in item && item.type === 'Given') map[month].given += item.amount;
      if ('type' in item && item.type === 'Taken') map[month].taken += item.amount;
      if ('type' in item && item.type === 'Repayment') map[month].repay += item.amount;
      if ('type' in item && item.type === 'Recovery') map[month].recover += item.amount;
    });
    return Object.entries(map).sort(([a],[b]) => a.localeCompare(b)).slice(-12);
  }, [loans, loanPayments]);

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard title="Total Given (মোট প্রদত্ত)" value={formatTaka(stats.totalGiven)} valueBn={formatTakaBn(stats.totalGiven)} color="bg-blue-50 border-blue-200 text-blue-800" />
        <SummaryCard title="Total Recovered (মোট আদায়)" value={formatTaka(stats.recoveredGiven)} valueBn={formatTakaBn(stats.recoveredGiven)} color="bg-green-50 border-green-200 text-green-800" />
        <SummaryCard title="Total Taken (মোট গৃহীত)" value={formatTaka(stats.totalTaken)} valueBn={formatTakaBn(stats.totalTaken)} color="bg-amber-50 border-amber-200 text-amber-800" />
        <SummaryCard title="Total Repaid (মোট পরিশোধ)" value={formatTaka(stats.repaidTaken)} valueBn={formatTakaBn(stats.repaidTaken)} color="bg-emerald-50 border-emerald-200 text-emerald-800" />
      </div>

      {/* Monthly Trend */}
      <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-sm">
        <h4 className="text-xs font-bold text-stone-700 mb-3 flex items-center gap-1">
          <TrendingUp className="h-4 w-4" /> Monthly Trend (১২ মাসের প্রবণতা)
        </h4>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-stone-100 text-stone-600 font-semibold">
                <th className="py-2 px-2 text-left">Month</th>
                <th className="py-2 px-2 text-right">Given (প্রদত্ত)</th>
                <th className="py-2 px-2 text-right">Taken (গৃহীত)</th>
                <th className="py-2 px-2 text-right">Recovered (আদায়)</th>
                <th className="py-2 px-2 text-right">Repaid (পরিশোধ)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {monthlyData.map(([month, data]) => (
                <tr key={month} className="hover:bg-stone-50">
                  <td className="py-2 px-2 font-medium">{month}</td>
                  <td className="py-2 px-2 text-right text-blue-700 font-bold">{formatTaka(data.given)}</td>
                  <td className="py-2 px-2 text-right text-amber-700 font-bold">{formatTaka(data.taken)}</td>
                  <td className="py-2 px-2 text-right text-green-700 font-bold">{formatTaka(data.recover)}</td>
                  <td className="py-2 px-2 text-right text-emerald-700 font-bold">{formatTaka(data.repay)}</td>
                </tr>
              ))}
              {monthlyData.length === 0 && (
                <tr><td colSpan={5} className="py-6 text-center text-stone-500">No monthly data available</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detailed Loan Register */}
      <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-sm">
        <h4 className="text-xs font-bold text-stone-700 mb-3">Complete Loan Register (সম্পূর্ণ খাতা বই)</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-[#4a5d4e] text-stone-100 font-semibold uppercase">
                <th className="py-2 px-2">ID</th>
                <th className="py-2 px-2">Date</th>
                <th className="py-2 px-2">Type</th>
                <th className="py-2 px-2">Person</th>
                <th className="py-2 px-2 text-right font-mono">Principal</th>
                <th className="py-2 px-2 text-right font-mono">Paid/Recovered</th>
                <th className="py-2 px-2 text-right font-mono">Outstanding</th>
                <th className="py-2 px-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {loans.map(l => (
                <tr key={l.id} className="hover:bg-stone-50">
                  <td className="py-2 px-2 font-mono text-stone-400">{l.id}</td>
                  <td className="py-2 px-2 font-mono text-stone-500">{formatDateShort(l.date)}</td>
                  <td className="py-2 px-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      loanTypeMeta(l.type).color
                    }`}>{loanTypeMeta(l.type).label}</span>
                  </td>
                  <td className="py-2 px-2 font-medium">{l.personName}</td>
                  <td className="py-2 px-2 text-right font-mono font-bold">{formatTaka(l.amount)}</td>
                  <td className="py-2 px-2 text-right font-mono text-green-600">{formatTaka(l.repaidAmount)}</td>
                  <td className="py-2 px-2 text-right font-mono font-black text-[#b27d6d]">{formatTaka(l.amount - l.repaidAmount)}</td>
                  <td className="py-2 px-2 text-center">
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                      l.status === 'Settled' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                    }`}>{l.status === 'Settled' ? 'Settled' : 'Active'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ title, value, valueBn, color }: { title: string; value: string; valueBn: string; color: string }) {
  return (
    <div className={`bg-white rounded-xl border p-3 shadow-sm ${color}`}>
      <p className="text-[10px] font-bold uppercase tracking-wide opacity-80">{title}</p>
      <p className="text-xl font-black font-mono mt-1">{value}</p>
      <p className="text-xs font-medium mt-0.5 opacity-80">{valueBn}</p>
    </div>
  );
}

/* ═══ MODAL: LOAN FORM ═══ */
type LoanFormData = { date: string; type: 'Taken' | 'Given' | 'ZakatLillah'; personName: string; contact: string; amount: string; description: string };

interface LoanFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  formData: LoanFormData;
  setFormData: React.Dispatch<React.SetStateAction<LoanFormData>>;
  editing: LoanRecord | null;
}
function LoanFormModal({ isOpen, onClose, onSubmit, formData, setFormData, editing }: LoanFormModalProps) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-[#2c332d]/45 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-xl border border-stone-200 shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="bg-[#4a5d4e] text-stone-100 p-3 border-b border-[#3d4d41] flex justify-between items-center">
          <h3 className="font-serif font-bold text-sm flex items-center gap-1.5">
            <PiggyBank className="h-4.5 w-4.5 text-[#d9c5b2]" />
            {editing ? 'Edit Loan Account (খাতা সম্পাদনা)' : 'Open New Loan Account (নতুন খাতা খুলুন)'}
          </h3>
          <button onClick={onClose} className="text-stone-200 hover:text-white font-bold text-lg">✕</button>
        </div>

        <form onSubmit={onSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-stone-700 mb-1">Loan Direction * (ঋণের দিক)</label>
              <select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as any})}
                className="w-full bg-stone-50 border border-stone-200 rounded-lg text-xs px-3 py-2 focus:outline-none focus:border-[#4a5d4e] focus:ring-1 focus:ring-[#4a5d4e]">
                <option value="Given">Given — প্রদত্ত ঋণ (Outflow / মাদ্রাসা দিয়েছে)</option>
                <option value="Taken">Taken — গৃহীত ঋণ (Inflow / মাদ্রাসা নিয়েছে)</option>
                <option value="ZakatLillah">Zakat &amp; Lillah Fund — যাকাত ও লিল্লাহ ফান্ড</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-stone-700 mb-1">Date * (তারিখ)</label>
              <input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})}
                className="w-full bg-stone-50 border border-stone-200 rounded-lg text-xs px-3 py-2 focus:outline-none focus:border-[#4a5d4e]" />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-stone-700 mb-1">Person Name * (ব্যক্তির নাম)</label>
            <input type="text" placeholder="Borrower / Lender name" value={formData.personName} onChange={e => setFormData({...formData, personName: e.target.value})}
              className="w-full bg-stone-50 border border-stone-200 rounded-lg text-xs px-3 py-2 focus:outline-none focus:border-[#4a5d4e]" required />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-stone-700 mb-1">Contact Phone (ফোন নম্বর)</label>
            <input type="tel" placeholder="01XXXXXXXXX" value={formData.contact} onChange={e => setFormData({...formData, contact: e.target.value})}
              className="w-full bg-stone-50 border border-stone-200 rounded-lg text-xs px-3 py-2 focus:outline-none focus:border-[#4a5d4e] font-mono" />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-stone-700 mb-1">Principal Amount * (মূলধন পরিমাণ)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-stone-400 font-bold">৳</span>
              <input type="number" step="0.01" min="0.01" placeholder="0.00" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})}
                className="w-full bg-white text-sm font-bold border border-stone-300 rounded-lg pl-8 pr-3 py-2.5 focus:outline-none focus:border-[#4a5d4e] focus:ring-1 focus:ring-[#4a5d4e]/30" required />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-stone-700 mb-1">Description / Purpose (বিবরণ / উদ্দেশ্য)</label>
            <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} rows={2}
              className="w-full bg-stone-50 border border-stone-200 rounded-lg text-xs px-3 py-2 focus:outline-none focus:border-[#4a5d4e]" placeholder="e.g., Emergency fund, Staff advance, Committee loan..." />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-stone-100">
            <button type="button" onClick={onClose} className="bg-white hover:bg-stone-50 border border-stone-200 text-stone-700 text-xs px-4 py-2 rounded-lg font-medium">Cancel (বাতিল)</button>
            <button type="submit" className="bg-[#4a5d4e] hover:bg-[#3d4d41] text-white text-xs font-bold px-5 py-2 rounded-lg shadow-sm active:scale-95 border border-[#3d4d41]">
              {editing ? 'Update Account (আপডেট করুন)' : 'Create Account (খাতা খুলুন)'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ═══ MODAL: REPAYMENT ═══ */
interface RepaymentModalProps {
  loan: LoanRecord;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  amount: string; setAmount: (v: string) => void;
  date: string; setDate: (v: string) => void;
  note: string; setNote: (v: string) => void;
}
function RepaymentModal({ loan, isOpen, onClose, onSubmit, amount, setAmount, date, setDate, note, setNote }: RepaymentModalProps) {
  if (!isOpen) return null;
  const due = loan.amount - loan.repaidAmount;
  const isTaken = loan.type === 'Taken' || loan.type === 'ZakatLillah';
  
  return (
    <div className="fixed inset-0 bg-[#2c332d]/45 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-xl border border-stone-200 shadow-xl max-w-md w-full">
        <div className={`bg-gradient-to-r p-4 border-b border-stone-200 ${isTaken ? 'from-amber-500 to-amber-600' : 'from-blue-500 to-blue-600'} text-white rounded-t-xl`}>
          <h3 className="font-serif font-bold text-sm flex items-center gap-1.5">
            {isTaken ? <ArrowDownLeft className="h-4.5 w-4.5" /> : <ArrowUpRight className="h-4.5 w-4.5" />}
            Log Repayment / Recovery (পরিশোধ / আদায় লগ করুন)
          </h3>
        </div>

        <form onSubmit={onSubmit} className="p-5 space-y-4">
          <div className="bg-stone-50 rounded-lg p-3 border border-stone-200">
            <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wide">Account Info (খাতার তথ্য)</p>
            <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
              <div><span className="text-stone-500">Name:</span> <span className="font-bold ml-1">{loan.personName}</span></div>
              <div><span className="text-stone-500">Type:</span> <span className="font-bold ml-1">{loanTypeMeta(loan.type).label}</span></div>
              <div><span className="text-stone-500">Principal:</span> <span className="font-bold ml-1 font-mono">{formatTaka(loan.amount)}</span></div>
              <div><span className="text-stone-500">Already Paid:</span> <span className="font-bold ml-1 font-mono text-green-600">{formatTaka(loan.repaidAmount)}</span></div>
              <div className="col-span-2"><span className="text-stone-500">Outstanding Due:</span> <span className="font-black ml-1 font-mono text-[#b27d6d] text-lg">{formatTaka(due)}</span></div>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-stone-700 mb-1">Repayment Amount * (পরিশোধের পরিমাণ)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-stone-400 font-bold">৳</span>
              <input type="number" step="0.01" min="0.01" max={due} placeholder={due.toFixed(2)} value={amount} onChange={e => setAmount(e.target.value)}
                className="w-full bg-white text-sm font-bold border border-stone-300 rounded-lg pl-8 pr-3 py-2.5 focus:outline-none focus:border-[#4a5d4e] focus:ring-1 focus:ring-[#4a5d4e]/30" required />
            </div>
            <p className="text-[10px] text-stone-500 mt-1">Maximum payable: {formatTaka(due)} ({formatTakaBn(due)})</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-stone-700 mb-1">Date (তারিখ)</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full bg-stone-50 border border-stone-200 rounded-lg text-xs px-3 py-2 focus:outline-none focus:border-[#4a5d4e]" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-stone-700 mb-1">Note (টিকা)</label>
              <input type="text" placeholder="Installment #1, Partial, Full settlement..." value={note} onChange={e => setNote(e.target.value)}
                className="w-full bg-stone-50 border border-stone-200 rounded-lg text-xs px-3 py-2 focus:outline-none focus:border-[#4a5d4e]" />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-stone-100">
            <button type="button" onClick={onClose} className="bg-white hover:bg-stone-50 border border-stone-200 text-stone-700 text-xs px-4 py-2 rounded-lg font-medium">Cancel</button>
            <button type="submit" className={`bg-gradient-to-r text-white text-xs font-bold px-5 py-2 rounded-lg shadow-sm active:scale-95 ${
              isTaken ? 'from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700' : 'from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700'
            }`}>
              Record {isTaken ? 'Repayment (পরিশোধ)' : 'Recovery (আদায়)'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ═══ MODAL: LOAN DETAIL ═══ */
interface LoanDetailModalProps {
  loan: LoanRecord;
  payments: LoanPayment[];
  isOpen: boolean;
  onClose: () => void;
  onRepay: () => void;
  onEdit: () => void;
  onDelete: () => void;
  readOnly?: boolean;
}
function LoanDetailModal({ loan, payments, isOpen, onClose, onRepay, onEdit, onDelete, readOnly }: LoanDetailModalProps) {
  if (!isOpen) return null;
  const due = loan.amount - loan.repaidAmount;
  const isTaken = loan.type === 'Taken' || loan.type === 'ZakatLillah';
  const sortedPayments = [...payments].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <div className="fixed inset-0 bg-[#2c332d]/45 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-xl border border-stone-200 shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className={`bg-gradient-to-r p-4 border-b border-stone-200 ${isTaken ? 'from-amber-500 to-amber-600' : 'from-blue-500 to-blue-600'} text-white rounded-t-xl`}>
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-serif font-bold text-lg flex items-center gap-2">
                {isTaken ? <ArrowDownLeft className="h-5 w-5" /> : <ArrowUpRight className="h-5 w-5" />}
                {isTaken ? 'Taken Loan — গৃহীত ঋণ' : 'Given Loan — প্রদত্ত ঋণ'}
              </h3>
              <p className="text-xs opacity-90 mt-1">{loan.personName} · {loan.id}</p>
            </div>
            <button onClick={onClose} className="text-white/80 hover:text-white text-xl font-bold w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition">✕</button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-3">
            <DetailStat label="Principal (মূলধন)" value={formatTaka(loan.amount)} valueBn={formatTakaBn(loan.amount)} color="text-stone-700" />
            <DetailStat label={isTaken ? "Repaid (পরিশোধিত)" : "Recovered (আদায়)"} value={formatTaka(loan.repaidAmount)} valueBn={formatTakaBn(loan.repaidAmount)} color="text-green-700" />
            <DetailStat label="Outstanding (বকেয়া)" value={formatTaka(due)} valueBn={formatTakaBn(due)} color="text-[#b27d6d]" highlight />
          </div>

          {/* Meta Info */}
          <div className="bg-stone-50 rounded-lg border border-stone-200 p-3 space-y-2">
            <InfoRow label="Date (তারিখ)" value={formatDate(loan.date)} />
            <InfoRow label="Contact (ফোন)" value={loan.contact || 'Not provided'} />
            <InfoRow label="Description (বিবরণ)" value={loan.description} />
            <InfoRow label="Status (অবস্থা)" value={
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${loan.status === 'Settled' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                {loan.status === 'Settled' ? 'পরিশোধিত (Settled)' : 'চলতি (Active)'}
              </span>
            } />
            <InfoRow label="Recorded By (রেকর্ডার)" value={loan.recordedBy} />
          </div>

          {/* Payment History */}
          <div>
            <h4 className="text-xs font-bold text-stone-700 mb-2 flex items-center gap-1">
              <History className="h-4 w-4" /> Installment History (কিস্তির ইতিহাস) — {sortedPayments.length} entries
            </h4>
            {sortedPayments.length === 0 ? (
              <div className="bg-stone-50 border border-stone-200 rounded-lg p-4 text-center text-stone-500 text-sm">
                No payments recorded yet. (এখনো কোনো কিস্তি নেই)
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {sortedPayments.map((p, i) => (
                  <div key={p.id} className="bg-white border border-stone-200 rounded-lg p-3 hover:bg-stone-50 transition">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-sm text-[#2c332d]">Installment #{i + 1} (কিস্তি #{i + 1})</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${p.type === 'Repayment' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                        {p.type === 'Repayment' ? 'Repayment' : 'Recovery'}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-1 text-xs text-stone-600">
                      <div><span className="font-medium">Date:</span> {formatDate(p.date)}</div>
                      <div><span className="font-medium">Amount:</span> <span className="font-bold font-mono text-stone-800">{formatTaka(p.amount)}</span></div>
                      <div><span className="font-medium">By:</span> {p.recordedBy}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-3 border-t border-stone-100">
            {!readOnly && loan.status === 'Active' && (
              <button onClick={onRepay} className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg font-bold text-xs border shadow-sm ${
                isTaken ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-600' : 'bg-blue-500 hover:bg-blue-600 text-white border-blue-600'
              }`}>
                <Calculator className="h-4 w-4" /> Log {isTaken ? 'Repayment' : 'Recovery'} (৳)
              </button>
            )}
            {!readOnly && (
              <button onClick={onEdit} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg font-bold text-xs border bg-white hover:bg-stone-50 text-stone-700 border-stone-300">
                <Edit2 className="h-4 w-4" /> Edit (সম্পাদনা)
              </button>
            )}
            {!readOnly && (
              <button onClick={onDelete} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg font-bold text-xs border bg-white hover:bg-red-50 text-red-600 border-red-300">
                <Trash2 className="h-4 w-4" /> Delete (মুছুন)
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailStat({ label, value, valueBn, color, highlight }: { label: string; value: string; valueBn: string; color: string; highlight?: boolean }) {
  return (
    <div className={`bg-white rounded-lg border p-3 text-center ${highlight ? 'border-2 border-amber-300 bg-amber-50' : 'border-stone-200'}`}>
      <p className="text-[10px] font-bold uppercase tracking-wide text-stone-500">{label}</p>
      <p className={`text-xl font-black font-mono mt-1 ${color}`}>{value}</p>
      <p className="text-xs font-medium mt-0.5 text-stone-500">{valueBn}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 text-xs">
      <span className="w-28 font-medium text-stone-500 shrink-0">{label}:</span>
      <span className="text-stone-700 flex-1">{value}</span>
    </div>
  );
}