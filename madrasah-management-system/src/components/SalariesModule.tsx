import React, { useState } from 'react';
import { TeacherStaff, SalaryPayment, MONTHS, UserRole } from '../types';
import { 
  Briefcase, 
  Plus, 
  DollarSign, 
  Calendar, 
  Trash2, 
  Search, 
  CheckCircle, 
  Lock, 
  ShieldAlert, 
  FileText 
} from 'lucide-react';

interface SalariesModuleProps {
  teachersStaff: TeacherStaff[];
  salaryPayments: SalaryPayment[];
  onAddTeacherStaff: (member: Omit<TeacherStaff, 'id'>) => void;
  onDeleteTeacherStaff: (id: string) => void;
  onPaySalary: (payment: Omit<SalaryPayment, 'id' | 'recordedBy'>) => void;
  onDeleteSalaryPayment: (id: string) => void;
  userRole: UserRole;
}

export default function SalariesModule({
  teachersStaff,
  salaryPayments,
  onAddTeacherStaff,
  onDeleteTeacherStaff,
  onPaySalary,
  onDeleteSalaryPayment,
  userRole
}: SalariesModuleProps) {
  const [activeTab, setActiveTab] = useState<'roster' | 'payments' | 'issue'>('roster');
  
  // Registration Form States
  const [isRegOpen, setIsRegOpen] = useState(false);
  const [regData, setRegData] = useState({
    name: '',
    role: 'Teacher' as 'Teacher' | 'Staff',
    designation: '',
    baseSalary: '',
    contact: ''
  });

  // Salary Payment Issue States
  const [selectedStaff, setSelectedStaff] = useState<TeacherStaff | null>(null);
  const [paymentData, setPaymentData] = useState({
    month: MONTHS[new Date().getMonth()],
    year: new Date().getFullYear(),
    date: new Date().toISOString().split('T')[0],
    allowance: '0',
    deduction: '0',
    paymentMode: 'Cash' as 'Cash' | 'Bank' | 'Bkash/Nagad'
  });

  const [searchTerm, setSearchTerm] = useState('');

  // Calculations for dynamic totals
  const allowanceNum = parseFloat(paymentData.allowance) || 0;
  const deductionNum = parseFloat(paymentData.deduction) || 0;
  const baseSalaryNum = selectedStaff ? selectedStaff.baseSalary : 0;
  const calculatedNet = baseSalaryNum + allowanceNum - deductionNum;

  const canWrite = userRole === 'Admin' || userRole === 'Accountant';

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!regData.name || !regData.designation || !regData.baseSalary) {
      alert('Please fill out all required fields.');
      return;
    }
    onAddTeacherStaff({
      name: regData.name,
      role: regData.role,
      designation: regData.designation,
      baseSalary: parseFloat(regData.baseSalary) || 0,
      contact: regData.contact
    });
    // Reset Form
    setRegData({
      name: '',
      role: 'Teacher',
      designation: '',
      baseSalary: '',
      contact: ''
    });
    setIsRegOpen(false);
  };

  const handleIssueSalarySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaff) return;

    onPaySalary({
      teacherStaffId: selectedStaff.id,
      teacherStaffName: selectedStaff.name,
      month: paymentData.month,
      year: paymentData.year,
      date: paymentData.date,
      amount: selectedStaff.baseSalary,
      allowance: allowanceNum,
      deduction: deductionNum,
      netPaid: calculatedNet,
      paymentMode: paymentData.paymentMode
    });

    alert(`Salary paid successfully to ${selectedStaff.name} for ${paymentData.month}, ${paymentData.year}.`);
    
    // Reset Form & switch tab
    setSelectedStaff(null);
    setPaymentData({
      month: MONTHS[new Date().getMonth()],
      year: new Date().getFullYear(),
      date: new Date().toISOString().split('T')[0],
      allowance: '0',
      deduction: '0',
      paymentMode: 'Cash'
    });
    setActiveTab('payments');
  };

  const filteredStaff = teachersStaff.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.designation.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Title block */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-serif font-bold text-[#2c332d] tracking-tight flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-[#4a5d4e]" />
            Teachers & Staff Salary Management (বেতন ও সম্মানী)
          </h2>
          <p className="text-xs text-stone-500 mt-1">
            Maintain the roster, disburse monthly salaries, configure specific allowances or deductions, and trace payroll expenses.
          </p>
        </div>

        {canWrite && (
          <button
            onClick={() => {
              setIsRegOpen(true);
              setActiveTab('roster');
            }}
            className="w-full sm:w-auto bg-[#4a5d4e] hover:bg-[#3d4d41] text-white text-xs font-bold px-4 py-2.5 rounded-lg transition-all flex items-center justify-center gap-1.5 shadow active:scale-95 cursor-pointer border border-[#3d4d41]"
          >
            <Plus className="h-4 w-4 text-[#d9c5b2]" />
            Register Teacher / Staff
          </button>
        )}
      </div>

      {/* Navigation tabs inside Salary module */}
      <div className="border-b border-stone-100 flex flex-wrap gap-2">
        <button
          onClick={() => setActiveTab('roster')}
          className={`px-3 py-2 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'roster'
              ? 'border-[#4a5d4e] text-[#4a5d4e] font-extrabold'
              : 'border-transparent text-stone-500 hover:text-[#2c332d]'
          }`}
        >
          <Briefcase className="h-4 w-4" />
          Roster Directory ({teachersStaff.length})
        </button>
        
        <button
          onClick={() => setActiveTab('payments')}
          className={`px-3 py-2 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'payments'
              ? 'border-[#4a5d4e] text-[#4a5d4e] font-extrabold'
              : 'border-transparent text-stone-500 hover:text-[#2c332d]'
          }`}
        >
          <DollarSign className="h-4 w-4" />
          Salary Payment History ({salaryPayments.length})
        </button>

        {selectedStaff && (
          <button
            onClick={() => setActiveTab('issue')}
            className={`px-3 py-2 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'issue'
                ? 'border-[#4a5d4e] text-[#4a5d4e] font-extrabold'
                : 'border-transparent text-stone-500 hover:text-[#2c332d]'
            }`}
          >
            <Calendar className="h-4 w-4" />
            Disburse Salary: {selectedStaff.name}
          </button>
        )}
      </div>

      {/* TAB 1: ROSTER DIRECTORY */}
      {activeTab === 'roster' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center gap-4 bg-[#f5f2ed]/50 p-4 rounded-xl border border-stone-200">
            <div className="relative w-full sm:w-1/2">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-stone-400" />
              <input
                type="text"
                placeholder="Search by name, role, or designation..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white text-xs border border-stone-200 rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:border-[#4a5d4e] focus:ring-1 focus:ring-[#4a5d4e]"
              />
            </div>
            <div className="w-full sm:w-1/2 flex items-center justify-end text-xs text-stone-400 italic">
              * Administrative and educational staff payroll management.
            </div>
          </div>

          <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden animate-fade-in">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#4a5d4e] text-stone-100 uppercase tracking-wider font-semibold">
                    <th className="py-3 px-4">Staff ID</th>
                    <th className="py-3 px-4">Name</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Designation (পদবী)</th>
                    <th className="py-3 px-4">Contact</th>
                    <th className="py-3 px-4 text-right">Base Monthly Pay</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filteredStaff.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-stone-500 italic">No registered teachers/staff.</td>
                    </tr>
                  ) : (
                    filteredStaff.map((s) => (
                      <tr key={s.id} className="hover:bg-[#f5f2ed]/50 transition-all">
                        <td className="py-3 px-4 font-mono font-bold text-[#4a5d4e]">{s.id}</td>
                        <td className="py-3 px-4 font-bold text-[#2c332d]">{s.name}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 text-[10px] rounded font-bold uppercase border ${
                            s.role === 'Teacher' 
                              ? 'bg-[#f5f2ed] text-[#4a5d4e] border-stone-200' 
                              : 'bg-stone-100 text-stone-600 border-stone-200'
                          }`}>
                            {s.role}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-medium text-stone-600">{s.designation}</td>
                        <td className="py-3 px-4 font-mono text-stone-500">{s.contact || 'N/A'}</td>
                        <td className="py-3 px-4 font-bold font-mono text-right text-stone-700 text-sm">৳ {s.baseSalary.toFixed(2)}</td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            {canWrite ? (
                              <button
                                onClick={() => {
                                  setSelectedStaff(s);
                                  setActiveTab('issue');
                                }}
                                className="bg-[#4a5d4e] hover:bg-[#3d4d41] text-white text-[10px] font-bold px-2.5 py-1 rounded shadow-sm transition-all flex items-center gap-1 cursor-pointer border border-[#3d4d41]"
                              >
                                <DollarSign className="h-3 w-3 text-[#d9c5b2]" />
                                Pay Salary
                              </button>
                            ) : (
                              <span className="text-stone-300 text-[10px]" title="Read-only view for teachers">
                                Read-Only
                              </span>
                            )}
                            {userRole === 'Admin' && (
                              <button
                                onClick={() => {
                                  if (confirm(`Are you sure you want to remove ${s.name} from the staff roster?`)) {
                                    onDeleteTeacherStaff(s.id);
                                  }
                                }}
                                className="text-red-500 hover:text-red-700 p-1.5 hover:bg-red-50 rounded-full transition-all"
                                title="Delete Staff Profile"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
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

      {/* TAB 2: SALARY PAYMENT HISTORY */}
      {activeTab === 'payments' && (
        <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden animate-fade-in">
          <div className="p-4 bg-[#f5f2ed]/50 border-b border-stone-200/60">
            <h3 className="text-xs font-serif font-bold text-[#2c332d] uppercase">Salary Disbursement Audit Book</h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#4a5d4e] text-stone-100 font-semibold uppercase">
                  <th className="py-3 px-4">Payment Date</th>
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Salary Month</th>
                  <th className="py-3 px-4">Base Rate</th>
                  <th className="py-3 px-4">Allowance</th>
                  <th className="py-3 px-4">Deduction</th>
                  <th className="py-3 px-4">Net Paid Amount</th>
                  <th className="py-3 px-4">Paid Via</th>
                  <th className="py-3 px-4">Approved By</th>
                  {userRole === 'Admin' && <th className="py-3 px-4 text-center">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {salaryPayments.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-stone-500 italic">No salary disbursements recorded yet.</td>
                  </tr>
                ) : (
                  salaryPayments.map((p) => (
                    <tr key={p.id} className="hover:bg-[#f5f2ed]/50 transition-all">
                      <td className="py-3 px-4 font-mono text-stone-500 whitespace-nowrap">{p.date}</td>
                      <td className="py-3 px-4 font-bold text-[#2c332d]">
                        {p.teacherStaffName} <span className="text-[10px] text-stone-400 font-mono">({p.teacherStaffId})</span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap font-bold text-[#4a5d4e]">{p.month}, {p.year}</td>
                      <td className="py-3 px-4 font-mono text-stone-500">৳ {p.amount.toFixed(2)}</td>
                      <td className="py-3 px-4 font-mono text-green-600 font-medium">+৳ {p.allowance.toFixed(2)}</td>
                      <td className="py-3 px-4 font-mono text-red-500 font-medium">-৳ {p.deduction.toFixed(2)}</td>
                      <td className="py-3 px-4 font-mono font-bold text-[#4a5d4e] text-sm">৳ {p.netPaid.toFixed(2)}</td>
                      <td className="py-3 px-4">
                        <span className="bg-stone-100 text-stone-700 px-1.5 py-0.5 rounded font-bold text-[10px] border border-stone-200">
                          {p.paymentMode}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-stone-500 font-medium">{p.recordedBy}</td>
                      {userRole === 'Admin' && (
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <button
                            onClick={() => {
                              if (confirm(`Void salary payment to ${p.teacherStaffName} of ৳ ${p.netPaid}?`)) {
                                onDeleteSalaryPayment(p.id);
                              }
                            }}
                            className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded-full transition-all"
                            title="Delete Payment Record"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: ISSUE SALARY FORM */}
      {activeTab === 'issue' && selectedStaff && (
        <div className="max-w-xl mx-auto bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden animate-fade-in">
          <div className="p-4 bg-[#4a5d4e] text-stone-100 border-b border-[#3d4d41] flex justify-between items-center">
            <h3 className="text-sm font-serif font-bold flex items-center gap-1.5">
              <DollarSign className="h-4.5 w-4.5 text-[#d9c5b2]" />
              Salary Disbursement (বেতন প্রদান ফরম)
            </h3>
            <span className="text-[10px] bg-[#3d4d41] border border-[#2c332d] rounded px-2 py-0.5 font-bold">
              Employee: {selectedStaff.name} ({selectedStaff.id})
            </span>
          </div>

          <form onSubmit={handleIssueSalarySubmit} className="p-6 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-stone-700 mb-1">Salary Month *</label>
                <select
                  value={paymentData.month}
                  onChange={(e) => setPaymentData({ ...paymentData, month: e.target.value })}
                  className="w-full bg-stone-50 text-xs border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#4a5d4e]"
                >
                  {MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-700 mb-1">Salary Year *</label>
                <input
                  type="number"
                  required
                  value={paymentData.year}
                  onChange={(e) => setPaymentData({ ...paymentData, year: parseInt(e.target.value) || new Date().getFullYear() })}
                  className="w-full bg-stone-50 text-xs border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#4a5d4e] font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-700 mb-1">Disbursement Date *</label>
                <input
                  type="date"
                  required
                  value={paymentData.date}
                  onChange={(e) => setPaymentData({ ...paymentData, date: e.target.value })}
                  className="w-full bg-stone-50 text-xs border border-stone-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#4a5d4e] font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-700 mb-1">Payment Method *</label>
                <select
                  value={paymentData.paymentMode}
                  onChange={(e) => setPaymentData({ ...paymentData, paymentMode: e.target.value as any })}
                  className="w-full bg-stone-50 text-xs border border-stone-200 rounded-lg px-3 py-2 focus:outline-none"
                >
                  <option value="Cash">Cash (নগদ)</option>
                  <option value="Bank">Bank Transfer (ব্যাংক)</option>
                  <option value="Bkash/Nagad">bKash/Nagad (মোবাইল ব্যাংকিং)</option>
                </select>
              </div>
            </div>

            <div className="border-t border-stone-100 pt-4">
              <h4 className="text-xs font-serif font-bold text-stone-800 mb-3 uppercase">Payroll Breakdown (হিসাব বিবরণী)</h4>
              
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block text-[10px] text-stone-500 font-bold mb-0.5">Base Salary (৳)</label>
                  <input
                    type="text"
                    disabled
                    value={selectedStaff.baseSalary.toFixed(2)}
                    className="w-full bg-stone-100 text-stone-700 font-bold font-mono border border-stone-200 rounded px-2.5 py-1.5 select-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-green-600 font-bold mb-0.5">Allowance (৳)</label>
                  <input
                    type="number"
                    value={paymentData.allowance}
                    onChange={(e) => setPaymentData({ ...paymentData, allowance: e.target.value })}
                    className="w-full bg-white border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none text-green-600 font-bold font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-red-500 font-bold mb-0.5">Deduction (৳)</label>
                  <input
                    type="number"
                    value={paymentData.deduction}
                    onChange={(e) => setPaymentData({ ...paymentData, deduction: e.target.value })}
                    className="w-full bg-white border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none text-red-500 font-bold font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="bg-[#f5f2ed] p-4 rounded-lg border border-stone-200/50 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-stone-500 font-bold uppercase block">Net Disbursement Rate</span>
                <span className="text-lg font-black text-[#2c332d] font-mono">৳ {calculatedNet.toFixed(2)}</span>
              </div>
              <div className="text-right text-[10px] text-stone-400 max-w-[180px]">
                Net Pay = Base Rate + Allowance - Deduction. Recorded automatically as an institutional expense.
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setSelectedStaff(null)}
                className="bg-white hover:bg-stone-50 border border-stone-200 text-stone-700 text-xs px-4 py-2 rounded-lg cursor-pointer font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-[#4a5d4e] hover:bg-[#3d4d41] text-white text-xs font-bold px-5 py-2 rounded-lg shadow-sm active:scale-95 cursor-pointer border border-[#3d4d41]"
              >
                Disburse & Log Expense
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: STAFF REGISTRATION FORM */}
      {isRegOpen && (
        <div className="fixed inset-0 bg-[#2c332d]/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-xl border border-stone-200 shadow-xl max-w-md w-full overflow-hidden">
            <div className="bg-[#4a5d4e] text-stone-100 p-4 border-b border-[#3d4d41] flex justify-between items-center">
              <h3 className="font-serif font-bold text-sm flex items-center gap-1.5">
                <Briefcase className="h-4.5 w-4.5 text-[#d9c5b2]" />
                Register Teacher or Staff Member
              </h3>
              <button
                onClick={() => setIsRegOpen(false)}
                className="text-stone-200 hover:text-white font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRegisterSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-stone-700 mb-1">Full Employee Name *</label>
                <input
                  type="text"
                  required
                  placeholder="Mawlana Masood"
                  value={regData.name}
                  onChange={(e) => setRegData({ ...regData, name: e.target.value })}
                  className="w-full bg-stone-50 border border-stone-200 rounded-lg text-xs px-3 py-2 focus:outline-none focus:border-[#4a5d4e]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">Employment Type *</label>
                  <select
                    value={regData.role}
                    onChange={(e) => setRegData({ ...regData, role: e.target.value as any })}
                    className="w-full bg-stone-50 border border-stone-200 rounded-lg text-xs px-3 py-2 focus:outline-none"
                  >
                    <option value="Teacher">Teacher (শিক্ষক)</option>
                    <option value="Staff">Administrative Staff (স্টাফ)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">Designation *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Hifz Muallim, Principal"
                    value={regData.designation}
                    onChange={(e) => setRegData({ ...regData, designation: e.target.value })}
                    className="w-full bg-stone-50 border border-stone-200 rounded-lg text-xs px-3 py-2 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">Base Monthly Pay (৳) *</label>
                  <input
                    type="number"
                    required
                    placeholder="12000"
                    value={regData.baseSalary}
                    onChange={(e) => setRegData({ ...regData, baseSalary: e.target.value })}
                    className="w-full bg-stone-50 border border-stone-200 rounded-lg text-xs px-3 py-2 focus:outline-none font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">Contact Number</label>
                  <input
                    type="text"
                    placeholder="017xxxxxxxx"
                    value={regData.contact}
                    onChange={(e) => setRegData({ ...regData, contact: e.target.value })}
                    className="w-full bg-stone-50 border border-stone-200 rounded-lg text-xs px-3 py-2 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setIsRegOpen(false)}
                  className="bg-white hover:bg-stone-50 border border-stone-200 text-stone-700 text-xs px-4 py-2 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-[#4a5d4e] hover:bg-[#3d4d41] text-white text-xs font-bold px-5 py-2 rounded-lg shadow-sm cursor-pointer border border-[#3d4d41]"
                >
                  Add to Roster
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
