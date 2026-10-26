import React, { useState, useEffect, useMemo } from 'react';
import { Student, FeePayment, LedgerTransaction, MONTHS } from '../types';
import { generateFeeReceiptPDF } from './PDFGenerator';
import PasswordConfirmModal from './PasswordConfirmModal';
import HifzFinanceModule from './HifzFinanceModule';
import { parseNumberWithBengaliSupport, normalizeForComparison, isClassMatch } from '../lib/digitUtils';
import { useLiveStudentSearch } from '../lib/useLiveStudentSearch';
import { 
  Users, 
  Search, 
  Filter, 
  Plus, 
  CreditCard, 
  History, 
  FileText, 
  Printer, 
  CheckCircle, 
  DollarSign, 
  Trash2,
  Edit2,
  Lock,
  UserCheck,
  PieChart,
  Loader2,
  RefreshCw
} from 'lucide-react';

const feeNum = (v: unknown): number => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const n = parseNumberWithBengaliSupport(v);
  return Number.isFinite(n) ? n : 0;
};

interface HifzModuleProps {
  students: Student[];
  payments: FeePayment[];
  academicClasses: string[];
  admins: string[];
  onAddStudent: (student: Omit<Student, 'id'>) => void;
  onEditStudent: (student: Student) => void;
  onDeleteStudent: (id: string) => void;
  onCollectPayment: (payment: Omit<FeePayment, 'id' | 'receiptNo' | 'invoiceNo' | 'recordedBy'>) => void;
  isCollectOpen: boolean;
  setIsCollectOpen: (open: boolean) => void;
  ledger: LedgerTransaction[];
  onAddTransaction: (tx: Omit<LedgerTransaction, 'id' | 'recordedBy'>) => void;
  onDeletePayment?: (id: string) => void;
  readOnly?: boolean;
}

