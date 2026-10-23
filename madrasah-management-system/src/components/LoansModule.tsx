import React, { useState } from 'react';
import { LoanRecord, LoanPayment, LedgerTransaction, UserRole } from '../types';
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
  History 
} from 'lucide-react';

interface LoansModuleProps {
  loans: LoanRecord[];
  loanPayments: LoanPayment[];
  ledger: LedgerTransaction[];
  onAddLoan: (loan: Omit<LoanRecord, 'id' | 'repaidAmount' | 'status' | 'recordedBy'>) => void;
  onRecordLoanPayment: (payment: Omit<LoanPayment, 'id' | 'recordedBy'>) => void;
  onDeleteLoan: (id: string) => void;
  userRole: UserRole;
}

export default function LoansModule({
  loans,
  loanPayments,
  ledger,
  onAddLoan,
  onRecordLoanPayment,
  onDeleteLoan,
  userRole
}: LoansModuleProps) {
  const [activeTab, setActiveTab] = useState<'directory' | 'payments'>('directory');
  
  // Search state
  const [loanSearch, setLoanSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'All' | 'Taken' | 'Given'>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Settled'>('All');

  // Form States
  const [isAddLoanOpen, setIsAddLoanOpen] = useState(false);
  const [newLoanData, setNewLoanData] = useState({
    date: new Date().toISOString().split('T')[0],
    type: 'Given' as 'Taken' | 'Given',
    personName: '',
    contact: '',
    amount: '',
    description: ''
  });

  // Repayment Form States
  const [selectedRepayLoan, setSelectedRepayLoan] = useState<LoanRecord | null>(null);
  const [repayAmount, setRepayAmount] = useState('');
  const [repayDate, setRepayDate] = useState(new Date().toISOString().split('T')[0]);

  const canWrite = userRole === 'Admin' || userRole === 'Accountant';

  // Math totals for dashboard
  const totalFundBalance = ledger
    .filter(tx => tx.fund === 'Loan')
    .reduce((sum, tx) => sum + (tx.type === 'Income' ? tx.amount : -tx.amount), 0);

  const totalLoansGiven = loans
    .filter(l => l.type === 'Given')
    .reduce((sum, l) => sum + l.amount, 0);

  const totalGivenRecovered = loans
    .filter(l => l.type === 'Given')
    .reduce((sum, l) => sum + l.repaidAmount, 0);

  const outstandingGiven = totalLoansGiven - totalGivenRecovered;

  const totalLoansTaken = loans
    .filter(l => l.type === 'Taken')
    .reduce((sum, l) => sum + l.amount, 0);

  const totalTakenRepaid = loans
    .filter(l => l.type === 'Taken')
    .reduce((sum, l) => sum + l.repaidAmount, 0);

  const outstandingTaken = totalLoansTaken - totalTakenRepaid;

  const handleAddLoanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const principal = parseFloat(newLoanData.amount);
    if (!newLoanData.personName || isNaN(principal) || principal <= 0) {
      alert('Please fill out name and a valid amount.');
      return;
    }

    onAddLoan({
      date: newLoanData.date,
      type: newLoanData.type,
      personName: newLoanData.personName,
      contact: newLoanData.contact,
      amount: principal,
      description: newLoanData.description || `${newLoanData.type} loan arrangement.`
    });

    // Reset Form
    setNewLoanData({
      date: new Date().toISOString().split('T')[0],
      type: 'Given',
      personName: '',
      contact: '',
      amount: '',
      description: ''
    });
    setIsAddLoanOpen(false);
  };

  const handleRepaySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRepayLoan) return;

    const amountNum = parseFloat(repayAmount);
    const maximumRepayable = selectedRepayLoan.amount - selectedRepayLoan.repaidAmount;

    if (isNaN(amountNum) || amountNum <= 0) {
      alert('Please enter a valid repayment amount.');
      return;
    }

    if (amountNum > maximumRepayable + 0.01) {
      alert(`Entered amount ৳ ${amountNum} exceeds the remaining dues of ৳ ${maximumRepayable}.`);
      return;
    }

    onRecordLoanPayment({
      loanId: selectedRepayLoan.id,
      date: repayDate,
      amount: amountNum,
      type: selectedRepayLoan.type === 'Taken' ? 'Repayment' : 'Recovery'
    });

    alert(`Repayment recorded successfully for ${selectedRepayLoan.personName}.`);
    
    // Reset and switch
    setSelectedRepayLoan(null);
    setRepayAmount('');
    setActiveTab('payments');
  };

  const filteredLoans = loans.filter(l => {
    const matchesSearch = l.personName.toLowerCase().includes(loanSearch.toLowerCase()) || 
                          l.description.toLowerCase().includes(loanSearch.toLowerCase());
    const matchesType = typeFilter === 'All' || l.type === typeFilter;
    const matchesStatus = statusFilter === 'All' || l.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  return (
    <div className="space-y-6">
      
      {/* Title banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-serif font-bold text-[#2c332d] tracking-tight flex items-center gap-2">
            <PiggyBank className="h-5 w-5 text-[#4a5d4e]" />
            Loan Fund ledger (ঋণ তহবিল ও খাতা)
          </h2>
          <p className="text-xs text-stone-500 mt-1">
            Oversee interest-free Qard Al-Hasan pools, log incoming liabilities from committee givers, and register temporary advances given to employees.
          </p>
        </div>

        {canWrite && (
          <button
            onClick={() => setIsAddLoanOpen(true)}
            className="w-full sm:w-auto bg-[#4a5d4e] hover:bg-[#3d4d41] text-white text-xs font-bold px-4 py-2.5 rounded-lg transition-all flex items-center justify-center gap-1.5 shadow active:scale-95 cursor-pointer border border-[#3d4d41]"
          >
            <Plus className="h-4 w-4 text-[#d9c5b2]" />
            Record New Loan
          </button>
        )}
      </div>

      {/* Loan Financial Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Loan Fund Balance */}
        <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-[10px] text-stone-400 font-extrabold uppercase">Loan Fund Pool (ঋণ তহবিল স্থিতি)</span>
            <div className="text-xl font-black font-mono mt-1 text-[#4a5d4e]">
              ৳ {totalFundBalance.toFixed(2)}
            </div>
          </div>
          <p className="text-[10px] text-stone-400 mt-2">Active cash reserves for lending.</p>
        </div>

        {/* Card 2: Loans Taken (Liabilities) */}
        <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-[10px] text-amber-600 font-extrabold uppercase">Outstanding taken (গৃহীত ঋণ)</span>
            <div className="text-xl font-black font-mono mt-1 text-amber-700">
              ৳ {outstandingTaken.toFixed(2)}
            </div>
          </div>
          <div className="flex justify-between items-center text-[10px] text-stone-400 mt-2 border-t border-stone-100 pt-1">
            <span>Paid: ৳ {totalTakenRepaid}</span>
            <span>Total: ৳ {totalLoansTaken}</span>
          </div>
        </div>

        {/* Card 3: Loans Given (Assets) */}
        <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-[10px] text-blue-600 font-extrabold uppercase">Outstanding Given (প্রদত্ত ঋণ)</span>
            <div className="text-xl font-black font-mono mt-1 text-blue-700">
              ৳ {outstandingGiven.toFixed(2)}
            </div>
          </div>
          <div className="flex justify-between items-center text-[10px] text-stone-400 mt-2 border-t border-stone-100 pt-1">
            <span>Recovered: ৳ {totalGivenRecovered}</span>
            <span>Total: ৳ {totalLoansGiven}</span>
          </div>
        </div>

        {/* Card 4: Net Loan Standing */}
        <div className="bg-[#f5f2ed] rounded-xl border border-stone-200 p-4 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-[10px] text-stone-500 font-extrabold uppercase">Net Loan Leverage</span>
            <div className={`text-xl font-black font-mono mt-1 ${outstandingGiven >= outstandingTaken ? 'text-green-700' : 'text-red-700'}`}>
              ৳ {(outstandingGiven - outstandingTaken).toFixed(2)}
            </div>
          </div>
          <p className="text-[10px] text-stone-400 mt-2 font-medium">Assets minus current liabilities.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-stone-100 flex flex-wrap gap-2">
        <button
          onClick={() => setActiveTab('directory')}
          className={`px-3 py-2 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'directory'
              ? 'border-[#4a5d4e] text-[#4a5d4e] font-extrabold'
              : 'border-transparent text-stone-500 hover:text-[#2c332d]'
          }`}
        >
          <PiggyBank className="h-4 w-4" />
          Active Loan Ledger ({loans.length})
        </button>
        
        <button
          onClick={() => setActiveTab('payments')}
          className={`px-3 py-2 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'payments'
              ? 'border-[#4a5d4e] text-[#4a5d4e] font-extrabold'
              : 'border-transparent text-stone-500 hover:text-[#2c332d]'
          }`}
        >
          <History className="h-4 w-4" />
          Transaction Installments History ({loanPayments.length})
        </button>
      </div>

      {/* TAB 1: ACTIVE LOAN LEDGER */}
      {activeTab === 'directory' && (
        <div className="space-y-4">
          
          {/* Filter Bar */}
          <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-4 bg-[#f5f2ed]/55 p-4 rounded-xl border border-stone-200">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-stone-400" />
              <input
                type="text"
                placeholder="Search by borrower name or description..."
                value={loanSearch}
                onChange={(e) => setLoanSearch(e.target.value)}
                className="w-full bg-white text-xs border border-stone-200 rounded-lg pl-9 pr-3 py-2 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <div className="flex items-center gap-1 text-xs">
                <span className="text-stone-500 font-bold">Type:</span>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value as any)}
                  className="bg-white border border-stone-200 rounded px-2 py-1"
                >
                  <option value="All">All Types</option>
                  <option value="Taken">Taken (ঋণ গ্রহণ)</option>
                  <option value="Given">Given (ঋণ প্রদান)</option>
                </select>
              </div>

              <div className="flex items-center gap-1 text-xs">
                <span className="text-stone-500 font-bold">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="bg-white border border-stone-200 rounded px-2 py-1"
                >
                  <option value="All">All Statuses</option>
                  <option value="Active">Active (চলতি)</option>
                  <option value="Settled">Settled (পরিশোধিত)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Loan Records Table */}
          <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden animate-fade-in">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#4a5d4e] text-stone-100 font-semibold uppercase">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Person Name</th>
                    <th className="py-3 px-4">Contact</th>
                    <th className="py-3 px-4 text-right font-mono">Principal</th>
                    <th className="py-3 px-4 text-right font-mono">Repaid/Recovered</th>
                    <th className="py-3 px-4 text-right font-mono">Remaining Dues</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filteredLoans.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-stone-500 italic">No loan accounts registered.</td>
                    </tr>
                  ) : (
                    filteredLoans.map((l) => {
                      const remaining = l.amount - l.repaidAmount;
                      return (
                        <tr key={l.id} className="hover:bg-[#f5f2ed]/50 transition-all">
                          <td className="py-3 px-4 font-mono text-stone-500 whitespace-nowrap">{l.date}</td>
                          <td className="py-3 px-4 font-bold whitespace-nowrap">
                            {l.type === 'Taken' ? (
                              <span className="text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 w-max">
                                <ArrowDownLeft className="h-3 w-3 text-amber-600" />
                                Taken (গৃহীত)
                              </span>
                            ) : (
                              <span className="text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 w-max">
                                <ArrowUpRight className="h-3 w-3 text-blue-600" />
                                Given (প্রদত্ত)
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-bold text-[#2c332d]">
                            <div>
                              <p className="font-bold">{l.personName}</p>
                              <p className="text-[10px] text-stone-400 mt-0.5">{l.description}</p>
                            </div>
                          </td>
                          <td className="py-3 px-4 font-mono text-stone-500">{l.contact || 'N/A'}</td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-stone-700 text-sm">৳ {l.amount.toFixed(2)}</td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-green-600">৳ {l.repaidAmount.toFixed(2)}</td>
                          <td className="py-3 px-4 text-right font-mono font-black text-[#b27d6d] text-sm">৳ {remaining.toFixed(2)}</td>
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                              l.status === 'Settled' 
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-200' 
                                : 'bg-red-50 text-red-600 border-red-200/50'
                            }`}>
                              {l.status === 'Settled' ? 'পরিশোধিত' : 'চলতি'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center justify-center gap-1.5">
                              {canWrite && l.status === 'Active' && (
                                <button
                                  onClick={() => setSelectedRepayLoan(l)}
                                  className="bg-[#4a5d4e] hover:bg-[#3d4d41] text-white text-[10px] font-bold px-2 py-1 rounded shadow-sm transition-all flex items-center gap-0.5 cursor-pointer border border-[#3d4d41]"
                                >
                                  ৳ Log Repay
                                </button>
                              )}
                              {userRole === 'Admin' && (
                                <button
                                  onClick={() => {
                                    if (confirm(`Delete loan ledger for ${l.personName}? This will not erase existing general ledger balances.`)) {
                                      onDeleteLoan(l.id);
                                    }
                                  }}
                                  className="text-red-500 hover:text-red-700 p-1.5 hover:bg-red-50 rounded-full transition-all"
                                  title="Delete loan"
                                >
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
          </div>
        </div>
      )}

      {/* TAB 2: TRANSACTION INSTALLMENTS HISTORY */}
      {activeTab === 'payments' && (
        <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden animate-fade-in">
          <div className="p-4 bg-[#f5f2ed]/50 border-b border-stone-200/60">
            <h3 className="text-xs font-serif font-bold text-[#2c332d] uppercase">Repayment & Recovery History Book</h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#4a5d4e] text-stone-100 font-semibold uppercase">
                  <th className="py-3 px-4">Installment Date</th>
                  <th className="py-3 px-4">Ledger ID</th>
                  <th className="py-3 px-4">Transaction Type</th>
                  <th className="py-3 px-4">Principal Reference</th>
                  <th className="py-3 px-4 font-mono text-right">Settled Amount</th>
                  <th className="py-3 px-4">Approved By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {loanPayments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-stone-500 italic">No loan installment transactions recorded yet.</td>
                  </tr>
                ) : (
                  loanPayments.map((p) => {
                    const principal = loans.find(l => l.id === p.loanId);
                    return (
                      <tr key={p.id} className="hover:bg-[#f5f2ed]/50">
                        <td className="py-3 px-4 font-mono text-stone-500 whitespace-nowrap">{p.date}</td>
                        <td className="py-3 px-4 font-mono text-stone-400">{p.id}</td>
                        <td className="py-3 px-4 font-bold">
                          {p.type === 'Repayment' ? (
                            <span className="text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap">
                              Taken Loan Repayment (পরিশোধ)
                            </span>
                          ) : (
                            <span className="text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap">
                              Given Loan Recovery (আদায়)
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-stone-700">
                          {principal ? (
                            <span className="font-medium text-[#2c332d]">
                              {principal.personName} <span className="text-[10px] text-stone-400 font-mono">({principal.id})</span>
                            </span>
                          ) : 'Unknown Reference'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-black text-stone-800 text-sm">৳ {p.amount.toFixed(2)}</td>
                        <td className="py-3 px-4 text-stone-500 font-semibold">{p.recordedBy}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: RECORD NEW LOAN ACCOUNT */}
      {isAddLoanOpen && (
        <div className="fixed inset-0 bg-[#2c332d]/45 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-xl border border-stone-200 shadow-xl max-w-md w-full overflow-hidden">
            <div className="bg-[#4a5d4e] text-stone-100 p-4 border-b border-[#3d4d41] flex justify-between items-center">
              <h3 className="font-serif font-bold text-sm flex items-center gap-1.5">
                <PiggyBank className="h-4.5 w-4.5 text-[#d9c5b2]" />
                Open New Loan Account
              </h3>
              <button
                onClick={() => setIsAddLoanOpen(false)}
                className="text-stone-200 hover:text-white font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddLoanSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">Loan Direction *</label>
                  <select
                    value={newLoanData.type}
                    onChange={(e) => setNewLoanData({ ...newLoanData, type: e.target.value as any })}
                    className="w-full bg-stone-50 border border-stone-200 rounded-lg text-xs px-3 py-2 focus:outline-none"
                  >
                    <option value="Given">Given Loan (ঋণ প্রদান - Outflow)</option>
                    <option value="Taken">Taken Loan (ঋণ গ্রহণ - Inflow)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">Date *</label>
                  <input
                    type="date"
                    required
                    value={newLoanData.date}
                    onChange={(e) => setNewLoanData({ ...newLoanData, date: e.target.value })}
                    className="w-full bg-stone-50 border border-stone-200 rounded-lg text-xs px-3 py-2 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-700 mb-1">Person / Organization Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Haji Kamal Uddin, Mawlana Masood"
                  value={newLoanData.personName}
                  onChange={(e) => setNewLoanData({ ...newLoanData, personName: e.target.value })}
                  className="w-full bg-stone-50 border border-stone-200 rounded-lg text-xs px-3 py-2 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">Principal Amount (৳) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="Principal Cash Amount"
                    value={newLoanData.amount}
                    onChange={(e) => setNewLoanData({ ...newLoanData, amount: e.target.value })}
                    className="w-full bg-stone-50 border border-stone-200 rounded-lg text-xs px-3 py-2 focus:outline-none font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">Contact Phone</label>
                  <input
                    type="text"
                    placeholder="017xxxxxxxx"
                    value={newLoanData.contact}
                    onChange={(e) => setNewLoanData({ ...newLoanData, contact: e.target.value })}
                    className="w-full bg-stone-50 border border-stone-200 rounded-lg text-xs px-3 py-2 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-700 mb-1">Details & Description</label>
                <textarea
                  placeholder="Borrowing construction funds, repayable in installments."
                  value={newLoanData.description}
                  onChange={(e) => setNewLoanData({ ...newLoanData, description: e.target.value })}
                  className="w-full bg-stone-50 border border-stone-200 rounded-lg text-xs p-3 focus:outline-none h-16 resize-none"
                />
              </div>

              <div className="bg-[#f5f2ed] p-3 rounded-lg border border-stone-200 text-[10px] text-stone-500">
                ⚠️ Confirming this loan will automatically create a balancing double entry in the central finance ledger as an Expense (for Given) or Income (for Taken) transaction.
              </div>

              <div className="flex justify-end gap-2.5 pt-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setIsAddLoanOpen(false)}
                  className="bg-white hover:bg-stone-50 border border-stone-200 text-stone-700 text-xs px-4 py-2 rounded-lg cursor-pointer font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-[#4a5d4e] hover:bg-[#3d4d41] text-white text-xs font-bold px-5 py-2 rounded-lg shadow-sm cursor-pointer border border-[#3d4d41]"
                >
                  Confirm Account Creation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: LOG REPAYMENT INSTALLMENT */}
      {selectedRepayLoan && (
        <div className="fixed inset-0 bg-[#2c332d]/45 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-xl border border-stone-200 shadow-xl max-w-sm w-full overflow-hidden">
            <div className="bg-[#4a5d4e] text-stone-100 p-4 border-b border-[#3d4d41] flex justify-between items-center">
              <h3 className="font-serif font-bold text-sm flex items-center gap-1.5">
                <CheckCircle className="h-4.5 w-4.5 text-[#d9c5b2]" />
                Log Repayment / Recovery
              </h3>
              <button
                onClick={() => setSelectedRepayLoan(null)}
                className="text-stone-200 hover:text-white font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRepaySubmit} className="p-6 space-y-4">
              <div>
                <span className="text-[10px] text-stone-400 font-extrabold uppercase block mb-1">Target Account</span>
                <p className="text-xs font-black text-[#2c332d]">{selectedRepayLoan.personName}</p>
                <p className="text-[10px] text-stone-500 mt-0.5">
                  Remaining Dues: <span className="font-bold text-[#b27d6d] font-mono">৳ {(selectedRepayLoan.amount - selectedRepayLoan.repaidAmount).toFixed(2)}</span>
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">Installment Date *</label>
                  <input
                    type="date"
                    required
                    value={repayDate}
                    onChange={(e) => setRepayDate(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-200 rounded-lg text-xs px-2.5 py-1.5 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">Amount Paid (৳) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="৳ 0.00"
                    value={repayAmount}
                    onChange={(e) => setRepayAmount(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-200 rounded-lg text-xs px-2.5 py-1.5 font-mono font-bold"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setSelectedRepayLoan(null)}
                  className="bg-white hover:bg-stone-50 border border-stone-200 text-stone-700 text-xs px-4 py-2 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-[#4a5d4e] hover:bg-[#3d4d41] text-white text-xs font-bold px-5 py-2 rounded-lg shadow-sm cursor-pointer border border-[#3d4d41]"
                >
                  Confirm Installment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
