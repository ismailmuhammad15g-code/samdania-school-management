import React, { useState } from 'react';
import { LedgerTransaction, FundType } from '../types';
import { getCategoriesByType, getCategories, addCategory, deleteCategory, Category } from '../lib/categories';
import { generateFinanceReportPDF } from './PDFGenerator';
import PasswordConfirmModal from './PasswordConfirmModal';
import { parseNumberWithBengaliSupport } from '../lib/digitUtils';
import { 
  Plus, 
  Search, 
  Filter, 
  Trash2, 
  FileDown, 
  Coins, 
  AlertCircle, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  X,
  BookPlus,
  Edit3
} from 'lucide-react';

interface FinanceModuleProps {
  ledger: LedgerTransaction[];
  onAddTransaction: (tx: Omit<LedgerTransaction, 'id' | 'recordedBy'>) => void;
  onDeleteTransaction: (id: string) => void;
  isFormOpen: boolean;
  setIsFormOpen: (open: boolean) => void;
  readOnly?: boolean;
}

export default function FinanceModule({
  ledger,
  onAddTransaction,
  onDeleteTransaction,
  isFormOpen,
  setIsFormOpen,
  readOnly
}: FinanceModuleProps) {
  
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'All' | 'Income' | 'Expense'>('All');
  const [fundFilter, setFundFilter] = useState<'All' | FundType>('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [guardAction, setGuardAction] = useState<{ label: string; onConfirm: () => void } | null>(null);

  const categories = getCategories();
  const incomeCategories = categories.filter(c => c.type === 'Income');
  const expenseCategories = categories.filter(c => c.type === 'Expense');

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    type: 'Income' as 'Income' | 'Expense',
    fund: 'General' as FundType,
    category: '',
    amount: '',
    description: '',
  });

  // Category management modal
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [catType, setCatType] = useState<'Income' | 'Expense'>('Income');
  const [catNameEn, setCatNameEn] = useState('');
  const [catNameBn, setCatNameBn] = useState('');
  const [catError, setCatError] = useState('');
  const [manageCategories, setManageCategories] = useState(false);

  // Calculate Balances
  const calculateFundBalance = (fund: FundType) => {
    return ledger
      .filter((t) => t.fund === fund)
      .reduce((sum, t) => {
        return sum + (t.type === 'Income' ? t.amount : -t.amount);
      }, 0);
  };

  const fundBalances = {
    General: calculateFundBalance('General'),
    Zakat: calculateFundBalance('Zakat'),
    Lillah: calculateFundBalance('Lillah'),
    Loan: calculateFundBalance('Loan'),
  };

  const totalBalance = fundBalances.General + fundBalances.Zakat + fundBalances.Lillah + fundBalances.Loan;

  // Expense calculations
  const todayStr = new Date().toISOString().split('T')[0];
  const totalExpenseAll = ledger
    .filter((t) => t.type === 'Expense')
    .reduce((sum, t) => sum + t.amount, 0);
  const todayExpense = ledger
    .filter((t) => t.type === 'Expense' && t.date === todayStr)
    .reduce((sum, t) => sum + t.amount, 0);
  const totalIncomeAll = ledger
    .filter((t) => t.type === 'Income')
    .reduce((sum, t) => sum + t.amount, 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseNumberWithBengaliSupport(formData.amount);
    if (!formData.amount || isNaN(amt) || amt <= 0) {
      alert('Please enter a valid amount.');
      return;
    }
    if (!formData.category) {
      alert('Please select a category.');
      return;
    }

    onAddTransaction({
      date: formData.date,
      type: formData.type,
      fund: formData.fund,
      category: formData.category,
      amount: amt,
      description: formData.description,
    });

    setFormData({
      date: new Date().toISOString().split('T')[0],
      type: 'Income',
      fund: 'General',
      category: '',
      amount: '',
      description: '',
    });
    setIsFormOpen(false);
  };

  const handleAddCategory = () => {
    setCatError('');
    if (!catNameEn.trim()) { setCatError('English name is required.'); return; }
    if (!catNameBn.trim()) { setCatError('Bengali name is required.'); return; }
    addCategory(catType, catNameEn.trim(), catNameBn.trim());
    setCatNameEn('');
    setCatNameBn('');
    setCatError('');
    setShowCategoryModal(false);
  };

  const currentCategories = formData.type === 'Income' ? incomeCategories : expenseCategories;

  const filteredTransactions = ledger.filter((t) => {
    const matchesSearch = t.category.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          t.recordedBy.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'All' || t.type === typeFilter;
    const matchesFund = fundFilter === 'All' || t.fund === fundFilter;
    const matchesCategory = categoryFilter === 'All' || t.category === categoryFilter;

    return matchesSearch && matchesType && matchesFund && matchesCategory;
  });

  const downloadPDFReport = () => {
    generateFinanceReportPDF(filteredTransactions, fundBalances);
  };

  return (
    <div className="space-y-6">
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-serif font-bold text-[#2c332d] tracking-tight flex items-center gap-2">
            <Coins className="h-5 w-5 text-[#4a5d4e]" />
            Institutional Income & Expense
          </h2>
          <p className="text-xs text-stone-500 mt-1">
            Manage allocations and trace general expense books, Zakat logs, and Lillah charity receipts.
          </p>
        </div>

        <div className="flex gap-2.5 w-full sm:w-auto">
          <button
            onClick={downloadPDFReport}
            className="flex-1 sm:flex-initial bg-white hover:bg-stone-50 text-stone-700 text-xs font-bold px-4 py-2.5 rounded-lg border border-stone-200 transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
          >
            <FileDown className="h-4 w-4 text-[#4a5d4e]" />
            Export Finance PDF
          </button>
          
          {!readOnly && (
            <button
              onClick={() => setIsFormOpen(true)}
              className="flex-1 sm:flex-initial bg-[#4a5d4e] hover:bg-[#3d4d41] text-white text-xs font-bold px-4 py-2.5 rounded-lg transition-all flex items-center justify-center gap-1.5 shadow active:scale-95 cursor-pointer border border-[#3d4d41]"
            >
              <Plus className="h-4 w-4 text-[#d9c5b2]" />
              Add Transaction
            </button>
          )}
        </div>
      </div>

      {/* Fund breakdown boards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4" id="funds-breakdown">
        <div className="bg-[#4a5d4e] text-white p-5 rounded-xl border border-[#3d4d41] shadow-sm relative">
          <p className="text-xs text-stone-200 font-bold uppercase tracking-wider">Total Treasury Balance</p>
          <h3 className="text-2xl font-bold mt-2 font-sans">৳ {totalBalance.toFixed(2)}</h3>
          <span className="text-[9px] text-stone-200 bg-black/15 px-2 py-0.5 rounded-full border border-white/10 font-mono absolute right-4 top-4 uppercase">
            Pooled Treasury
          </span>
        </div>
        <div className="bg-[#f5f2ed] p-5 rounded-xl border border-stone-200 shadow-sm">
          <div className="flex justify-between items-start">
            <span className="text-xs text-[#4a5d4e] font-bold">General Fund (সাধারণ)</span>
            <span className="bg-[#4a5d4e]/10 text-[#4a5d4e] text-[9px] font-bold px-1.5 py-0.5 rounded border border-[#4a5d4e]/20">Ops</span>
          </div>
          <h3 className={`text-xl font-bold mt-2 font-sans ${fundBalances.General < 0 ? 'text-red-600' : 'text-[#2c332d]'}`}>
            ৳ {fundBalances.General.toFixed(2)}
          </h3>
          <p className="text-[10px] text-stone-500 mt-1">Teacher salaries, administrative & building bills.</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-sm">
          <div className="flex justify-between items-start">
            <span className="text-xs text-[#b88c5d] font-bold">Zakat Fund (যাকাত)</span>
            <span className="bg-amber-100 text-[#b88c5d] text-[9px] font-bold px-1.5 py-0.5 rounded">Charity</span>
          </div>
          <h3 className="text-xl font-bold text-[#2c332d] mt-2 font-sans">৳ {fundBalances.Zakat.toFixed(2)}</h3>
          <p className="text-[10px] text-stone-500 mt-1">Exclusively poor-student tuition or boarding grants.</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-sm">
          <div className="flex justify-between items-start">
            <span className="text-xs text-[#5e8c6a] font-bold">Lillah Fund (লিল্লাহ)</span>
            <span className="bg-[#5e8c6a]/10 text-[#5e8c6a] text-[9px] font-bold px-1.5 py-0.5 rounded border border-[#5e8c6a]/20">Mess/Food</span>
          </div>
          <h3 className="text-xl font-bold text-[#2c332d] mt-2 font-sans">৳ {fundBalances.Lillah.toFixed(2)}</h3>
          <p className="text-[10px] text-stone-500 mt-1">Sponsoring daily kitchen bazar & religious text prints.</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-sm">
          <div className="flex justify-between items-start">
            <span className="text-xs text-amber-700 font-bold">Loan Fund (ঋণ)</span>
            <span className="bg-amber-50 text-amber-700 text-[9px] font-bold px-1.5 py-0.5 rounded border border-amber-200/50">Debts</span>
          </div>
          <h3 className="text-xl font-bold text-[#2c332d] mt-2 font-sans">৳ {fundBalances.Loan.toFixed(2)}</h3>
          <p className="text-[10px] text-stone-500 mt-1">Interest-free lending & liability accounts book.</p>
        </div>
      </div>

      {/* Expense & Income Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#b27d6d] text-white p-5 rounded-xl border border-[#a36b5c] shadow-sm">
          <p className="text-xs text-stone-200 font-bold uppercase tracking-wider">Total Expense (All Time)</p>
          <h3 className="text-2xl font-bold mt-2 font-sans">৳ {totalExpenseAll.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
          <span className="text-[9px] text-stone-200 bg-black/15 px-2 py-0.5 rounded-full border border-white/10 font-mono absolute right-4 top-4 uppercase">
            Outflow
          </span>
        </div>
        <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-sm relative">
          <p className="text-xs text-[#b27d6d] font-bold uppercase tracking-wider">Today's Expense</p>
          <h3 className="text-2xl font-bold text-[#b27d6d] mt-2 font-sans">৳ {todayExpense.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
          <span className="text-[9px] text-stone-400 bg-stone-50 px-2 py-0.5 rounded-full border border-stone-200 font-mono absolute right-4 top-4">
            {todayStr}
          </span>
        </div>
        <div className="bg-[#4a5d4e] text-white p-5 rounded-xl border border-[#3d4d41] shadow-sm relative">
          <p className="text-xs text-stone-200 font-bold uppercase tracking-wider">Total Income (All Time)</p>
          <h3 className="text-2xl font-bold mt-2 font-sans">৳ {totalIncomeAll.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
          <span className="text-[9px] text-stone-200 bg-black/15 px-2 py-0.5 rounded-full border border-white/10 font-mono absolute right-4 top-4 uppercase">
            Inflow
          </span>
        </div>
        <div className="bg-[#f5f2ed] p-5 rounded-xl border border-stone-200 shadow-sm relative">
          <p className="text-xs text-[#4a5d4e] font-bold uppercase tracking-wider">Net Balance</p>
          <h3 className={`text-2xl font-bold mt-2 font-sans ${(totalIncomeAll - totalExpenseAll) < 0 ? 'text-red-600' : 'text-[#2c332d]'}`}>
            ৳ {(totalIncomeAll - totalExpenseAll).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </h3>
          <span className="text-[9px] text-stone-400 bg-white px-2 py-0.5 rounded-full border border-stone-200 font-mono absolute right-4 top-4">
            Income − Expense
          </span>
        </div>
      </div>

      {/* Add Transaction Modal */}
      {isFormOpen && !readOnly && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setIsFormOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            
            <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200">
              <h3 className="text-base font-bold text-[#2c332d] flex items-center gap-2">
                <Plus className="h-5 w-5 text-[#4a5d4e]" />
                Add New Ledger Transaction <span className="font-bangla text-stone-500 font-normal">(নতুন লেনদেন)</span>
              </h3>
              <button onClick={() => setIsFormOpen(false)} className="p-1 hover:bg-stone-100 rounded-lg cursor-pointer transition-all">
                <X className="h-5 w-5 text-stone-400" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-600 mb-1">Date *</label>
                  <input type="date" required value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full bg-stone-50 border border-stone-200 rounded-lg text-sm px-3 py-2.5 focus:outline-none focus:border-[#4a5d4e] focus:ring-1 focus:ring-[#4a5d4e]" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-600 mb-1">Transaction Type *</label>
                  <select value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as 'Income' | 'Expense', category: '' })}
                    className="w-full bg-stone-50 border border-stone-200 rounded-lg text-sm px-3 py-2.5 focus:outline-none focus:border-[#4a5d4e] focus:ring-1 focus:ring-[#4a5d4e]">
                    <option value="Income">Income (জমা)</option>
                    <option value="Expense">Expense (খরচ)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-600 mb-1">Fund Allocation *</label>
                <select value={formData.fund}
                  onChange={(e) => setFormData({ ...formData, fund: e.target.value as FundType })}
                  className="w-full bg-stone-50 border border-stone-200 rounded-lg text-sm px-3 py-2.5 focus:outline-none focus:border-[#4a5d4e] focus:ring-1 focus:ring-[#4a5d4e]">
                  <option value="General">General Fund (সাধারণ তহবিল)</option>
                  <option value="Zakat">Zakat Fund (যাকাত তহবিল)</option>
                  <option value="Lillah">Lillah Fund (লিল্লাহ তহবিল)</option>
                  <option value="Loan">Loan Fund (ঋণ তহবিল)</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-stone-600">Category *</label>
                  <button type="button" onClick={() => { setCatType(formData.type); setManageCategories(false); setShowCategoryModal(true); }}
                    className="text-[11px] text-[#4a5d4e] hover:text-[#3d4d41] font-bold flex items-center gap-1 cursor-pointer">
                    <BookPlus className="h-3.5 w-3.5" />
                    Add Category
                  </button>
                </div>
                <select value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full bg-stone-50 border border-stone-200 rounded-lg text-sm px-3 py-2.5 focus:outline-none focus:border-[#4a5d4e] focus:ring-1 focus:ring-[#4a5d4e]">
                  <option value="">-- Select Category --</option>
                  {currentCategories.map((c) => (
                    <option key={c.id} value={c.nameEn}>{c.nameEn} <span className="font-bangla">({c.nameBn})</span></option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-600 mb-1">Amount (৳) *</label>
                  <input type="text" inputMode="decimal" required placeholder="Enter amount"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="w-full bg-stone-50 border border-stone-200 rounded-lg text-sm px-3 py-2.5 focus:outline-none focus:border-[#4a5d4e] focus:ring-1 focus:ring-[#4a5d4e] font-mono" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-600 mb-1">Description</label>
                  <input type="text" placeholder="Note or reference name"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full bg-stone-50 border border-stone-200 rounded-lg text-sm px-3 py-2.5 focus:outline-none focus:border-[#4a5d4e] focus:ring-1 focus:ring-[#4a5d4e]" />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-stone-200">
                <button type="button" onClick={() => setIsFormOpen(false)}
                  className="bg-white hover:bg-stone-50 border border-stone-200 text-stone-700 text-sm font-medium px-5 py-2 rounded-lg transition-all cursor-pointer">
                  Cancel
                </button>
                <button type="submit"
                  className="bg-[#4a5d4e] hover:bg-[#3d4d41] text-white text-sm font-bold px-6 py-2 rounded-lg shadow transition-all cursor-pointer border border-[#3d4d41]">
                  Record Transaction
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Category Modal */}
      {showCategoryModal && !readOnly && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowCategoryModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            
            <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200">
              <h3 className="text-base font-bold text-[#2c332d] flex items-center gap-2">
                <BookPlus className="h-5 w-5 text-[#4a5d4e]" />
                Add New Category <span className="font-bangla text-stone-500 font-normal">(নতুন ক্যাটাগরি)</span>
              </h3>
              <button onClick={() => setShowCategoryModal(false)} className="p-1 hover:bg-stone-100 rounded-lg cursor-pointer transition-all">
                <X className="h-5 w-5 text-stone-400" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-600 mb-1">Category Type *</label>
                <select value={catType}
                  onChange={(e) => setCatType(e.target.value as 'Income' | 'Expense')}
                  className="w-full bg-stone-50 border border-stone-200 rounded-lg text-sm px-3 py-2.5 focus:outline-none focus:border-[#4a5d4e] focus:ring-1 focus:ring-[#4a5d4e]">
                  <option value="Income">Income (জমা)</option>
                  <option value="Expense">Expense (খরচ)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-600 mb-1">English Name *</label>
                <input type="text" placeholder="e.g. Library Fund" value={catNameEn}
                  onChange={(e) => setCatNameEn(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-200 rounded-lg text-sm px-3 py-2.5 focus:outline-none focus:border-[#4a5d4e] focus:ring-1 focus:ring-[#4a5d4e]" />
              </div>
              <div>
                <label className="block text-xs font-bold text-stone-600 mb-1">Bengali Name *</label>
                <input type="text" placeholder="যেমন: গ্রন্থাগার তহবিল" value={catNameBn}
                  onChange={(e) => setCatNameBn(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-200 rounded-lg text-sm px-3 py-2.5 focus:outline-none focus:border-[#4a5d4e] focus:ring-1 focus:ring-[#4a5d4e]" />
              </div>
              {catError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg p-3 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{catError}</span>
                </div>
              )}
              <div className="flex justify-end gap-3 pt-2 border-t border-stone-200">
                <button type="button" onClick={() => setShowCategoryModal(false)}
                  className="bg-white hover:bg-stone-50 border border-stone-200 text-stone-700 text-sm font-medium px-5 py-2 rounded-lg transition-all cursor-pointer">
                  Cancel
                </button>
                <button type="button" onClick={handleAddCategory}
                  className="bg-[#4a5d4e] hover:bg-[#3d4d41] text-white text-sm font-bold px-5 py-2 rounded-lg shadow transition-all cursor-pointer border border-[#3d4d41]">
                  Add Category
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Category filter + search */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
        
        <div className="p-4 bg-[#f5f2ed]/50 border-b border-stone-200/60 flex flex-col lg:flex-row items-center gap-4">
          
          <div className="relative w-full lg:w-1/3">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-stone-400" />
            <input type="text" placeholder="Search category, description, recorder..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white text-xs border border-stone-200 rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:border-[#4a5d4e] focus:ring-1 focus:ring-[#4a5d4e]" />
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full lg:w-2/3 lg:justify-end">
            <div className="flex items-center gap-1.5 text-xs">
              <Filter className="h-3.5 w-3.5 text-stone-400" />
              <span className="text-stone-500">Filters:</span>
            </div>

            <select value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="bg-white text-xs border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-[#4a5d4e]">
              <option value="All">All Types</option>
              <option value="Income">Income only (জমা)</option>
              <option value="Expense">Expense only (খরচ)</option>
            </select>

            <select value={fundFilter}
              onChange={(e) => setFundFilter(e.target.value as any)}
              className="bg-white text-xs border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-[#4a5d4e]">
              <option value="All">All Funds</option>
              <option value="General">General Fund</option>
              <option value="Zakat">Zakat Fund</option>
              <option value="Lillah">Lillah Fund</option>
              <option value="Loan">Loan Fund</option>
            </select>

            <select value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-white text-xs border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-[#4a5d4e]">
              <option value="All">All Categories</option>
              {incomeCategories.map((c) => (
                <option key={c.id} value={c.nameEn}>{c.nameEn} <span className="font-bangla">({c.nameBn})</span></option>
              ))}
              {expenseCategories.map((c) => (
                <option key={c.id} value={c.nameEn}>{c.nameEn} <span className="font-bangla">({c.nameBn})</span></option>
              ))}
            </select>

            {!readOnly && (
              <button onClick={() => { setManageCategories(true); setShowCategoryModal(true); }}
                className="text-[11px] text-[#4a5d4e] hover:bg-[#4a5d4e]/10 px-2 py-1 rounded font-bold flex items-center gap-1 cursor-pointer transition-all"
              >
                <Edit3 className="h-3 w-3" />
              Manage
            </button>
            )}
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#4a5d4e] text-stone-100 uppercase tracking-wider font-semibold">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Fund</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4">Recorded By</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-stone-500 italic">
                    No transactions matching the criteria found.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-[#f5f2ed]/55 transition-all">
                    <td className="py-3 px-4 whitespace-nowrap text-stone-500 font-mono">{tx.date}</td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {tx.type === 'Income' ? (
                        <span className="bg-[#4a5d4e]/10 text-[#4a5d4e] font-bold px-2 py-0.5 rounded border border-[#4a5d4e]/20 flex items-center gap-1 w-max">
                          <ArrowUpCircle className="h-3.5 w-3.5 text-[#4a5d4e]" />
                          INFLOW
                        </span>
                      ) : (
                        <span className="bg-[#b27d6d]/10 text-[#b27d6d] font-bold px-2 py-0.5 rounded border border-[#b27d6d]/20 flex items-center gap-1 w-max">
                          <ArrowDownCircle className="h-3.5 w-3.5 text-[#b27d6d]" />
                          OUTFLOW
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className={`font-bold px-2 py-0.5 rounded border text-[10px] uppercase ${
                        tx.fund === 'General'
                          ? 'bg-[#f5f2ed] text-[#2c332d] border-stone-200'
                          : tx.fund === 'Zakat'
                          ? 'bg-amber-50 text-[#b88c5d] border-amber-200'
                          : 'bg-emerald-50/50 text-[#5e8c6a] border-[#5e8c6a]/20'
                      }`}>
                        {tx.fund}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-bold text-[#2c332d]">{tx.category}</td>
                    <td className="py-3 px-4 whitespace-nowrap font-bold font-mono text-[#2c332d] text-sm">
                      ৳ {tx.amount.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-stone-500 max-w-xs truncate" title={tx.description}>
                      {tx.description || '-'}
                    </td>
                    <td className="py-3 px-4 text-stone-500 font-medium whitespace-nowrap">{tx.recordedBy}</td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      {!readOnly && (
                        <button onClick={() => setGuardAction({ label: `Delete ৳${tx.amount.toFixed(2)} transaction`, onConfirm: () => onDeleteTransaction(tx.id) })}
                          className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded-full transition-all cursor-pointer"
                          title="Delete Transaction"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        <div className="bg-[#f5f2ed]/40 p-3 px-4 border-t border-stone-200/60 text-stone-400 text-[10px] flex justify-between items-center font-mono">
          <span>Showing {filteredTransactions.length} of {ledger.length} total ledger records.</span>
          <span>Admin Panel</span>
        </div>

      </div>

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