export default function HifzModule({
  students,
  payments,
  academicClasses,
  admins,
  onAddStudent,
  onEditStudent,
  onDeleteStudent,
  onCollectPayment,
  isCollectOpen,
  setIsCollectOpen,
  ledger,
  onAddTransaction,
  onDeletePayment,
  readOnly,
}: HifzModuleProps) {
  
  // Tab states inside Fees module
  const [activeSubTab, setActiveSubTab] = useState<'directory' | 'collect' | 'history' | 'finance'>('directory');
  
  // Live search — fresh Supabase fetch on every query
  const {
    query: searchTerm,
    setQuery: setSearchTerm,
    classFilter,
    setClassFilter,
    results: filteredStudents,
    loading: searchLoading,
    renderKey: searchRenderKey,
    totalCount: searchTotalCount,
    refresh: refreshSearch,
  } = useLiveStudentSearch({
    storageKey: 'samdani_hifz_students',
    fallbackStudents: students,
  });

  // Password guard
  const [guardAction, setGuardAction] = useState<{ label: string; onConfirm: () => void } | null>(null);

  // Student Form State (Add/Edit)
  const [isStudentFormOpen, setIsStudentFormOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);

  // Received By selector dropdown state
  const [receivedByOpen, setReceivedByOpen] = useState(false);
  const [studentFormData, setStudentFormData] = useState({
    name: '',
    roll: '',
    class: 'Hifz',
    contact: '',
    fatherName: '',
    motherName: '',
    extraInfo: '',
    previousDue: '0',
    currentMonthFee: '0',
    examFee: '0',
    transport: '0',
    electricity: '0',
    water: '0',
    waiver: '0',
    advancePaid: '0',
  });

  // Payment Form State (Exact breakdown required!)
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [paymentFormData, setPaymentFormData] = useState<{
    date: string;
    month: string;
    previousDue: string | number;
    currentMonthFee: string | number;
    examFee: string | number;
    transport: string | number;
    electricity: string | number;
    water: string | number;
    waiver: string | number;
    advancePaid: string | number;
    receivedBy: string;
    amountPaid: string;
  }>({
    date: new Date().toISOString().split('T')[0],
    month: MONTHS[new Date().getMonth()],
    previousDue: '0',
    currentMonthFee: '0',
    examFee: '0',
    transport: '0',
    electricity: '0',
    water: '0',
    waiver: '0',
    advancePaid: '0',
    receivedBy: '', // Admin who physically received the cash (required)
    amountPaid: '', // The raw cash amount collected
  });

  const numVal = (v: string | number) => {
    const n = parseNumberWithBengaliSupport(v);
    return isNaN(n) ? 0 : n;
  };

  // Calculate dynamic payable for the form
  const calculatedPayable = (
    numVal(paymentFormData.previousDue) +
    numVal(paymentFormData.currentMonthFee) +
    numVal(paymentFormData.examFee) +
    numVal(paymentFormData.transport) +
    numVal(paymentFormData.electricity) +
    numVal(paymentFormData.water)
  ) - numVal(paymentFormData.waiver) - numVal(paymentFormData.advancePaid);

  // Sync payments tab opening
  useEffect(() => {
    if (isCollectOpen) {
      setActiveSubTab('collect');
    }
  }, [isCollectOpen]);

  // Open Collect fee form pre-populated for a specific student
  const handleInitiatePayment = (student: Student) => {
    setSelectedStudent(student);
    setPaymentFormData({
      date: new Date().toISOString().split('T')[0],
      month: MONTHS[new Date().getMonth()],
      previousDue: student.previousDue.toString(),
      currentMonthFee: student.currentMonthFee.toString(),
      examFee: student.examFee.toString(),
      transport: student.transport.toString(),
      electricity: student.electricity.toString(),
      water: student.water.toString(),
      waiver: student.waiver.toString(),
      advancePaid: student.advancePaid.toString(),
      receivedBy: '', // must be selected by user
      amountPaid: '', // default empty to fill
    });
    setActiveSubTab('collect');
    setIsCollectOpen(true);
  };

  // Open Add Student Form
  const handleOpenAddStudent = () => {
    setEditingStudent(null);
    setStudentFormData({
      name: '',
      roll: '',
      class: 'Hifz',
      contact: '',
      fatherName: '',
      motherName: '',
      extraInfo: '',
      previousDue: '0',
      currentMonthFee: '0',
      examFee: '0',
      transport: '0',
      electricity: '0',
      water: '0',
      waiver: '0',
      advancePaid: '0',
    });
    setIsStudentFormOpen(true);
  };

  // Open Edit Student Form
  const handleOpenEditStudent = (student: Student) => {
    setEditingStudent(student);
    setStudentFormData({
      name: student.name,
      roll: student.roll, // Already a string, preserve exactly as is
      class: 'Hifz',
      contact: student.contact,
      fatherName: student.fatherName || '',
      motherName: student.motherName || '',
      extraInfo: student.extraInfo || '',
      previousDue: student.previousDue.toString(),
      currentMonthFee: student.currentMonthFee.toString(),
      examFee: student.examFee.toString(),
      transport: student.transport.toString(),
      electricity: student.electricity.toString(),
      water: student.water.toString(),
      waiver: student.waiver.toString(),
      advancePaid: student.advancePaid.toString(),
    });
    setIsStudentFormOpen(true);
  };

  // Student Form Submit (Add/Edit)
  const handleStudentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentFormData.name || !String(studentFormData.roll ?? '').trim()) {
      alert('Please fill out student name and roll.');
      return;
    }

    // Preserve the roll exactly as typed (string, no conversion)
    const rollStr = String(studentFormData.roll ?? '').trim();

    // Validate unique roll number within the same class
    const duplicateRoll = students.find(
      s => isClassMatch(s.class, studentFormData.class) && normalizeForComparison(s.roll) === normalizeForComparison(rollStr) && s.id !== editingStudent?.id
    );
    if (duplicateRoll) {
      alert(`Roll number "${rollStr}" already exists in ${studentFormData.class} (assigned to "${duplicateRoll.name}"). Please use a unique roll number.`);
      return;
    }

    const payload = {
      name: studentFormData.name,
      roll: rollStr, // Store as string exactly as typed
      class: studentFormData.class,
      contact: studentFormData.contact,
      fatherName: studentFormData.fatherName,
      motherName: studentFormData.motherName,
      extraInfo: studentFormData.extraInfo,
      previousDue: parseNumberWithBengaliSupport(studentFormData.previousDue) || 0,
      currentMonthFee: parseNumberWithBengaliSupport(studentFormData.currentMonthFee) || 0,
      examFee: parseNumberWithBengaliSupport(studentFormData.examFee) || 0,
      transport: parseNumberWithBengaliSupport(studentFormData.transport) || 0,
      electricity: parseNumberWithBengaliSupport(studentFormData.electricity) || 0,
      water: parseNumberWithBengaliSupport(studentFormData.water) || 0,
      waiver: parseNumberWithBengaliSupport(studentFormData.waiver) || 0,
      advancePaid: parseNumberWithBengaliSupport(studentFormData.advancePaid) || 0,
    };

    if (editingStudent) {
      onEditStudent({ ...editingStudent, ...payload });
    } else {
      onAddStudent(payload);
    }

    setIsStudentFormOpen(false);
    setEditingStudent(null);
  };

  // Collect Payment Form Submit
  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) {
      alert('Please select a student first.');
      return;
    }
    const enteredCash = parseNumberWithBengaliSupport(paymentFormData.amountPaid);
    if (isNaN(enteredCash) || enteredCash < 0) {
      alert('Please enter a valid amount paid.');
      return;
    }

    if (!paymentFormData.receivedBy) {
      alert('Please select who received the payment (Received By) before confirming.');
      return;
    }

    onCollectPayment({
      studentId: selectedStudent.id,
      studentName: selectedStudent.name,
      class: selectedStudent.class,
      month: paymentFormData.month,
      date: paymentFormData.date,
      previousDue: numVal(paymentFormData.previousDue),
      currentMonthFee: numVal(paymentFormData.currentMonthFee),
      examFee: numVal(paymentFormData.examFee),
      transport: numVal(paymentFormData.transport),
      electricity: numVal(paymentFormData.electricity),
      water: numVal(paymentFormData.water),
      waiver: numVal(paymentFormData.waiver),
      advancePaid: numVal(paymentFormData.advancePaid),
      totalPayable: calculatedPayable,
      amountPaid: enteredCash,
      receivedBy: paymentFormData.receivedBy,
    });

    // Reset payment states
    setSelectedStudent(null);
    setPaymentFormData({
      date: new Date().toISOString().split('T')[0],
      month: MONTHS[new Date().getMonth()],
      previousDue: '0',
      currentMonthFee: '0',
      examFee: '0',
      transport: '0',
      electricity: '0',
      water: '0',
      waiver: '0',
      advancePaid: '0',
      receivedBy: '',
      amountPaid: '',
    });
    setIsCollectOpen(false);
    setActiveSubTab('history');
  };

  // Dynamic list of all available classes (from settings + students)
  const availableClasses = useMemo(() => {
    const list = [...academicClasses];
    students.forEach((s) => {
      const cls = (s.class || '').trim();
      if (cls && !list.some((c) => isClassMatch(c, cls))) {
        list.push(cls);
      }
    });
    return list;
  }, [academicClasses, students]);

  return (
    <>
    <div className="space-y-6">
      
      {/* Title banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-serif font-bold text-[#2c332d] tracking-tight flex items-center gap-2">
            <Users className="h-5 w-5 text-[#4a5d4e]" />
            Student Tuition & Fee Portals
          </h2>
          <p className="text-xs text-stone-500 mt-1">
            Log monthly academic collections, adjust specific charge heads (Waivers, Exams, Utilities), and export receipts.
          </p>
        </div>

          {!readOnly && (
            <button
              onClick={handleOpenAddStudent}
              className="w-full sm:w-auto bg-[#4a5d4e] hover:bg-[#3d4d41] text-white text-xs font-bold px-4 py-2.5 rounded-lg transition-all flex items-center justify-center gap-1.5 shadow active:scale-95 cursor-pointer border border-[#3d4d41]"
            >
              <Plus className="h-4 w-4 text-[#d9c5b2]" />
              Register Student
            </button>
          )}
      </div>

      {/* Nested Sub-Tabs Navigation */}
      <div className="border-b border-stone-100 flex flex-wrap gap-2">
        <button
          onClick={() => setActiveSubTab('directory')}
          className={`px-3 py-2 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
            activeSubTab === 'directory'
              ? 'border-[#4a5d4e] text-[#4a5d4e] font-extrabold'
              : 'border-transparent text-stone-500 hover:text-[#2c332d]'
          }`}
        >
          <Users className="h-4 w-4" />
          Student Directory ({students.length})
        </button>
        
        <button
          onClick={() => setActiveSubTab('collect')}
          className={`px-3 py-2 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
            activeSubTab === 'collect'
              ? 'border-[#4a5d4e] text-[#4a5d4e] font-extrabold'
              : 'border-transparent text-stone-500 hover:text-[#2c332d]'
          }`}
        >
          <CreditCard className="h-4 w-4" />
          Collect Fee Form
        </button>

        <button
          onClick={() => setActiveSubTab('history')}
          className={`px-3 py-2 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
            activeSubTab === 'history'
              ? 'border-[#4a5d4e] text-[#4a5d4e] font-extrabold'
              : 'border-transparent text-stone-500 hover:text-[#2c332d]'
          }`}
        >
          <History className="h-4 w-4" />
          Fee Receipts Archive ({payments.length})
        </button>

        <button
          onClick={() => setActiveSubTab('finance')}
          className={`px-3 py-2 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
            activeSubTab === 'finance'
              ? 'border-[#4a5d4e] text-[#4a5d4e] font-extrabold'
              : 'border-transparent text-stone-500 hover:text-[#2c332d]'
          }`}
        >
          <PieChart className="h-4 w-4" />
          Income &amp; Expense
        </button>
      </div>

      {/* VIEW PANEL 1: STUDENT DIRECTORY */}
      {activeSubTab === 'directory' && (
        <div className="space-y-4">
          
          {/* Filters & Search */}
          <div className="flex flex-col sm:flex-row items-center gap-4 bg-[#f5f2ed]/55 p-4 rounded-xl border border-stone-200">
            <div className="relative w-full sm:w-1/2">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-stone-400" />
              <input
                type="search"
                autoComplete="off"
                spellCheck={false}
                placeholder="Search by Name, Roll, ID, or Phone — live from cloud..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white text-xs border border-stone-200 rounded-lg pl-9 pr-9 py-2 focus:outline-none focus:border-[#4a5d4e] focus:ring-1 focus:ring-[#4a5d4e]"
              />
              {searchLoading ? (
                <Loader2 className="absolute right-3 top-2.5 h-4 w-4 text-[#4a5d4e] animate-spin" />
              ) : searchTerm ? (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-2 text-[10px] font-bold text-stone-400 hover:text-[#4a5d4e] cursor-pointer"
                >
                  Clear
                </button>
              ) : null}
            </div>

            <div className="w-full sm:w-1/2 flex items-center gap-2 justify-end">
              <span className="text-xs text-stone-500 font-medium">Class:</span>
              <select
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                className="bg-white text-xs border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-[#4a5d4e]"
              >
                <option value="All">All Classes</option>
                {availableClasses.map((cls) => <option key={cls} value={cls}>{cls}</option>)}
              </select>
              <button
                type="button"
                onClick={refreshSearch}
                title="Refresh from cloud"
                className="p-1.5 rounded-lg border border-stone-200 bg-white text-stone-500 hover:text-[#4a5d4e] hover:border-[#4a5d4e] cursor-pointer"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${searchLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Directory Grid/Table */}
          <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#4a5d4e] text-stone-100 uppercase font-semibold">
                    <th className="py-3 px-4">Student ID</th>
                    <th className="py-3 px-4">Name</th>
                    <th className="py-3 px-4">Class</th>
                    <th className="py-3 px-4 text-center">Roll</th>
                    <th className="py-3 px-4">Monthly Fee</th>
                    <th className="py-3 px-4">Previous Due</th>
                    <th className="py-3 px-4">Transport</th>
                    <th className="py-3 px-4">Total Payable</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody key={searchRenderKey} className="divide-y divide-stone-100">
                  {searchLoading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <tr key={`sk-${i}`} className="animate-pulse">
                        <td className="py-3 px-4"><div className="h-3 w-16 bg-stone-200 rounded" /></td>
                        <td className="py-3 px-4 space-y-1.5">
                          <div className="h-3 w-28 bg-stone-200 rounded" />
                          <div className="h-2.5 w-20 bg-stone-100 rounded" />
                        </td>
                        <td className="py-3 px-4"><div className="h-5 w-14 bg-stone-200 rounded" /></td>
                        <td className="py-3 px-4"><div className="h-3 w-8 bg-stone-200 rounded mx-auto" /></td>
                        <td className="py-3 px-4"><div className="h-3 w-14 bg-stone-200 rounded" /></td>
                        <td className="py-3 px-4"><div className="h-3 w-14 bg-stone-200 rounded" /></td>
                        <td className="py-3 px-4"><div className="h-3 w-12 bg-stone-200 rounded" /></td>
                        <td className="py-3 px-4"><div className="h-3 w-14 bg-stone-200 rounded" /></td>
                        <td className="py-3 px-4"><div className="h-6 w-20 bg-stone-200 rounded mx-auto" /></td>
                      </tr>
                    ))
                  ) : filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-stone-500 italic">
                        {searchTerm.trim() || classFilter !== 'All'
                          ? 'No students match your search. Try another ID, roll, or phone.'
                          : 'No students registered yet.'}
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((s, idx) => {
                      const totalPayable =
                        (feeNum(s.previousDue) + feeNum(s.currentMonthFee) + feeNum(s.examFee) + feeNum(s.transport) + feeNum(s.electricity) + feeNum(s.water)) -
                        feeNum(s.waiver) - feeNum(s.advancePaid);
                      return (
                        <tr key={`${s.id}__${idx}`} className="hover:bg-[#f5f2ed]/50 transition-all">
                          <td className="py-3 px-4 font-mono font-bold text-[#4a5d4e]">{s.id}</td>
                          <td className="py-3 px-4">
                            <div>
                              <p className="font-bold text-[#2c332d]">{s.name}</p>
                              <p className="text-[10px] text-stone-500 mt-0.5">Ph: {s.contact || 'No contact'}</p>
                            </div>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="bg-[#f5f2ed] text-[#2c332d] font-bold px-2 py-0.5 rounded border border-stone-200/50">
                              {s.class}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center font-bold font-mono">{s.roll}</td>
                          <td className="py-3 px-4 whitespace-nowrap font-mono font-bold text-stone-700">৳ {feeNum(s.currentMonthFee).toFixed(2)}</td>
                          <td className="py-3 px-4 whitespace-nowrap font-mono font-bold text-[#b27d6d]">৳ {feeNum(s.previousDue).toFixed(2)}</td>
                          <td className="py-3 px-4 whitespace-nowrap font-mono text-stone-500">৳ {feeNum(s.transport).toFixed(2)}</td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className={`font-mono font-bold text-sm ${totalPayable > 0 ? 'text-[#b27d6d]' : 'text-[#4a5d4e]'}`}>
                              ৳ {totalPayable.toFixed(2)}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center justify-center gap-2">
                              {!readOnly && (
                                <button
                                  onClick={() => setGuardAction({ label: `Collect fees for ${s.name}`, onConfirm: () => handleInitiatePayment(s) })}
                                  className="bg-[#4a5d4e] hover:bg-[#3d4d41] text-white text-[10px] font-bold px-2.5 py-1 rounded shadow-sm transition-all flex items-center gap-1 active:scale-95 cursor-pointer border border-[#3d4d41]"
                                  title="Collect Fee Payment"
                                >
                                  <CreditCard className="h-3 w-3 text-[#d9c5b2]" />
                                  Collect Fees
                                </button>
                              )}
                              {!readOnly && (
                                <button
                                  onClick={() => setGuardAction({ label: `Edit student ${s.name}`, onConfirm: () => handleOpenEditStudent(s) })}
                                  className="text-stone-500 hover:text-[#4a5d4e] p-1.5 hover:bg-stone-100 rounded-full transition-all"
                                  title="Edit student"
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                              {!readOnly && (
                                <button
                                  onClick={() => setGuardAction({ label: `Delete student ${s.name}`, onConfirm: () => onDeleteStudent(s.id) })}
                                  className="text-red-500 hover:text-red-700 p-1.5 hover:bg-red-50 rounded-full transition-all"
                                  title="Delete student"
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
            
            <div className="bg-[#f5f2ed]/40 p-3 px-4 border-t border-stone-100 text-stone-400 text-[10px] flex justify-between items-center font-mono">
              <span>
                {searchLoading
                  ? 'Fetching live results from cloud…'
                  : `Showing ${filteredStudents.length} of ${searchTotalCount} students.`}
              </span>
              <span className="flex items-center gap-1">
                {searchLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                Live · Supabase
              </span>
            </div>
          </div>
        </div>
      )}

      {/* VIEW PANEL 2: COLLECT FEE FORM WORKSPACE */}
      {activeSubTab === 'collect' && !readOnly && (
        <div className="max-w-3xl mx-auto bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="p-4 bg-[#4a5d4e] text-stone-100 border-b border-[#3d4d41] flex justify-between items-center">
            <h3 className="text-sm font-serif font-bold flex items-center gap-1.5">
              <CreditCard className="h-4.5 w-4.5 text-[#d9c5b2]" />
              Collect Fee Payment Form (আদায় রশিদ এন্ট্রি)
            </h3>
            {selectedStudent && (
              <span className="text-[10px] bg-[#3d4d41] border border-[#2c332d] rounded px-2 py-0.5">
                Paying: {selectedStudent.name} ({selectedStudent.id})
              </span>
            )}
          </div>

          {!selectedStudent ? (
            <div className="p-12 text-center text-stone-500 flex flex-col items-center justify-center gap-3">
              <Users className="h-8 w-8 text-[#4a5d4e] bg-[#4a5d4e]/10 p-2 rounded-full" />
              <p className="font-bold text-sm text-[#2c332d]">No Student Selected</p>
              <p className="text-xs text-stone-400 max-w-sm">
                Please select a student first from the <strong>Student Directory</strong> tab and click the <strong>"Collect Fees"</strong> button to fill this workspace.
              </p>
              <button
                onClick={() => setActiveSubTab('directory')}
                className="bg-[#4a5d4e] hover:bg-[#3d4d41] text-white text-xs px-4 py-2 rounded-lg mt-2 font-bold cursor-pointer border border-[#3d4d41]"
              >
                Browse Student Directory
              </button>
            </div>
          ) : (
            <form onSubmit={handlePaymentSubmit} className="p-6 space-y-6">
              
              {/* Meta selectors */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">Receipt Date *</label>
                  <input
                    type="date"
                    required
                    value={paymentFormData.date}
                    onChange={(e) => setPaymentFormData({ ...paymentFormData, date: e.target.value })}
                    className="w-full bg-stone-50 text-xs border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#4a5d4e] focus:ring-1 focus:ring-[#4a5d4e]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">Fee Month *</label>
                  <select
                    value={paymentFormData.month}
                    onChange={(e) => setPaymentFormData({ ...paymentFormData, month: e.target.value })}
                    className="w-full bg-stone-50 text-xs border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#4a5d4e]"
                  >
                    {MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#4a5d4e] mb-1">Class (Read-only)</label>
                  <input
                    type="text"
                    disabled
                    value={selectedStudent.class}
                    className="w-full bg-stone-100 text-xs border border-stone-200 rounded-lg px-3 py-2 select-none font-bold"
                  />
                </div>
              </div>

              {/* Exact user requested itemized fee breakdown fields */}
              <div>
                <h4 className="text-xs font-serif font-bold text-[#2c332d] uppercase border-b border-stone-100 pb-2 mb-4">
                  Fee breakdown Fields (ফি আদায়ের বিবরণী)
                </h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  {/* Previous Due */}
                  <div>
                    <label className="block text-[11px] font-bold text-stone-600 mb-1">Previous Due (পূর্ব বকেয়া)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={paymentFormData.previousDue}
                      onChange={(e) => setPaymentFormData({ ...paymentFormData, previousDue: e.target.value })}
                      className="w-full bg-white text-xs border border-stone-200 rounded px-2 py-1.5 focus:outline-none focus:border-[#4a5d4e] font-mono font-bold"
                    />
                  </div>

                  {/* Current Month Fee */}
                  <div>
                    <label className="block text-[11px] font-bold text-stone-600 mb-1">Current Month Fee (বর্তমান মাস)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={paymentFormData.currentMonthFee}
                      onChange={(e) => setPaymentFormData({ ...paymentFormData, currentMonthFee: e.target.value })}
                      className="w-full bg-white text-xs border border-stone-200 rounded px-2 py-1.5 focus:outline-none focus:border-[#4a5d4e] font-mono font-bold"
                    />
                  </div>

                  {/* Exam Fee */}
                  <div>
                    <label className="block text-[11px] font-bold text-stone-600 mb-1">Exam Fee (পরীক্ষার ফি)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={paymentFormData.examFee}
                      onChange={(e) => setPaymentFormData({ ...paymentFormData, examFee: e.target.value })}
                      className="w-full bg-white text-xs border border-stone-200 rounded px-2 py-1.5 focus:outline-none focus:border-[#4a5d4e] font-mono font-bold"
                    />
                  </div>

                  {/* Advance Paid */}
                  <div>
                    <label className="block text-[11px] font-bold text-stone-600 mb-1">Advance Paid (অগ্রিম)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={paymentFormData.advancePaid}
                      onChange={(e) => setPaymentFormData({ ...paymentFormData, advancePaid: e.target.value })}
                      className="w-full bg-white text-xs border border-stone-200 rounded px-2 py-1.5 focus:outline-none focus:border-[#4a5d4e] font-mono font-bold"
                    />
                  </div>

                  {/* Transport */}
                  <div>
                    <label className="block text-[11px] font-bold text-stone-600 mb-1">Transport/Car Rent (গাড়ি ভাড়া)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={paymentFormData.transport}
                      onChange={(e) => setPaymentFormData({ ...paymentFormData, transport: e.target.value })}
                      className="w-full bg-white text-xs border border-stone-200 rounded px-2 py-1.5 focus:outline-none focus:border-[#4a5d4e] font-mono font-bold"
                    />
                  </div>

                  {/* Electricity Bill */}
                  <div>
                    <label className="block text-[11px] font-bold text-stone-600 mb-1">Electricity Bill (কারেন্ট বিল)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={paymentFormData.electricity}
                      onChange={(e) => setPaymentFormData({ ...paymentFormData, electricity: e.target.value })}
                      className="w-full bg-white text-xs border border-stone-200 rounded px-2 py-1.5 focus:outline-none focus:border-[#4a5d4e] font-mono font-bold"
                    />
                  </div>

                  {/* Water Bill */}
                  <div>
                    <label className="block text-[11px] font-bold text-stone-600 mb-1">Water Bill (পানি বিল)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={paymentFormData.water}
                      onChange={(e) => setPaymentFormData({ ...paymentFormData, water: e.target.value })}
                      className="w-full bg-white text-xs border border-stone-200 rounded px-2 py-1.5 focus:outline-none focus:border-[#4a5d4e] font-mono font-bold"
                    />
                  </div>

                  {/* Waiver/Discount */}
                  <div>
                    <label className="block text-[11px] font-bold text-[#b88c5d] mb-1">Waiver/Discount (মওকুফ) *</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={paymentFormData.waiver}
                      onChange={(e) => setPaymentFormData({ ...paymentFormData, waiver: e.target.value })}
                      className="w-full bg-amber-50 text-xs border border-amber-200 text-[#b88c5d] rounded px-2 py-1.5 focus:outline-none focus:border-[#b88c5d] font-mono font-bold"
                    />
                  </div>

                  {/* Received By */}
                  <div className="relative">
                    <label className="block text-[11px] font-bold text-[#4a5d4e] mb-1">Received By () *</label>
                    <button
                      type="button"
                      onClick={() => setReceivedByOpen((v) => !v)}
                      className="w-full flex items-center justify-between bg-white text-xs border border-stone-200 rounded px-2 py-1.5 focus:outline-none focus:border-[#4a5d4e] font-mono font-bold"
                    >
                      <span className={paymentFormData.receivedBy ? 'text-[#2c332d]' : 'text-stone-400'}>
                        {paymentFormData.receivedBy || 'Select admin…'}
                      </span>
                      <span className="text-stone-400 text-[10px]">▾</span>
                    </button>
                    {receivedByOpen && (
                      <div className="absolute z-20 mt-1 w-full bg-white border border-stone-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {admins.length === 0 ? (
                          <p className="text-[11px] text-stone-500 p-3">No admins yet. Add one in Settings → Current Admins.</p>
                        ) : (
                          admins.map((a) => (
                            <button
                              key={a}
                              type="button"
                              onClick={() => { setPaymentFormData({ ...paymentFormData, receivedBy: a }); setReceivedByOpen(false); }}
                              className="w-full text-left px-3 py-2 text-xs hover:bg-[#f5f2ed] font-bold text-[#2c332d]"
                            >
                              {a}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Dynamic calculations area */}
              <div className="bg-[#f5f2ed] p-5 rounded-lg border border-stone-200/60 flex flex-col md:flex-row items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] text-[#4a5d4e] uppercase font-bold">Automatic Calculation</span>
                  <p className="text-xs text-stone-500 mt-1">
                    Total Payable = (Prev Due + Current Month + Exam + Transport + Elec + Water) - Waiver - Advance Paid.
                  </p>
                  <div className="text-xl font-black text-[#2c332d] mt-2 font-mono">
                    Total Payable: ৳ {calculatedPayable.toFixed(2)}
                  </div>
                </div>

                <div className="w-full md:w-1/3">
                  <label className="block text-xs font-bold text-[#2c332d] mb-1.5">Amount Paid (নগদ আদায়) *</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 text-xs text-stone-400 font-bold">৳</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      required
                      placeholder="0.00"
                      value={paymentFormData.amountPaid}
                      onChange={(e) => setPaymentFormData({ ...paymentFormData, amountPaid: e.target.value })}
                      className="w-full bg-white text-sm font-bold border border-stone-300 rounded-lg pl-8 pr-3.5 py-2.5 focus:outline-none focus:border-[#4a5d4e] focus:ring-1 focus:ring-[#4a5d4e]/30 font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedStudent(null);
                    setIsCollectOpen(false);
                    setActiveSubTab('directory');
                  }}
                  className="bg-white hover:bg-stone-50 border border-stone-200 text-stone-700 text-xs px-4 py-2 rounded-lg cursor-pointer font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!paymentFormData.receivedBy}
                  className="bg-[#4a5d4e] hover:bg-[#3d4d41] disabled:bg-[#6a7d6e] disabled:cursor-not-allowed text-white text-xs font-bold px-6 py-2.5 rounded-lg shadow-sm active:scale-95 cursor-pointer border border-[#3d4d41]"
                  title={!paymentFormData.receivedBy ? 'Select "Received By" first' : ''}
                >
                  Confirm Aday & Generate Receipt
                </button>
              </div>

            </form>
          )}
        </div>
      )}

      {/* VIEW PANEL 4: RECEIPT HISTORY ARCHIVE */}
      {activeSubTab === 'history' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-[#f5f2ed]/50 border-b border-stone-200/60">
              <h3 className="text-xs font-serif font-bold text-[#2c332d] uppercase">Aday Receipts Archive</h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#4a5d4e] text-stone-100 font-semibold uppercase">
                    <th className="py-3 px-4">Receipt No</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Student Name (ID)</th>
                    <th className="py-3 px-4">Class</th>
                    <th className="py-3 px-4">Billing Month</th>
                    <th className="py-3 px-4">Charged</th>
                    <th className="py-3 px-4">Collected (Paid)</th>
                    <th className="py-3 px-4">Received By</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {payments.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-stone-500 italic">No receipts generated yet.</td>
                    </tr>
                  ) : (
                    payments.map((p) => (
                      <tr key={p.id} className="hover:bg-[#f5f2ed]/50 transition-all">
                        <td className="py-3 px-4 font-mono font-bold text-[#4a5d4e]">{p.receiptNo}</td>
                        <td className="py-3 px-4 font-mono text-stone-500 whitespace-nowrap">{p.date}</td>
                        <td className="py-3 px-4 font-bold text-[#2c332d]">
                          {p.studentName} <span className="text-[10px] text-stone-400 font-mono">({p.studentId})</span>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="bg-[#f5f2ed] text-[#2c332d] px-1.5 py-0.5 rounded font-bold border border-stone-200/50">{p.class}</span>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap font-bold text-[#4a5d4e]">{p.month}</td>
                        <td className="py-3 px-4 font-mono font-bold text-stone-500">৳ {p.totalPayable.toFixed(2)}</td>
                        <td className="py-3 px-4 font-mono font-bold text-[#4a5d4e] text-sm">৳ {p.amountPaid.toFixed(2)}</td>
                        <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px] font-bold text-[#4a5d4e]">{p.receivedBy || '—'}</td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={async (e) => {
                                const btn = e.currentTarget as HTMLButtonElement;
                                btn.disabled = true;
                                try {
                                  const student = students.find((s) => s.id === p.studentId);
                                  await generateFeeReceiptPDF(p, { download: true, school: 'hifz', studentRoll: student?.roll, digitInputs: student?.digitInputs });
                                } finally {
                                  btn.disabled = false;
                                }
                              }}
                              className="bg-white hover:bg-[#f5f2ed] border border-stone-200 hover:border-[#4a5d4e] text-[#4a5d4e] text-[10px] font-bold px-2.5 py-1 rounded shadow-sm transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <FileText className="h-3 w-3 text-[#d9c5b2]" />
                              Download
                            </button>
                            <button
                              onClick={async (e) => {
                                const btn = e.currentTarget as HTMLButtonElement;
                                btn.disabled = true;
                                try {
                                  const student = students.find((s) => s.id === p.studentId);
                                  await generateFeeReceiptPDF(p, { download: false, print: true, school: 'hifz', studentRoll: student?.roll, digitInputs: student?.digitInputs });
                                } finally {
                                  btn.disabled = false;
                                }
                              }}
                              className="bg-[#4a5d4e] hover:bg-[#3b4a3b] border border-[#4a5d4e] text-white text-[10px] font-bold px-2.5 py-1 rounded shadow-sm transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <Printer className="h-3 w-3" />
                              Print
                            </button>
                            {onDeletePayment && !readOnly && (
                              <button
                                onClick={() => {
                                  if (window.confirm(`Delete receipt ${p.receiptNo} for ${p.studentName}? This will roll back the student's dues.`)) {
                                    onDeletePayment(p.id);
                                  }
                                }}
                                className="bg-red-50 hover:bg-red-100 text-red-600 text-[10px] font-bold px-2 py-1 rounded shadow-sm transition-all border border-red-200 flex items-center gap-1 cursor-pointer"
                                title="Delete Receipt"
                              >
                                <Trash2 className="h-3 w-3" />
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW PANEL 5: HIFZ INCOME & EXPENSE (independent finance) */}
      {activeSubTab === 'finance' && (
        <HifzFinanceModule ledger={ledger} onAddTransaction={onAddTransaction} readOnly={readOnly} />
      )}

      {/* MODAL / OVERLAY: ADD / EDIT STUDENT PROFILE */}
      {isStudentFormOpen && !readOnly && (
        <div className="fixed inset-0 bg-[#2c332d]/45 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl border border-stone-200 shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            
            <div className="bg-[#4a5d4e] text-stone-100 p-4 border-b border-[#3d4d41] flex justify-between items-center">
              <h3 className="font-serif font-bold text-sm flex items-center gap-1.5">
                <UserCheck className="h-4.5 w-4.5 text-[#d9c5b2]" />
                {editingStudent ? 'Edit Student Profile' : 'Register New Student'}
              </h3>
              <button
                onClick={() => setIsStudentFormOpen(false)}
                className="text-stone-200 hover:text-white font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleStudentSubmit} className="p-6 space-y-5">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">Full Student Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="Salman Al-Farsi"
                    value={studentFormData.name}
                    onChange={(e) => setStudentFormData({ ...studentFormData, name: e.target.value })}
                    className="w-full bg-stone-50 border border-stone-200 rounded-lg text-xs px-3 py-2 focus:outline-none focus:border-[#4a5d4e] focus:ring-1 focus:ring-[#4a5d4e]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">Class Roll Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="১ক, 1A, ১খ, etc."
                    value={studentFormData.roll}
                    onChange={(e) => setStudentFormData({ ...studentFormData, roll: e.target.value })}
                    className="w-full bg-stone-50 border border-stone-200 rounded-lg text-xs px-3 py-2 focus:outline-none focus:border-[#4a5d4e] focus:ring-1 focus:ring-[#4a5d4e] font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">Assigned Class *</label>
                  <div className="w-full bg-stone-100 border border-stone-200 rounded-lg text-xs px-3 py-2 font-bold text-[#4a5d4e] select-none flex items-center gap-1.5">
                    Hifz <span className="text-stone-500 font-medium">(হিফজুল কোরআন)</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">Guardian Contact Phone</label>
                  <input
                    type="text"
                    placeholder="01712345678"
                    value={studentFormData.contact}
                    onChange={(e) => setStudentFormData({ ...studentFormData, contact: e.target.value })}
                    className="w-full bg-stone-50 border border-stone-200 rounded-lg text-xs px-3 py-2 focus:outline-none focus:border-[#4a5d4e] focus:ring-1 focus:ring-[#4a5d4e] font-mono"
                  />
                </div>
              </div>

              {/* Parent Information (অভিভাবকের তথ্য) */}
              <div className="border-t border-stone-100 pt-4">
                <h4 className="text-xs font-serif font-bold text-[#2c332d] uppercase border-b border-stone-100 pb-2 mb-3">
                  Parent Information (অভিভাবকের তথ্য)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-stone-700 mb-1">Father's Name (বাবার নাম)</label>
                    <input
                      type="text"
                      placeholder="Father's full name / carer"
                      value={studentFormData.fatherName}
                      onChange={(e) => setStudentFormData({ ...studentFormData, fatherName: e.target.value })}
                      className="w-full bg-stone-50 border border-stone-200 rounded-lg text-xs px-3 py-2 focus:outline-none focus:border-[#4a5d4e] focus:ring-1 focus:ring-[#4a5d4e]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-stone-700 mb-1">Mother's Name (মায়ের নাম)</label>
                    <input
                      type="text"
                      placeholder="Mother's full name / carer"
                      value={studentFormData.motherName}
                      onChange={(e) => setStudentFormData({ ...studentFormData, motherName: e.target.value })}
                      className="w-full bg-stone-50 border border-stone-200 rounded-lg text-xs px-3 py-2 focus:outline-none focus:border-[#4a5d4e] focus:ring-1 focus:ring-[#4a5d4e]"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-stone-700 mb-1">Additional Information (অতিরিক্ত তথ্য)</label>
                    <textarea
                      placeholder="Any extra notes about the student (address, siblings, medical notes, etc.)"
                      value={studentFormData.extraInfo}
                      onChange={(e) => setStudentFormData({ ...studentFormData, extraInfo: e.target.value })}
                      className="w-full bg-stone-50 border border-stone-200 rounded-lg text-xs px-3 py-2 focus:outline-none focus:border-[#4a5d4e] focus:ring-1 focus:ring-[#4a5d4e] h-16"
                    />
                  </div>
                </div>
              </div>

              {/* Default Pricing breakdowns setup */}
              <div>
                <h4 className="text-xs font-serif font-bold text-[#2c332d] uppercase border-b border-stone-100 pb-2 mb-3">
                  Default Tuition & Fee Bases
                </h4>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 text-xs">
                  <div>
                    <label className="block text-[10px] text-stone-500 font-bold mb-0.5">Monthly Tuition (৳)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={studentFormData.currentMonthFee}
                      onChange={(e) => setStudentFormData({ ...studentFormData, currentMonthFee: e.target.value })}
                      className="w-full bg-white border border-stone-200 rounded px-2 py-1.5 focus:outline-none focus:border-[#4a5d4e] font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-stone-500 font-bold mb-0.5">Transport/Car (৳)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={studentFormData.transport}
                      onChange={(e) => setStudentFormData({ ...studentFormData, transport: e.target.value })}
                      className="w-full bg-white border border-stone-200 rounded px-2 py-1.5 focus:outline-none focus:border-[#4a5d4e] font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-stone-500 font-bold mb-0.5">Electricity (৳)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={studentFormData.electricity}
                      onChange={(e) => setStudentFormData({ ...studentFormData, electricity: e.target.value })}
                      className="w-full bg-white border border-stone-200 rounded px-2 py-1.5 focus:outline-none focus:border-[#4a5d4e] font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-stone-500 font-bold mb-0.5">Water (৳)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={studentFormData.water}
                      onChange={(e) => setStudentFormData({ ...studentFormData, water: e.target.value })}
                      className="w-full bg-white border border-stone-200 rounded px-2 py-1.5 focus:outline-none focus:border-[#4a5d4e] font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-stone-500 font-bold mb-0.5">Previous Due (৳)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={studentFormData.previousDue}
                      onChange={(e) => setStudentFormData({ ...studentFormData, previousDue: e.target.value })}
                      className="w-full bg-white border border-stone-200 rounded px-2 py-1.5 focus:outline-none focus:border-[#4a5d4e] font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-stone-500 font-bold mb-0.5">Waiver/Discount (৳)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={studentFormData.waiver}
                      onChange={(e) => setStudentFormData({ ...studentFormData, waiver: e.target.value })}
                      className="w-full bg-white border border-stone-200 rounded px-2 py-1.5 focus:outline-none focus:border-[#4a5d4e] font-mono text-[#b88c5d]"
                    />
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex justify-end gap-2.5 pt-4 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setIsStudentFormOpen(false)}
                  className="bg-white hover:bg-stone-50 border border-stone-200 text-stone-700 text-xs px-4 py-2 rounded-lg cursor-pointer font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-[#4a5d4e] hover:bg-[#3d4d41] text-white text-xs font-bold px-5 py-2 rounded-lg shadow-sm active:scale-95 cursor-pointer border border-[#3d4d41]"
                >
                  {editingStudent ? 'Save Student Profile' : 'Register Profile'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>

    {guardAction && (
      <PasswordConfirmModal
        isOpen={true}
        onClose={() => setGuardAction(null)}
        onConfirm={guardAction.onConfirm}
        actionLabel={guardAction.label}
      />
    )}
    </>
  );
}
