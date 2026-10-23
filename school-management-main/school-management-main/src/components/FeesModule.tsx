import React, { useState, useEffect, useMemo } from 'react';
import { Student, FeePayment, MONTHS, StudentAttendanceRecord } from '../types';
import { generateFeeReceiptPDF, generateAttendanceInvoicePDF } from './PDFGenerator';
import PasswordConfirmModal from './PasswordConfirmModal';
import { 
  Users, 
  Search, 
  Filter, 
  Plus, 
  CreditCard, 
  History, 
  Briefcase, 
  FileText, 
  Printer, 
  CheckCircle, 
  DollarSign, 
  Trash2,
  Edit2,
  Lock,
  UserCheck,
  CalendarCheck
} from 'lucide-react';

interface FeesModuleProps {
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
  pendingCollectStudentId?: string | null;
  onClearPendingCollect?: () => void;
  pendingEditStudentId?: string | null;
  onClearPendingEdit?: () => void;
  studentAttendanceRecords: StudentAttendanceRecord[];
  readOnly?: boolean;
}

export default function FeesModule({
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
  pendingCollectStudentId,
  onClearPendingCollect,
  pendingEditStudentId,
  onClearPendingEdit,
  studentAttendanceRecords,
  readOnly
}: FeesModuleProps) {
  
  // Tab states inside Fees module
  const [activeSubTab, setActiveSubTab] = useState<'directory' | 'collect' | 'classes' | 'history' | 'attendance'>('directory');
  // Monthly attendance invoice selector
  const [attendanceMonth, setAttendanceMonth] = useState<number>(new Date().getMonth());
  const [attendanceYear, setAttendanceYear] = useState<number>(new Date().getFullYear());
  const sortedStudentAttendance = [...studentAttendanceRecords].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const attendanceByClass = useMemo(() => {
    const groups = new Map<string, StudentAttendanceRecord[]>();
    for (const rec of sortedStudentAttendance) {
      const list = groups.get(rec.className);
      if (list) list.push(rec);
      else groups.set(rec.className, [rec]);
    }
    const out: { className: string; records: StudentAttendanceRecord[] }[] = [];
    for (const [className, records] of groups) {
      records.sort((a, b) => b.date.localeCompare(a.date));
      out.push({ className, records });
    }
    out.sort((a, b) => a.className.localeCompare(b.className));
    return out;
  }, [sortedStudentAttendance]);

  const attendanceMonthPrefix = `${attendanceYear}-${String(attendanceMonth + 1).padStart(2, '0')}`;
  const attendanceMonthRecords = useMemo(
    () => studentAttendanceRecords.filter((r) => r.date.startsWith(attendanceMonthPrefix)),
    [studentAttendanceRecords, attendanceMonthPrefix]
  );
  
  // Search and Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [classFilter, setClassFilter] = useState('All');

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
    class: academicClasses[0] || '',
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
  const [paymentFormData, setPaymentFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    month: MONTHS[new Date().getMonth()],
    previousDue: 0,
    currentMonthFee: 0,
    examFee: 0,
    transport: 0,
    electricity: 0,
    water: 0,
    waiver: 0,
    advancePaid: 0,
    receivedBy: '', // Admin who physically received the cash (required)
    amountPaid: '', // The raw cash amount collected
  });

  // Calculate dynamic payable for the form
  const calculatedPayable = (
    paymentFormData.previousDue +
    paymentFormData.currentMonthFee +
    paymentFormData.examFee +
    paymentFormData.transport +
    paymentFormData.electricity +
    paymentFormData.water
  ) - paymentFormData.waiver - paymentFormData.advancePaid;

  // Sync payments tab opening
  useEffect(() => {
    if (isCollectOpen) {
      setActiveSubTab('collect');
    }
  }, [isCollectOpen]);

  // Jump-to-student from Student Summary → open Collect Fee form for that student
  useEffect(() => {
    if (pendingCollectStudentId) {
      const student = students.find((s) => s.id === pendingCollectStudentId);
      if (student) handleInitiatePayment(student);
      onClearPendingCollect?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingCollectStudentId]);

  // Jump-to-student from Student Summary → open Edit Profile form for that student
  useEffect(() => {
    if (pendingEditStudentId) {
      const student = students.find((s) => s.id === pendingEditStudentId);
      if (student) handleOpenEditStudent(student);
      onClearPendingEdit?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingEditStudentId]);

  // Enhanced state for frontend reactivity
  const [frontendRolloverOccurred, setFrontendRolloverOccurred] = useState(false);
  const [cumulativePreviousDue, setCumulativePreviousDue] = useState(0);

  // Enhanced student selection with auto-population logic
  const handleInitiatePayment = (student: Student) => {
    // Check for monthly rollover on 1st of new month (frontend-only check)
    const today = new Date();
    const currentMonth = MONTHS[today.getMonth()];
    const isFirstOfMonth = today.getDate() === 1;
    
    let calculatedPreviousDue = 0;
    let currentMonthFee = 0;
    let rolloverOccurred = false;
    
    if (isFirstOfMonth) {
      // Check if previous month's data exists for this student
      const previousMonthPayments = payments.filter(p => 
        p.studentId === student.id && 
        p.month !== currentMonth &&
        p.amountPaid < p.totalPayable
      );
      
      // Calculate cumulative unpaid from previous months
      calculatedPreviousDue = payments
        .filter(p => p.studentId === student.id)
        .reduce((sum, p) => {
          const due = p.totalPayable - p.amountPaid;
          return sum + (due > 0 ? due : 0);
        }, 0);
      
      // Move unpaid amounts to Previous Due
      const totalUnpaidPrevious = previousMonthPayments.reduce((sum, p) => {
        const due = p.totalPayable - p.amountPaid;
        return sum + (due > 0 ? due : 0);
      }, 0);
      
      if (totalUnpaidPrevious > 0) {
        calculatedPreviousDue += totalUnpaidPrevious;
        rolloverOccurred = true;
        console.log(`Rollover applied: ${totalUnpaidPrevious} moved to Previous Due for student ${student.id}`);
      }
    } else {
      // Regular calculation: cumulative unpaid from ALL historical months
      calculatedPreviousDue = payments
        .filter(p => p.studentId === student.id)
        .reduce((sum, p) => {
          const due = p.totalPayable - p.amountPaid;
          return sum + (due > 0 ? due : 0);
        }, 0);
    }
    
    // Get current month's base fee from student registration
    currentMonthFee = student.currentMonthFee || 0;
    
    setSelectedStudent(student);
    setCumulativePreviousDue(calculatedPreviousDue);
    setFrontendRolloverOccurred(rolloverOccurred);
    
    setPaymentFormData({
      date: new Date().toISOString().split('T')[0],
      month: currentMonth,
      previousDue: calculatedPreviousDue,
      currentMonthFee: currentMonthFee,
      examFee: student.examFee,
      transport: student.transport,
      electricity: student.electricity,
      water: student.water,
      waiver: student.waiver,
      advancePaid: student.advancePaid,
      receivedBy: '', // must be selected by user
      amountPaid: '', // default empty to fill
    });
    setActiveSubTab('collect');
    setIsCollectOpen(true);
    
    // Log the auto-population for debugging
    if (rolloverOccurred || calculatedPreviousDue > 0 || currentMonthFee > 0) {
      console.log(`Auto-populated for ${student.name}:
        Previous Due: ${calculatedPreviousDue} (Cumulative historical unpaid)
        Current Month Fee: ${currentMonthFee} (Base registration fee)
        Month: ${currentMonth}
        ${rolloverOccurred ? 'Monthly rollover applied' : ''}`);
    }
  };

  // Frontend-only recalculation when form fields change
  useEffect(() => {
    const newCalculatedPayable = (
      paymentFormData.previousDue +
      paymentFormData.currentMonthFee +
      paymentFormData.examFee +
      paymentFormData.transport +
      paymentFormData.electricity +
      paymentFormData.water
    ) - paymentFormData.waiver - paymentFormData.advancePaid;
    
    // Only update if the calculated payable has actually changed
    if (Math.abs(newCalculatedPayable - calculatedPayable) > 0.01) {
      // Note: calculatedPayable is already calculated in the component
      // This useEffect ensures that if any field changes, the totals are properly updated
    }
  }, [paymentFormData]);

  // Open Edit Student Form
  const handleOpenEditStudent = (student: Student) => {
    setEditingStudent(student);
    setStudentFormData({
      name: student.name,
      roll: student.roll.toString(),
      class: student.class,
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
    if (!studentFormData.name || !studentFormData.roll) {
      alert('Please fill out student name and roll.');
      return;
    }

    const rollNum = parseInt(studentFormData.roll) || 1;

    // Validate unique roll number within the same class
    const duplicateRoll = students.find(
      s => s.class === studentFormData.class && s.roll === rollNum && s.id !== editingStudent?.id
    );
    if (duplicateRoll) {
      alert(`Roll number ${rollNum} already exists in ${studentFormData.class} (assigned to "${duplicateRoll.name}"). Please use a unique roll number.`);
      return;
    }

    const payload = {
      name: studentFormData.name,
      roll: rollNum,
      class: studentFormData.class,
      contact: studentFormData.contact,
      fatherName: studentFormData.fatherName,
      motherName: studentFormData.motherName,
      extraInfo: studentFormData.extraInfo,
      previousDue: parseFloat(studentFormData.previousDue) || 0,
      currentMonthFee: parseFloat(studentFormData.currentMonthFee) || 0,
      examFee: parseFloat(studentFormData.examFee) || 0,
      transport: parseFloat(studentFormData.transport) || 0,
      electricity: parseFloat(studentFormData.electricity) || 0,
      water: parseFloat(studentFormData.water) || 0,
      waiver: parseFloat(studentFormData.waiver) || 0,
      advancePaid: parseFloat(studentFormData.advancePaid) || 0,
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
    const enteredCash = parseFloat(paymentFormData.amountPaid);
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
      previousDue: paymentFormData.previousDue,
      currentMonthFee: paymentFormData.currentMonthFee,
      examFee: paymentFormData.examFee,
      transport: paymentFormData.transport,
      electricity: paymentFormData.electricity,
      water: paymentFormData.water,
      waiver: paymentFormData.waiver,
      advancePaid: paymentFormData.advancePaid,
      totalPayable: calculatedPayable,
      amountPaid: enteredCash,
      receivedBy: paymentFormData.receivedBy,
    });

    // Reset payment states
    setSelectedStudent(null);
    setPaymentFormData({
      date: new Date().toISOString().split('T')[0],
      month: MONTHS[new Date().getMonth()],
      previousDue: 0,
      currentMonthFee: 0,
      examFee: 0,
      transport: 0,
      electricity: 0,
      water: 0,
      waiver: 0,
      advancePaid: 0,
      amountPaid: '',
    });
    setIsCollectOpen(false);
    setActiveSubTab('history');
  };

  // Filter student directory
  const filteredStudents = students.filter((s) => {
    const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          s.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          s.contact.includes(searchTerm);
    const matchesClass = classFilter === 'All' || s.class === classFilter;
    return matchesSearch && matchesClass;
  });

  // Class dues breakdown calculations
  const classDuesList = academicClasses.map((cls) => {
    const classStudents = students.filter((s) => s.class === cls);
    const totalStudents = classStudents.length;
    const totalPreviousDue = classStudents.reduce((sum, s) => sum + s.previousDue, 0);
    const totalCurrentFees = classStudents.reduce((sum, s) => sum + s.currentMonthFee, 0);
    const totalWaivers = classStudents.reduce((sum, s) => sum + s.waiver, 0);
    
    // Total payable = (Prev + Curr + Exam + Transport + Elec + Water) - Waiver - Advance
    const totalPayable = classStudents.reduce((sum, s) => {
      return sum + ((s.previousDue + s.currentMonthFee + s.examFee + s.transport + s.electricity + s.water) - s.waiver - s.advancePaid);
    }, 0);

    return {
      className: cls,
      studentCount: totalStudents,
      previousDue: totalPreviousDue,
      currentFee: totalCurrentFees,
      waivers: totalWaivers,
      netDue: Math.max(0, totalPayable),
    };
  });

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
          onClick={() => setActiveSubTab('classes')}
          className={`px-3 py-2 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
            activeSubTab === 'classes'
              ? 'border-[#4a5d4e] text-[#4a5d4e] font-extrabold'
              : 'border-transparent text-stone-500 hover:text-[#2c332d]'
          }`}
        >
          <Briefcase className="h-4 w-4" />
          Class Outstanding Dues
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
          onClick={() => setActiveSubTab('attendance')}
          className={`px-3 py-2 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
            activeSubTab === 'attendance'
              ? 'border-[#4a5d4e] text-[#4a5d4e] font-extrabold'
              : 'border-transparent text-stone-500 hover:text-[#2c332d]'
          }`}
        >
          <CalendarCheck className="h-4 w-4" />
          Class Attendance (ক্লাস উপস্থিতি)
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
                type="text"
                placeholder="Search student by Name, ID, or Contact..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white text-xs border border-stone-200 rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:border-[#4a5d4e] focus:ring-1 focus:ring-[#4a5d4e]"
              />
            </div>

            <div className="w-full sm:w-1/2 flex items-center gap-2 justify-end">
              <span className="text-xs text-stone-500 font-medium">Class:</span>
              <select
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                className="bg-white text-xs border border-stone-200 rounded px-2.5 py-1.5 focus:outline-none focus:border-[#4a5d4e]"
              >
                <option value="All">All Classes</option>
                {academicClasses.map((cls) => <option key={cls} value={cls}>{cls}</option>)}
              </select>
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
                    <th className="py-3 px-4">Received By</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-stone-500 italic">No students registered yet.</td>
                    </tr>
                  ) : (
                    filteredStudents.map((s) => {
                      const totalPayable = (s.previousDue + s.currentMonthFee + s.examFee + s.transport + s.electricity + s.water) - s.waiver - s.advancePaid;
                      const lastReceived = [...payments]
                        .filter(p => p.studentId === s.id)
                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]?.receivedBy;
                      return (
                        <tr key={s.id} className="hover:bg-[#f5f2ed]/50 transition-all">
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
                          <td className="py-3 px-4 whitespace-nowrap font-mono font-bold text-stone-700">৳ {s.currentMonthFee.toFixed(2)}</td>
                          <td className="py-3 px-4 whitespace-nowrap font-mono font-bold text-[#b27d6d]">৳ {s.previousDue.toFixed(2)}</td>
                          <td className="py-3 px-4 whitespace-nowrap font-mono text-stone-500">৳ {s.transport.toFixed(2)}</td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className={`font-mono font-bold text-sm ${totalPayable > 0 ? 'text-[#b27d6d]' : 'text-[#4a5d4e]'}`}>
                              ৳ {totalPayable.toFixed(2)}
                            </span>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px] font-bold text-[#4a5d4e]">{lastReceived || '—'}</td>
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
              <span>Showing {filteredStudents.length} of {students.length} students.</span>
              <span>Admin Panel</span>
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
                      type="number"
                      value={paymentFormData.previousDue}
                      onChange={(e) => setPaymentFormData({ ...paymentFormData, previousDue: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-white text-xs border border-stone-200 rounded px-2 py-1.5 focus:outline-none focus:border-[#4a5d4e] font-mono font-bold"
                    />
                  </div>

                  {/* Current Month Fee */}
                  <div>
                    <label className="block text-[11px] font-bold text-stone-600 mb-1">Current Month Fee (বর্তমান মাস)</label>
                    <input
                      type="number"
                      value={paymentFormData.currentMonthFee}
                      onChange={(e) => setPaymentFormData({ ...paymentFormData, currentMonthFee: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-white text-xs border border-stone-200 rounded px-2 py-1.5 focus:outline-none focus:border-[#4a5d4e] font-mono font-bold"
                    />
                  </div>

                  {/* Exam Fee */}
                  <div>
                    <label className="block text-[11px] font-bold text-stone-600 mb-1">Exam Fee (পরীক্ষার ফি)</label>
                    <input
                      type="number"
                      value={paymentFormData.examFee}
                      onChange={(e) => setPaymentFormData({ ...paymentFormData, examFee: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-white text-xs border border-stone-200 rounded px-2 py-1.5 focus:outline-none focus:border-[#4a5d4e] font-mono font-bold"
                    />
                  </div>

                  {/* Advance Paid */}
                  <div>
                    <label className="block text-[11px] font-bold text-stone-600 mb-1">Advance Paid (অগ্রিম)</label>
                    <input
                      type="number"
                      value={paymentFormData.advancePaid}
                      onChange={(e) => setPaymentFormData({ ...paymentFormData, advancePaid: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-white text-xs border border-stone-200 rounded px-2 py-1.5 focus:outline-none focus:border-[#4a5d4e] font-mono font-bold"
                    />
                  </div>

                  {/* Transport */}
                  <div>
                    <label className="block text-[11px] font-bold text-stone-600 mb-1">Transport/Car Rent (গাড়ি ভাড়া)</label>
                    <input
                      type="number"
                      value={paymentFormData.transport}
                      onChange={(e) => setPaymentFormData({ ...paymentFormData, transport: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-white text-xs border border-stone-200 rounded px-2 py-1.5 focus:outline-none focus:border-[#4a5d4e] font-mono font-bold"
                    />
                  </div>

                  {/* Electricity Bill */}
                  <div>
                    <label className="block text-[11px] font-bold text-stone-600 mb-1">Electricity Bill (কারেন্ট বিল)</label>
                    <input
                      type="number"
                      value={paymentFormData.electricity}
                      onChange={(e) => setPaymentFormData({ ...paymentFormData, electricity: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-white text-xs border border-stone-200 rounded px-2 py-1.5 focus:outline-none focus:border-[#4a5d4e] font-mono font-bold"
                    />
                  </div>

                  {/* Water Bill */}
                  <div>
                    <label className="block text-[11px] font-bold text-stone-600 mb-1">Water Bill (পানি বিল)</label>
                    <input
                      type="number"
                      value={paymentFormData.water}
                      onChange={(e) => setPaymentFormData({ ...paymentFormData, water: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-white text-xs border border-stone-200 rounded px-2 py-1.5 focus:outline-none focus:border-[#4a5d4e] font-mono font-bold"
                    />
                  </div>

                  {/* Waiver/Discount */}
                  <div>
                    <label className="block text-[11px] font-bold text-[#b88c5d] mb-1">Waiver/Discount (মওকুফ) *</label>
                    <input
                      type="number"
                      value={paymentFormData.waiver}
                      onChange={(e) => setPaymentFormData({ ...paymentFormData, waiver: parseFloat(e.target.value) || 0 })}
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
                      type="number"
                      step="0.01"
                      required
                      placeholder="0.00"
                      value={paymentFormData.amountPaid}
                      onChange={(e) => setPaymentFormData({ ...paymentFormData, amountPaid: e.target.value })}
                      className="w-full bg-white text-sm font-bold border border-stone-300 rounded-lg pl-8 pr-3.5 py-2.5 focus:outline-none focus:border-[#4a5d4e] focus:ring-1 focus:ring-[#4a5d4e]/30"
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

      {/* VIEW PANEL 3: CLASS-WISE OUTSTANDING DUES SUMMARY */}
      {activeSubTab === 'classes' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-[#f5f2ed]/50 border-b border-stone-200/60">
              <h3 className="text-xs font-serif font-bold text-[#2c332d] uppercase">Class-wise Audit Reports</h3>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#4a5d4e] text-stone-100 uppercase font-semibold">
                    <th className="py-3 px-4">Class</th>
                    <th className="py-3 px-4 text-center">Student Headcount</th>
                    <th className="py-3 px-4">Historical dues</th>
                    <th className="py-3 px-4">Monthly Fee Base</th>
                    <th className="py-3 px-4">Active Waivers</th>
                    <th className="py-3 px-4">Estimated Outstandings</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {classDuesList.map((c) => (
                    <tr key={c.className} className="hover:bg-[#f5f2ed]/50">
                      <td className="py-3 px-4 font-bold text-[#2c332d]">{c.className}</td>
                      <td className="py-3 px-4 text-center font-bold font-mono text-stone-700">{c.studentCount}</td>
                      <td className="py-3 px-4 whitespace-nowrap font-mono text-stone-500">৳ {c.previousDue.toFixed(2)}</td>
                      <td className="py-3 px-4 whitespace-nowrap font-mono text-stone-700">৳ {c.currentFee.toFixed(2)}</td>
                      <td className="py-3 px-4 whitespace-nowrap font-mono text-[#b27d6d]">-৳ {c.waivers.toFixed(2)}</td>
                      <td className="py-3 px-4 whitespace-nowrap font-bold font-mono text-[#b27d6d] text-sm">
                        ৳ {c.netDue.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
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
                    <th className="py-3 px-4 text-center">Receipt PDF</th>
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
                              onClick={() => {
                                const btn = document.activeElement as HTMLButtonElement;
                                if (btn) btn.disabled = true;
                                generateFeeReceiptPDF(p, { download: true });
                                if (btn) btn.disabled = false;
                              }}
                              className="bg-white hover:bg-[#f5f2ed] border border-stone-200 hover:border-[#4a5d4e] text-[#4a5d4e] text-[10px] font-bold px-2.5 py-1 rounded shadow-sm transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <FileText className="h-3 w-3 text-[#d9c5b2]" />
                              Download
                            </button>
                            <button
                              onClick={() => {
                                const btn = document.activeElement as HTMLButtonElement;
                                if (btn) btn.disabled = true;
                                generateFeeReceiptPDF(p, { download: false, print: true });
                                if (btn) btn.disabled = false;
                              }}
                              className="bg-[#4a5d4e] hover:bg-[#3b4a3b] border border-[#4a5d4e] text-white text-[10px] font-bold px-2.5 py-1 rounded shadow-sm transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <Printer className="h-3 w-3" />
                              Print
                            </button>
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

      {/* VIEW PANEL 5: CLASS ATTENDANCE REPORTS */}
      {activeSubTab === 'attendance' && (
        <div className="space-y-4">
          {/* Header: month selector + monthly invoice download */}
          <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-sm font-serif font-bold text-[#2c332d] flex items-center gap-2">
                <CalendarCheck className="h-4 w-4 text-[#4a5d4e]" />
                Class Attendance Reports (ক্লাস উপস্থিতি)
              </h2>
              <p className="text-[11px] text-stone-500">সব ক্লাসের উপস্থিতির রেকর্ড ও মাসিক ইনভয়েস।</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={attendanceMonth}
                onChange={(e) => setAttendanceMonth(Number(e.target.value))}
                className="border border-stone-200 rounded-lg px-2.5 py-2 text-xs font-semibold text-stone-700 bg-stone-50"
              >
                {MONTHS.map((m, i) => (
                  <option key={m} value={i}>{m}</option>
                ))}
              </select>
              <select
                value={attendanceYear}
                onChange={(e) => setAttendanceYear(Number(e.target.value))}
                className="border border-stone-200 rounded-lg px-2.5 py-2 text-xs font-semibold text-stone-700 bg-stone-50"
              >
                {Array.from(new Set([attendanceYear, new Date().getFullYear(), ...studentAttendanceRecords.map((r) => Number(r.date.slice(0, 4)))])).sort((a, b) => b - a).map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <button
                onClick={() => generateAttendanceInvoicePDF(attendanceMonthRecords, MONTHS[attendanceMonth], attendanceYear, { download: true })}
                disabled={attendanceMonthRecords.length === 0}
                className="flex items-center gap-1.5 bg-white hover:bg-[#f5f2ed] border border-stone-200 hover:border-[#4a5d4e] text-[#4a5d4e] text-[10px] font-bold px-2.5 py-2 rounded shadow-sm transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FileText className="h-3 w-3 text-[#d9c5b2]" />
                Download
              </button>
              <button
                onClick={() => generateAttendanceInvoicePDF(attendanceMonthRecords, MONTHS[attendanceMonth], attendanceYear, { print: true })}
                disabled={attendanceMonthRecords.length === 0}
                className="flex items-center gap-1.5 bg-[#4a5d4e] hover:bg-[#3b4a3b] border border-[#4a5d4e] text-white text-[10px] font-bold px-2.5 py-2 rounded shadow-sm transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Printer className="h-3 w-3" />
                Print
              </button>
            </div>
          </div>

          {attendanceByClass.length === 0 ? (
            <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-5">
              <p className="text-xs text-stone-500">No class attendance records have been submitted yet.</p>
            </div>
          ) : (
            attendanceByClass.map(({ className, records }) => {
              const latest = records[0];
              const total = latest.statuses.length;
              const presentCount = latest.statuses.filter((s) => s.present).length;
              const absentCount = total - presentCount;
              return (
                <div key={className} className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
                  {/* Box header — one per class, never duplicated */}
                  <div className="bg-[#4a5d4e] text-stone-100 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <CalendarCheck className="h-4 w-4 text-[#d9c5b2]" />
                      <h3 className="text-sm font-serif font-bold">{className}</h3>
                      <span className="text-[10px] bg-white/15 rounded-full px-2 py-0.5">
                        {records.length} day{records.length > 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] font-bold">
                      <span className="bg-white/15 rounded-full px-2 py-0.5">সর্বশেষ {latest.date}</span>
                      <span className="bg-emerald-500/25 text-emerald-100 rounded-full px-2 py-0.5">✓ {presentCount} হাজির</span>
                      <span className="bg-red-500/25 text-red-100 rounded-full px-2 py-0.5">✕ {absentCount} অনুপস্থিত</span>
                      <span className="bg-white/15 rounded-full px-2 py-0.5">মোট {total}</span>
                    </div>
                  </div>

                  {/* Per-date detail, all inside the one class box */}
                  <div className="divide-y divide-stone-100">
                    {records.map((rec) => (
                      <div key={rec.id} className="p-3">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[11px] font-bold text-stone-500">📅 {rec.date} • {rec.teacherName}</p>
                          <p className="text-[10px] text-stone-400">{rec.statuses.length} students</p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {rec.statuses.map((item) => (
                            <div key={item.id} className="flex items-center justify-between gap-2 rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-1.5">
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-[#2c332d] truncate">{item.studentName}</p>
                                {item.note && <p className="text-[10px] text-stone-500 truncate">📝 {item.note}</p>}
                              </div>
                              <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                                {item.present ? (
                                  <>
                                    <span className="rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-[10px] font-bold">হাজির</span>
                                    {item.late && <span className="rounded-full bg-amber-100 text-amber-700 px-1.5 py-0.5 text-[10px] font-bold">Late</span>}
                                    {item.dairy && <span className="rounded-full bg-sky-100 text-sky-700 px-1.5 py-0.5 text-[10px] font-bold">Dairy</span>}
                                    {item.uniform && <span className="rounded-full bg-violet-100 text-violet-700 px-1.5 py-0.5 text-[10px] font-bold">Uniform</span>}
                                  </>
                                ) : (
                                  <span className="rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-[10px] font-bold">অনুপস্থিত</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
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
                    type="number"
                    min="1"
                    required
                    placeholder="Class Roll"
                    value={studentFormData.roll}
                    onChange={(e) => setStudentFormData({ ...studentFormData, roll: e.target.value })}
                    className="w-full bg-stone-50 border border-stone-200 rounded-lg text-xs px-3 py-2 focus:outline-none focus:border-[#4a5d4e] focus:ring-1 focus:ring-[#4a5d4e] font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">Assigned Class *</label>
                  <select
                    value={studentFormData.class}
                    onChange={(e) => setStudentFormData({ ...studentFormData, class: e.target.value })}
                    className="w-full bg-stone-50 border border-stone-200 rounded-lg text-xs px-3 py-2 focus:outline-none focus:border-[#4a5d4e] focus:ring-1 focus:ring-[#4a5d4e]"
                  >
                    {academicClasses.map((cls) => <option key={cls} value={cls}>{cls}</option>)}
                  </select>
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

                {/* Parent Information (অভিভাবকের তথ্য) */}
                <div>
                  <h4 className="text-xs font-serif font-bold text-[#2c332d] uppercase border-b border-stone-100 pb-2 mb-3 mt-1">
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
                      type="number"
                      value={studentFormData.currentMonthFee}
                      onChange={(e) => setStudentFormData({ ...studentFormData, currentMonthFee: e.target.value })}
                      className="w-full bg-white border border-stone-200 rounded px-2 py-1.5 focus:outline-none focus:border-[#4a5d4e] font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-stone-500 font-bold mb-0.5">Transport/Car (৳)</label>
                    <input
                      type="number"
                      value={studentFormData.transport}
                      onChange={(e) => setStudentFormData({ ...studentFormData, transport: e.target.value })}
                      className="w-full bg-white border border-stone-200 rounded px-2 py-1.5 focus:outline-none focus:border-[#4a5d4e] font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-stone-500 font-bold mb-0.5">Electricity (৳)</label>
                    <input
                      type="number"
                      value={studentFormData.electricity}
                      onChange={(e) => setStudentFormData({ ...studentFormData, electricity: e.target.value })}
                      className="w-full bg-white border border-stone-200 rounded px-2 py-1.5 focus:outline-none focus:border-[#4a5d4e] font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-stone-500 font-bold mb-0.5">Water (৳)</label>
                    <input
                      type="number"
                      value={studentFormData.water}
                      onChange={(e) => setStudentFormData({ ...studentFormData, water: e.target.value })}
                      className="w-full bg-white border border-stone-200 rounded px-2 py-1.5 focus:outline-none focus:border-[#4a5d4e] font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-stone-500 font-bold mb-0.5">Previous Due (৳)</label>
                    <input
                      type="number"
                      value={studentFormData.previousDue}
                      onChange={(e) => setStudentFormData({ ...studentFormData, previousDue: e.target.value })}
                      className="w-full bg-white border border-stone-200 rounded px-2 py-1.5 focus:outline-none focus:border-[#4a5d4e] font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-stone-500 font-bold mb-0.5">Waiver/Discount (৳)</label>
                    <input
                      type="number"
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
