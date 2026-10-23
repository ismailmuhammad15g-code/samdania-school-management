import React, { useState } from 'react';
import { Student, StudentResult, SubjectMark } from '../types';
import PasswordConfirmModal from './PasswordConfirmModal';
import logo2 from '../assets/images/logo2.png';
import {
  Award,
  Plus,
  Search,
  BookOpen,
  Printer,
  Trash2,
  FileText,
  User,
} from 'lucide-react';
import StudentPickerModal from './StudentPickerModal';
import { normalizeForComparison } from '../lib/digitUtils';

interface ResultsModuleProps {
  students: Student[];
  results: StudentResult[];
  academicClasses: string[];
  onAddResult: (result: Omit<StudentResult, 'id' | 'recordedBy' | 'date'>) => void;
  onDeleteResult: (id: string) => void;
  readOnly?: boolean;
}

// ── Combined (Term 1 + Term 2) aggregation types ──
interface CombinedSubjectRow {
  subjectName: string;
  t1?: { marks: number; full: number };
  t2?: { marks: number; full: number };
  total: number;
  full: number;
  grade: string;
}
interface CombinedStudent {
  studentId: string;
  studentName: string;
  class: string;
  subjects: CombinedSubjectRow[];
  totalObtained: number;
  totalFull: number;
  gpa: number;
  grade: string;
  status: 'Pass' | 'Fail';
  hasT1: boolean;
  hasT2: boolean;
}

export default function ResultsModule({
  students,
  results,
  academicClasses,
  onAddResult,
  onDeleteResult,
  readOnly,
}: ResultsModuleProps) {
  const [activeTab, setActiveTab] = useState<'board' | 'enter' | 'combined'>('board');
  const [selectedClass, setSelectedClass] = useState<string>('All');
  const [selectedExamType, setSelectedExamType] = useState<string>('All');
  const [searchStudentTerm, setSearchStudentTerm] = useState('');

  // Report Card Modal States
  const [viewingResult, setViewingResult] = useState<StudentResult | null>(null);
  const [guardAction, setGuardAction] = useState<{ label: string; onConfirm: () => void } | null>(null);

  // Combined Result States
  const [combinedClass, setCombinedClass] = useState<string>('All');
  const [combinedYear, setCombinedYear] = useState<number>(new Date().getFullYear());
  const [showCombinedPrint, setShowCombinedPrint] = useState(false);
  const [viewingCombined, setViewingCombined] = useState<CombinedStudent | null>(null);

  // Result Entry Form State
  const [entryExamType, setEntryExamType] = useState<'First Term' | 'Second Term' | 'Annual'>('First Term');
  const [entryYear, setEntryYear] = useState(new Date().getFullYear());
  const [subjectMarks, setSubjectMarks] = useState<{ subjectName: string; marks: string; fullMark: string }[]>([]);
  const [remarks, setRemarks] = useState('');
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  const addSubject = () => {
    setSubjectMarks([...subjectMarks, { subjectName: '', marks: '', fullMark: '' }]);
  };

  const removeSubject = (index: number) => {
    setSubjectMarks(subjectMarks.filter((_, i) => i !== index));
  };

  const updateSubject = (index: number, field: 'subjectName' | 'marks' | 'fullMark', value: string) => {
    const updated = [...subjectMarks];
    updated[index] = { ...updated[index], [field]: value };
    setSubjectMarks(updated);
  };

  const calculateGradeAndGPA = (marks: SubjectMark[]): { grade: string; gpa: number; status: 'Pass' | 'Fail' } => {
    if (marks.length === 0) return { grade: 'F', gpa: 0, status: 'Fail' };
    const total = marks.reduce((sum, m) => sum + m.marksObtained, 0);
    const maxTotal = marks.reduce((sum, m) => sum + m.maxMarks, 0);
    const percentage = maxTotal > 0 ? (total / maxTotal) * 100 : 0;

    let grade = 'F';
    let gpa = 0;
    let status: 'Pass' | 'Fail' = 'Pass';

    const hasFailedSubject = marks.some(
      m => m.maxMarks > 0 && (m.marksObtained / m.maxMarks) * 100 < 33
    );

    if (percentage >= 80) { grade = 'A+'; gpa = 5.0; }
    else if (percentage >= 70) { grade = 'A'; gpa = 4.0; }
    else if (percentage >= 60) { grade = 'A-'; gpa = 3.5; }
    else if (percentage >= 50) { grade = 'B'; gpa = 3.0; }
    else if (percentage >= 40) { grade = 'C'; gpa = 2.0; }
    else if (percentage >= 33) { grade = 'D'; gpa = 1.0; }
    else { grade = 'F'; gpa = 0; }

    if (hasFailedSubject || percentage < 33) {
      status = 'Fail';
      grade = 'F';
      gpa = 0;
    }

    return { grade, gpa, status };
  };

  const gradeFromPct = (pct: number): string => {
    if (pct >= 80) return 'A+';
    if (pct >= 70) return 'A';
    if (pct >= 60) return 'A-';
    if (pct >= 50) return 'B';
    if (pct >= 40) return 'C';
    if (pct >= 33) return 'D';
    return 'F';
  };

  // Cumulative aggregation: a "Second Term" result = First Term + Second Term,
  // an "Annual" result = First Term + Second Term + Annual. First Term stays
  // as-is. Used by both the merit board and the report card so the displayed
  // marks / grade are the running total up to that exam cycle.
  const CUMULATIVE_TERMS: Record<string, string[]> = {
    'Second Term': ['First Term', 'Second Term'],
    Annual: ['First Term', 'Second Term', 'Annual'],
  };

  const makeCumulative = (base: StudentResult, all: StudentResult[]): StudentResult => {
    const terms = CUMULATIVE_TERMS[base.examType];
    if (!terms) return base;
    const mates = all.filter(
      (x) => x.studentId === base.studentId && x.year === base.year && terms.includes(x.examType)
    );
    const subjectNames = Array.from(new Set(mates.flatMap((m) => m.marks.map((mm) => mm.subjectName))));
    const marks: SubjectMark[] = subjectNames.map((name) => {
      const parts = mates
        .map((m) => m.marks.find((mm) => mm.subjectName === name))
        .filter((p): p is SubjectMark => !!p);
      const marksObtained = parts.reduce((s, p) => s + p.marksObtained, 0);
      const maxMarks = parts.reduce((s, p) => s + p.maxMarks, 0);
      return { subjectName: name, marksObtained, maxMarks };
    });
    const grading = calculateGradeAndGPA(marks);
    return { ...base, marks, grade: grading.grade, gpa: grading.gpa, status: grading.status };
  };

  // Build the combined (Term 1 + Term 2) result sheet for the selected class/year.
  const buildCombined = (): CombinedStudent[] => {
    const year = combinedYear;
    const clsFilter = combinedClass === 'All' ? null : combinedClass;
    const classStudents = students.filter((s) => (clsFilter ? s.class === clsFilter : true));

    const out: CombinedStudent[] = [];
    classStudents.forEach((s) => {
      const t1 = results.find(
        (r) => r.studentId === s.id && r.examType === 'First Term' && r.year === year
      );
      const t2 = results.find(
        (r) => r.studentId === s.id && r.examType === 'Second Term' && r.year === year
      );
      if (!t1 && !t2) return; // only include students who sat at least one term

      const subjectNames = Array.from(
        new Set([...(t1?.marks ?? []), ...(t2?.marks ?? [])].map((m) => m.subjectName))
      );

      const subjects: CombinedSubjectRow[] = subjectNames.map((name) => {
        const m1 = t1?.marks.find((m) => m.subjectName === name);
        const m2 = t2?.marks.find((m) => m.subjectName === name);
        const total = (m1?.marksObtained ?? 0) + (m2?.marksObtained ?? 0);
        const full = (m1?.maxMarks ?? 0) + (m2?.maxMarks ?? 0);
        const pct = full > 0 ? (total / full) * 100 : 0;
        return {
          subjectName: name,
          t1: m1 ? { marks: m1.marksObtained, full: m1.maxMarks } : undefined,
          t2: m2 ? { marks: m2.marksObtained, full: m2.maxMarks } : undefined,
          total,
          full,
          grade: gradeFromPct(pct),
        };
      });

      const combinedMarks: SubjectMark[] = subjects.map((sj) => ({
        subjectName: sj.subjectName,
        marksObtained: sj.total,
        maxMarks: sj.full,
      }));
      const grading = calculateGradeAndGPA(combinedMarks);

      out.push({
        studentId: s.id,
        studentName: s.name,
        class: s.class,
        subjects,
        totalObtained: subjects.reduce((a, b) => a + b.total, 0),
        totalFull: subjects.reduce((a, b) => a + b.full, 0),
        gpa: grading.gpa,
        grade: grading.grade,
        status: grading.status,
        hasT1: !!t1,
        hasT2: !!t2,
      });
    });

    // Highest aggregate total first (merit order)
    out.sort((a, b) => b.totalObtained - a.totalObtained);
    return out;
  };

  const combinedData = buildCombined();

  const handleResultSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) {
      alert('Please select a student.');
      return;
    }

    const studentObj = selectedStudent;

    const marksList: SubjectMark[] = subjectMarks
      .filter((s) => s.subjectName.trim() !== '')
      .map((s) => ({
        subjectName: s.subjectName.trim(),
        marksObtained: parseInt(s.marks) || 0,
        maxMarks: parseInt(s.fullMark) || 100,
      }));

    if (marksList.length === 0) {
      alert('Please add at least one subject with a name.');
      return;
    }

    const grading = calculateGradeAndGPA(marksList);

    onAddResult({
      studentId: studentObj.id,
      studentName: studentObj.name,
      class: studentObj.class,
      examType: entryExamType,
      year: entryYear,
      marks: marksList,
      grade: grading.grade,
      gpa: grading.gpa,
      status: grading.status,
      remarks: remarks || 'Masha-Allah, Progressing well.',
    });

    alert(`Marks recorded successfully for ${studentObj.name}!`);

    setSelectedStudent(null);
    setRemarks('');
    setSubjectMarks([]);
    setActiveTab('board');
  };

  // Rows shown in the merit board. 'All' and 'First Term' show raw records;
  // 'Second Term' and 'Annual' show the cumulative running total up to that
  // exam cycle (First Term + Second Term, or + Annual respectively).
  const displayResults = (() => {
    const classOk = (r: StudentResult) => selectedClass === 'All' || r.class === selectedClass;
    const searchOk = (r: StudentResult) => {
      const term = normalizeForComparison(searchStudentTerm);
      if (!term) return true;
      return (
        normalizeForComparison(r.studentName).includes(term) ||
        normalizeForComparison(r.studentId).includes(term)
      );
    };

    if (selectedExamType === 'All') {
      return results.filter((r) => classOk(r) && searchOk(r));
    }
    if (selectedExamType === 'First Term') {
      return results.filter((r) => r.examType === 'First Term' && classOk(r) && searchOk(r));
    }

    const terms = CUMULATIVE_TERMS[selectedExamType];
    if (!terms) return results.filter((r) => classOk(r) && searchOk(r));

    // One cumulative row per student who sat any of the included terms.
    const grouped = new Map<string, StudentResult>();
    results
      .filter((r) => terms.includes(r.examType) && classOk(r) && searchOk(r))
      .forEach((r) => {
        if (!grouped.has(r.studentId)) {
          const mates = results.filter(
            (x) => x.studentId === r.studentId && x.year === r.year && terms.includes(x.examType)
          );
          grouped.set(r.studentId, makeCumulative(r, mates));
        }
      });
    return Array.from(grouped.values());
  })();

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Title block */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-serif font-bold text-[#2c332d] tracking-tight flex items-center gap-2">
            <Award className="h-5 w-5 text-[#4a5d4e]" />
            Student Exam Result Portal (পরীক্ষার ফলাফল বোর্ড)
          </h2>
          <p className="text-xs text-stone-500 mt-1">
            Input subject grades, compile aggregate percentage matrices, filter class-wise transcripts, and download official report cards.
          </p>
        </div>

        {!readOnly && (
          <button
            onClick={() => {
              setActiveTab('enter');
            }}
            className="w-full sm:w-auto bg-[#4a5d4e] hover:bg-[#3d4d41] text-white text-xs font-bold px-4 py-2.5 rounded-lg transition-all flex items-center justify-center gap-1.5 shadow active:scale-95 cursor-pointer border border-[#3d4d41]"
          >
            <Plus className="h-4 w-4 text-[#d9c5b2]" />
            Enter Exam Marks
          </button>
        )}
      </div>

      {/* Sub-Tabs */}
      <div className="border-b border-stone-100 flex flex-wrap gap-2">
        <button
          onClick={() => setActiveTab('board')}
          className={`px-3 py-2 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'board'
              ? 'border-[#4a5d4e] text-[#4a5d4e] font-extrabold'
              : 'border-transparent text-stone-500 hover:text-[#2c332d]'
          }`}
        >
          <Award className="h-4 w-4" />
          General Merit Board ({results.length})
        </button>

        <button
          onClick={() => setActiveTab('combined')}
          className={`px-3 py-2 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
            activeTab === 'combined'
              ? 'border-[#4a5d4e] text-[#4a5d4e] font-extrabold'
              : 'border-transparent text-stone-500 hover:text-[#2c332d]'
          }`}
        >
          <BookOpen className="h-4 w-4" />
          Combined Result (সম্মিলিত ফলাফল)
        </button>

        {!readOnly && (
          <button
            onClick={() => setActiveTab('enter')}
            className={`px-3 py-2 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'enter'
                ? 'border-[#4a5d4e] text-[#4a5d4e] font-extrabold'
                : 'border-transparent text-stone-500 hover:text-[#2c332d]'
            }`}
          >
            <BookOpen className="h-4 w-4" />
            New Marks Entry Form
          </button>
        )}
      </div>

      {/* TAB 1: MERIT BOARD DISPLAY */}
      {activeTab === 'board' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 bg-[#f5f2ed]/50 p-4 rounded-xl border border-stone-200">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-stone-400" />
              <input
                type="text"
                placeholder="Search student results..."
                value={searchStudentTerm}
                onChange={(e) => setSearchStudentTerm(e.target.value)}
                className="w-full bg-white text-xs border border-stone-200 rounded-lg pl-9 pr-3 py-2 focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1">
                <span className="text-xs text-stone-500 font-bold">Class:</span>
                <select
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className="bg-white text-xs border border-stone-200 rounded px-2.5 py-1.5"
                >
                  <option value="All">All Classes</option>
                  {academicClasses.map((cls) => (
                    <option key={cls} value={cls}>
                      {cls}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1">
                <span className="text-xs text-stone-500 font-bold">Exam Cycle:</span>
                <select
                  value={selectedExamType}
                  onChange={(e) => setSelectedExamType(e.target.value)}
                  className="bg-white text-xs border border-stone-200 rounded px-2.5 py-1.5"
                >
                  <option value="All">All Exams</option>
                  <option value="First Term">First Term (প্রথম সাময়িক)</option>
                  <option value="Second Term">Second Term (দ্বিতীয় সাময়িক)</option>
                  <option value="Annual">Annual Exam (বার্ষিক পরীক্ষা)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Results Grid/Table */}
          <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#4a5d4e] text-stone-100 uppercase tracking-wider font-semibold">
                    <th className="py-3 px-4">Student ID</th>
                    <th className="py-3 px-4">Student Name</th>
                    <th className="py-3 px-4">Class</th>
                    <th className="py-3 px-4">Exam Cycle</th>
                    <th className="py-3 px-4 text-center">Total Marks</th>
                    <th className="py-3 px-4 text-center">GPA</th>
                    <th className="py-3 px-4 text-center">Grade</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {displayResults.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-stone-500 italic">
                        No academic records matching selection.
                      </td>
                    </tr>
                  ) : (
                    displayResults.map((r) => {
                      const totalObtained = r.marks.reduce((sum, m) => sum + m.marksObtained, 0);
                      const maxPossible = r.marks.reduce((sum, m) => sum + m.maxMarks, 0);

                      return (
                        <tr key={r.id} className="hover:bg-[#f5f2ed]/50 transition-all">
                          <td className="py-3 px-4 font-mono font-bold text-[#4a5d4e]">{r.studentId}</td>
                          <td className="py-3 px-4 font-bold text-[#2c332d]">{r.studentName}</td>
                          <td className="py-3 px-4">
                            <span className="bg-[#f5f2ed] text-[#4a5d4e] px-1.5 py-0.5 rounded font-bold border border-stone-200/50">
                              {r.class}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-medium text-stone-600">
                            {r.examType} ({r.year})
                          </td>
                          <td className="py-3 px-4 text-center font-bold font-mono text-stone-700">
                            {totalObtained} / {maxPossible}
                          </td>
                          <td className="py-3 px-4 text-center font-bold font-mono text-stone-700">
                            {r.gpa.toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-black font-mono border ${
                                r.grade === 'A+'
                                  ? 'bg-green-100 text-green-700 border-green-200'
                                  : r.grade.startsWith('A')
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                    : r.grade === 'F'
                                      ? 'bg-red-100 text-red-700 border-red-200'
                                      : 'bg-stone-100 text-stone-700 border-stone-200'
                              }`}
                            >
                              {r.grade}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`px-2 py-0.5 text-[10px] rounded font-bold uppercase ${
                                r.status === 'Pass' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {r.status === 'Pass' ? 'পাস' : 'ফেইল'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() =>
                                  setGuardAction({
                                    label: `View report card for ${r.studentName}`,
                                    onConfirm: () => setViewingResult(r),
                                  })
                                }
                                className="bg-stone-50 border border-stone-200 text-stone-600 hover:text-[#4a5d4e] hover:border-[#4a5d4e] text-[10px] font-bold px-2 py-1 rounded transition-all flex items-center gap-1 cursor-pointer"
                              >
                                <FileText className="h-3.5 w-3.5 text-[#d9c5b2]" />
                                Report Card
                              </button>

                              {!readOnly && (
                                <button
                                  onClick={() =>
                                    setGuardAction({
                                      label: `Delete result for ${r.studentName}`,
                                      onConfirm: () => onDeleteResult(r.id),
                                    })
                                  }
                                  className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded-full transition-all"
                                  title="Delete results"
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

      {/* TAB 3: COMBINED (TERM 1 + TERM 2) RESULT */}
      {activeTab === 'combined' && (
        <div className="space-y-4">
          {/* Controls */}
          <div className="flex flex-wrap items-end gap-4 bg-[#f5f2ed]/50 p-4 rounded-xl border border-stone-200">
            <div className="flex items-center gap-1">
              <span className="text-xs text-stone-500 font-bold">Class:</span>
              <select
                value={combinedClass}
                onChange={(e) => setCombinedClass(e.target.value)}
                className="bg-white text-xs border border-stone-200 rounded px-2.5 py-1.5"
              >
                <option value="All">All Classes</option>
                {academicClasses.map((cls) => (
                  <option key={cls} value={cls}>
                    {cls}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-stone-500 font-bold">Year:</span>
              <input
                type="number"
                value={combinedYear}
                onChange={(e) => setCombinedYear(parseInt(e.target.value) || new Date().getFullYear())}
                className="bg-white text-xs border border-stone-200 rounded px-2.5 py-1.5 font-mono w-24"
              />
            </div>
            <div className="text-xs text-stone-500 font-bold">
              Students with results: <span className="text-[#4a5d4e] font-black">{combinedData.length}</span>
            </div>
            <button
              onClick={() => setShowCombinedPrint(true)}
              disabled={combinedData.length === 0}
              className="ml-auto bg-[#4a5d4e] hover:bg-[#3d4d41] disabled:opacity-50 text-white text-xs font-bold px-4 py-2.5 rounded-lg transition-all flex items-center justify-center gap-1.5 shadow active:scale-95 cursor-pointer border border-[#3d4d41]"
            >
              <Printer className="h-4 w-4 text-[#d9c5b2]" />
              Print Combined Sheet
            </button>
          </div>

          {/* Combined Merit Board */}
          <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#4a5d4e] text-stone-100 uppercase tracking-wider font-semibold">
                    <th className="py-3 px-4">#</th>
                    <th className="py-3 px-4">Student Name</th>
                    <th className="py-3 px-4">Class</th>
                    <th className="py-3 px-4 text-center">Term 1</th>
                    <th className="py-3 px-4 text-center">Term 2</th>
                    <th className="py-3 px-4 text-center">Combined Total</th>
                    <th className="py-3 px-4 text-center">GPA</th>
                    <th className="py-3 px-4 text-center">Grade</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {combinedData.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-stone-500 italic">
                        No combined results yet. Enter both First Term and Second Term marks for students in this class/year.
                      </td>
                    </tr>
                  ) : (
                    combinedData.map((c, i) => (
                      <tr key={c.studentId} className="hover:bg-[#f5f2ed]/50 transition-all">
                        <td className="py-3 px-4 font-mono font-bold text-stone-400">{i + 1}</td>
                        <td className="py-3 px-4 font-bold text-[#2c332d]">{c.studentName}</td>
                        <td className="py-3 px-4">
                          <span className="bg-[#f5f2ed] text-[#4a5d4e] px-1.5 py-0.5 rounded font-bold border border-stone-200/50">
                            {c.class}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {c.hasT1 ? (
                            <span className="text-emerald-600 font-bold">✔</span>
                          ) : (
                            <span className="text-stone-300">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {c.hasT2 ? (
                            <span className="text-emerald-600 font-bold">✔</span>
                          ) : (
                            <span className="text-stone-300">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center font-bold font-mono text-stone-700">
                          {c.totalObtained} / {c.totalFull}
                        </td>
                        <td className="py-3 px-4 text-center font-bold font-mono text-stone-700">
                          {c.gpa.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-black font-mono border ${
                              c.grade === 'A+'
                                ? 'bg-green-100 text-green-700 border-green-200'
                                : c.grade.startsWith('A')
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                  : c.grade === 'F'
                                    ? 'bg-red-100 text-red-700 border-red-200'
                                    : 'bg-stone-100 text-stone-700 border-stone-200'
                            }`}
                          >
                            {c.grade}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`px-2 py-0.5 text-[10px] rounded font-bold uppercase ${
                              c.status === 'Pass' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {c.status === 'Pass' ? 'পাস' : 'ফেইল'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => setViewingCombined(c)}
                            className="bg-stone-50 border border-stone-200 text-stone-600 hover:text-[#4a5d4e] hover:border-[#4a5d4e] text-[10px] font-bold px-2 py-1 rounded transition-all flex items-center gap-1 cursor-pointer mx-auto"
                          >
                            <FileText className="h-3.5 w-3.5 text-[#d9c5b2]" />
                            Report
                          </button>
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

      {/* TAB 2: MARKS ENTRY FORM */}
      {activeTab === 'enter' && !readOnly && (
        <div className="max-w-2xl mx-auto bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="p-4 bg-[#4a5d4e] text-stone-100 border-b border-[#3d4d41] flex justify-between items-center">
            <h3 className="text-sm font-serif font-bold flex items-center gap-1.5">
              <BookOpen className="h-4.5 w-4.5 text-[#d9c5b2]" />
              Enter Exam Marks (ফলাফল এন্ট্রি ফরম)
            </h3>
          </div>

          <form onSubmit={handleResultSubmit} className="p-6 space-y-5">
            {/* Student Picker Button + Details */}
            <div>
              <label className="block text-[11px] font-bold text-stone-700 mb-1">Select Student *</label>
              <button
                type="button"
                onClick={() => setIsPickerOpen(true)}
                className="w-full bg-stone-50 text-xs border border-stone-200 rounded-lg px-3 py-2.5 text-left hover:border-[#4a5d4e] transition-all cursor-pointer flex items-center gap-2"
              >
                <User className="h-4 w-4 text-stone-400" />
                {selectedStudent ? (
                  <span className="font-bold text-[#2c332d]">
                    {selectedStudent.name} — {selectedStudent.class} — Roll {selectedStudent.roll}
                  </span>
                ) : (
                  <span className="text-stone-400">Click to open student selector...</span>
                )}
              </button>

              {/* Full Student Details Card */}
              {selectedStudent && (
                <div className="mt-2 bg-[#f5f2ed]/50 border border-stone-200 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <h5 className="text-[10px] font-bold text-stone-500 uppercase tracking-wide">Student Profile</h5>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedStudent(null);
                      }}
                      className="text-[10px] font-bold text-red-500 hover:text-red-700 cursor-pointer"
                    >
                      Change
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                    <div className="bg-white rounded px-2 py-1.5 border border-stone-200/50">
                      <span className="text-[9px] text-stone-400 block font-bold">Name</span>
                      <span className="font-bold text-[#2c332d]">{selectedStudent.name}</span>
                    </div>
                    <div className="bg-white rounded px-2 py-1.5 border border-stone-200/50">
                      <span className="text-[9px] text-stone-400 block font-bold">Student ID</span>
                      <span className="font-mono font-bold text-[#4a5d4e]">{selectedStudent.id}</span>
                    </div>
                    <div className="bg-white rounded px-2 py-1.5 border border-stone-200/50">
                      <span className="text-[9px] text-stone-400 block font-bold">Class</span>
                      <span className="font-bold text-[#2c332d]">{selectedStudent.class}</span>
                    </div>
                    <div className="bg-white rounded px-2 py-1.5 border border-stone-200/50">
                      <span className="text-[9px] text-stone-400 block font-bold">Roll No.</span>
                      <span className="font-mono font-bold text-[#4a5d4e]">{selectedStudent.roll}</span>
                    </div>
                    <div className="bg-white rounded px-2 py-1.5 border border-stone-200/50">
                      <span className="text-[9px] text-stone-400 block font-bold">Contact</span>
                      <span className="font-bold text-[#2c332d]">{selectedStudent.contact || '—'}</span>
                    </div>
                    <div className="bg-white rounded px-2 py-1.5 border border-stone-200/50">
                      <span className="text-[9px] text-stone-400 block font-bold">Monthly Fee</span>
                      <span className="font-mono font-bold text-stone-700">৳{selectedStudent.currentMonthFee}</span>
                    </div>
                    <div className="bg-white rounded px-2 py-1.5 border border-stone-200/50">
                      <span className="text-[9px] text-stone-400 block font-bold">Previous Due</span>
                      <span className="font-mono font-bold text-stone-700">৳{selectedStudent.previousDue}</span>
                    </div>
                    <div className="bg-white rounded px-2 py-1.5 border border-stone-200/50">
                      <span className="text-[9px] text-stone-400 block font-bold">Advance Paid</span>
                      <span className="font-mono font-bold text-emerald-700">৳{selectedStudent.advancePaid}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-stone-700 mb-1">Exam Type *</label>
                <select
                  value={entryExamType}
                  onChange={(e) => setEntryExamType(e.target.value as any)}
                  className="w-full bg-stone-50 text-xs border border-stone-200 rounded-lg px-3 py-2"
                >
                  <option value="First Term">First Term (প্রথম সাময়িক)</option>
                  <option value="Second Term">Second Term (দ্বিতীয় সাময়িক)</option>
                  <option value="Annual">Annual Exam (বার্ষিক পরীক্ষা)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-700 mb-1">Academic Year *</label>
                <input
                  type="number"
                  required
                  value={entryYear}
                  onChange={(e) => setEntryYear(parseInt(e.target.value) || new Date().getFullYear())}
                  className="w-full bg-stone-50 text-xs border border-stone-200 rounded-lg px-3 py-2 font-mono"
                />
              </div>
            </div>

            <div className="border-t border-stone-100 pt-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-serif font-bold text-stone-800 uppercase tracking-wide">
                  Subject-Wise Scores (বিষয়ভিত্তিক নম্বর - প্রতি বিষয়: পূর্ণ নম্বর ও প্রাপ্ত নম্বর)
                </h4>
                <button
                  type="button"
                  onClick={addSubject}
                  className="bg-[#4a5d4e] hover:bg-[#3d4d41] text-white text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 cursor-pointer border border-[#3d4d41]"
                >
                  <Plus className="h-3 w-3" />
                  Add Subject
                </button>
              </div>

              {subjectMarks.length === 0 && (
                <div className="text-center py-8 text-stone-400 italic text-xs border-2 border-dashed border-stone-200 rounded-lg">
                  No subjects added yet. Click "Add Subject" to begin entering marks.
                </div>
              )}

              <div className="space-y-2">
                {subjectMarks.map((sub, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 bg-stone-50 p-2.5 rounded-lg border border-stone-200/50"
                  >
                    <span className="text-[10px] font-bold text-stone-400 w-5 text-center font-mono">{index + 1}</span>
                    <input
                      type="text"
                      required
                      placeholder="Subject name"
                      value={sub.subjectName}
                      onChange={(e) => updateSubject(index, 'subjectName', e.target.value)}
                      className="flex-1 bg-white text-xs font-bold border border-stone-300 rounded px-2.5 py-1.5 focus:border-[#4a5d4e] focus:outline-none"
                    />
                    <div className="flex items-end gap-2">
                      <div className="w-20">
                        <span className="block text-[9px] font-bold text-stone-400 mb-1 text-center">Full Mark</span>
                        <input
                          type="number"
                          min="0"
                          required
                          placeholder="100"
                          value={sub.fullMark}
                          onChange={(e) => updateSubject(index, 'fullMark', e.target.value)}
                          className="w-full bg-white text-xs font-bold border border-stone-300 rounded text-center py-1.5 font-mono focus:border-[#4a5d4e] focus:outline-none"
                        />
                      </div>
                      <div className="w-20">
                        <span className="block text-[9px] font-bold text-stone-400 mb-1 text-center">Got</span>
                        <input
                          type="number"
                          min="0"
                          required
                          placeholder="Marks"
                          value={sub.marks}
                          onChange={(e) => updateSubject(index, 'marks', e.target.value)}
                          className="w-full bg-white text-xs font-bold border border-stone-300 rounded text-center py-1.5 font-mono focus:border-[#4a5d4e] focus:outline-none"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeSubject(index)}
                      className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-all cursor-pointer"
                      title="Remove subject"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-stone-700 mb-1">
                Remarks & Conduct (মন্তব্য ও চারিত্রিক গুনাবলী)
              </label>
              <textarea
                placeholder="Masha-Allah, Progressing well in memorization. Needs slight improvement in tajweed rules."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="w-full bg-stone-50 border border-stone-200 rounded-lg text-xs p-3 focus:outline-none focus:border-[#4a5d4e] h-20"
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-stone-100">
              <button
                type="button"
                onClick={() => {
                  setSelectedStudent(null);
                  setActiveTab('board');
                }}
                className="bg-white hover:bg-stone-50 border border-stone-200 text-stone-700 text-xs px-4 py-2 rounded-lg cursor-pointer font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-[#4a5d4e] hover:bg-[#3d4d41] text-white text-xs font-bold px-5 py-2.5 rounded-lg shadow-sm active:scale-95 cursor-pointer border border-[#3d4d41]"
              >
                Save Results
              </button>
            </div>
          </form>
        </div>
      )}

      {/* SINGLE REPORT CARD MODAL */}
      {viewingResult && (() => {
        // Show the cumulative running total for Second Term / Annual cycles.
        const r = makeCumulative(viewingResult, results);
        return (
        <div className="fixed inset-0 bg-[#2c332d]/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          {/* Controls (outside print area) */}
          <div className="fixed top-4 right-4 z-[60] flex gap-2 no-print">
            <button
              onClick={handlePrint}
              className="bg-[#4a5d4e] hover:bg-[#3d4d41] text-white text-xs font-bold px-4 py-2 rounded-lg shadow flex items-center gap-1.5 cursor-pointer border border-[#3d4d41]"
            >
              <Printer className="h-4 w-4 text-[#d9c5b2]" />
              Print/Save as PDF
            </button>
            <button
              onClick={() => setViewingResult(null)}
              className="bg-white hover:bg-stone-100 text-stone-700 text-xs font-bold px-4 py-2 rounded-lg shadow border border-stone-200 cursor-pointer"
            >
              ✕ Close
            </button>
          </div>

          <div id="print-area" className="bg-white rounded-xl border border-stone-300 shadow-2xl max-w-2xl w-full p-6 space-y-6 relative mt-16">
            {/* Institution Header */}
            <div className="text-center space-y-1 pb-4 border-b border-[#4a5d4e]/30">
              <img src={logo2} alt="Logo" className="h-14 w-14 object-contain mx-auto" />
              <h3 className="font-serif font-black text-lg text-[#2c332d] tracking-wider uppercase">
                Samdania Talimul Islam Madrasah
              </h3>
              <p className="text-[10px] text-stone-500 font-mono">
                Sajeda Mansion, Bagichagaon, Comilla • Mobile: 01712-421111
              </p>
              <div className="inline-block bg-[#4a5d4e] text-[#d9c5b2] font-serif font-bold text-xs px-4 py-1.5 mt-2 tracking-widest uppercase rounded">
                Academic Progress Report (পরীক্ষার ফলাফল পত্র)
              </div>
            </div>

            {/* Student Metadata */}
            <div className="grid grid-cols-2 gap-4 text-[11px] text-[#2c332d] bg-[#f5f2ed]/45 p-3 rounded border border-stone-200">
              <div className="space-y-1">
                <p>
                  <strong>Student Name (ছাত্রের নাম):</strong>{' '}
                  <span className="font-bold text-stone-900">{r.studentName}</span>
                </p>
                <p>
                  <strong>Student ID:</strong>{' '}
                  <span className="font-mono font-bold text-[#4a5d4e]">{r.studentId}</span>
                </p>
                <p>
                  <strong>Academic Year (শিক্ষাবর্ষ):</strong>{' '}
                  <span className="font-mono font-bold">{r.year}</span>
                </p>
              </div>
              <div className="space-y-1 text-right">
                <p>
                  <strong>Assigned Class (শ্রেণী):</strong> <span className="font-bold">{r.class}</span>
                </p>
                <p>
                  <strong>Exam Cycle (পরীক্ষা):</strong>{' '}
                  <span className="font-bold text-[#4a5d4e]">{r.examType}</span>
                </p>
                <p>
                  <strong>Date Compiled:</strong>{' '}
                  <span className="font-mono">{r.date || new Date().toISOString().split('T')[0]}</span>
                </p>
              </div>
            </div>

            {/* Subject Matrix Table */}
            <table className="w-full text-left text-xs border border-stone-300">
              <thead>
                <tr className="bg-[#4a5d4e] text-stone-100 font-bold">
                  <th className="py-2 px-3 border border-stone-300">Subject Name (বিষয়ের নাম)</th>
                  <th className="py-2 px-3 text-center border border-stone-300 w-24">Full Marks</th>
                  <th className="py-2 px-3 text-center border border-stone-300 w-24">Marks Obtained</th>
                  <th className="py-2 px-3 text-center border border-stone-300 w-24">Grade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {r.marks.map((m) => {
                  const percentage = m.maxMarks > 0 ? (m.marksObtained / m.maxMarks) * 100 : 0;
                  let grade = 'F';
                  if (percentage >= 80) grade = 'A+';
                  else if (percentage >= 70) grade = 'A';
                  else if (percentage >= 60) grade = 'A-';
                  else if (percentage >= 50) grade = 'B';
                  else if (percentage >= 40) grade = 'C';
                  else if (percentage >= 33) grade = 'D';

                  return (
                    <tr key={m.subjectName} className="hover:bg-stone-50">
                      <td className="py-2 px-3 border border-stone-300 font-semibold text-[#2c332d]">
                        {m.subjectName}
                      </td>
                      <td className="py-2 px-3 text-center border border-stone-300 font-mono font-bold text-stone-500">
                        {m.maxMarks}
                      </td>
                      <td className="py-2 px-3 text-center border border-stone-300 font-mono font-black text-stone-900">
                        {m.marksObtained}
                      </td>
                      <td className="py-2 px-3 text-center border border-stone-300 font-bold font-mono text-[#4a5d4e]">
                        {grade}
                      </td>
                    </tr>
                  );
                })}

                {/* Totals Section */}
                <tr className="bg-[#f5f2ed]/60 font-bold text-stone-900">
                  <td className="py-2.5 px-3 border border-stone-300 text-right">Aggregate Weighted Totals:</td>
                  <td className="py-2.5 px-3 text-center border border-stone-300 font-mono font-bold">
                    {r.marks.reduce((s, m) => s + m.maxMarks, 0)}
                  </td>
                  <td className="py-2.5 px-3 text-center border border-stone-300 font-mono font-black text-sm text-[#4a5d4e]">
                    {r.marks.reduce((s, m) => s + m.marksObtained, 0)}
                  </td>
                  <td className="py-2.5 px-3 text-center border border-stone-300 font-mono font-black text-sm uppercase">
                    {r.grade}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Performance Metrics */}
            <div className="grid grid-cols-3 gap-3 bg-stone-100/70 p-3 rounded border border-stone-200">
              <div className="text-center">
                <span className="text-[9px] text-stone-500 uppercase font-bold block">Final GPA (জিপিএ)</span>
                <span className="text-base font-black font-mono text-[#2c332d]">{r.gpa.toFixed(2)} / 5.00</span>
              </div>
              <div className="text-center">
                <span className="text-[9px] text-stone-500 uppercase font-bold block">Pass/Fail Status (ফলাফল)</span>
                <span
                  className={`text-base font-bold uppercase ${
                    r.status === 'Pass' ? 'text-emerald-700' : 'text-red-600'
                  }`}
                >
                  {r.status === 'Pass' ? 'Pass (উত্তীর্ণ)' : 'Fail (অনুত্তীর্ণ)'}
                </span>
              </div>
              <div className="text-center">
                <span className="text-[9px] text-stone-500 uppercase font-bold block">Final Class Grade</span>
                <span className="text-base font-black font-mono text-[#4a5d4e]">{r.grade}</span>
              </div>
            </div>

            {/* Remarks/Comments */}
            <div className="space-y-1">
              <span className="text-[10px] text-stone-400 font-bold uppercase block">
                Guardian Notes & Remarks (শিক্ষক মন্তব্য):
              </span>
              <p className="text-[11px] text-stone-700 italic bg-[#fcfbf9] border border-stone-200/55 p-3 rounded">
                "{r.remarks}"
              </p>
            </div>

            {/* Signatures */}
            <div className="grid grid-cols-2 gap-4 pt-12 text-[10px] text-stone-500 font-bold">
              <div className="text-center">
                <div className="border-t border-stone-400 max-w-[150px] mx-auto pt-1 font-serif">samdaniaa madrasah</div>
                <span>Principal (নাজিম সাহেব)</span>
              </div>
              <div className="text-center">
                <div className="border-t border-stone-400 max-w-[150px] mx-auto pt-1 font-serif">Class Muallim</div>
                <span>Class Teacher (শ্রেণী শিক্ষক)</span>
              </div>
            </div>
          </div>
        </div>
      )})()}

      {/* SINGLE COMBINED STUDENT REPORT MODAL */}
      {viewingCombined && (
        <div className="fixed inset-0 bg-[#2c332d]/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="fixed top-4 right-4 z-[60] flex gap-2 no-print">
            <button
              onClick={handlePrint}
              className="bg-[#4a5d4e] hover:bg-[#3d4d41] text-white text-xs font-bold px-4 py-2 rounded-lg shadow flex items-center gap-1.5 cursor-pointer border border-[#3d4d41]"
            >
              <Printer className="h-4 w-4 text-[#d9c5b2]" />
              Print/Save as PDF
            </button>
            <button
              onClick={() => setViewingCombined(null)}
              className="bg-white hover:bg-stone-100 text-stone-700 text-xs font-bold px-4 py-2 rounded-lg shadow border border-stone-200 cursor-pointer"
            >
              ✕ Close
            </button>
          </div>

          <div id="print-area" className="bg-white rounded-xl border border-stone-300 shadow-2xl max-w-2xl w-full p-6 space-y-6 relative mt-16">
            {/* Header */}
            <div className="text-center space-y-1 pb-4 border-b border-[#4a5d4e]/30">
              <img src={logo2} alt="Logo" className="h-14 w-14 object-contain mx-auto" />
              <h3 className="font-serif font-black text-lg text-[#2c332d] tracking-wider uppercase">
                Samdania Talimul Islam Madrasah
              </h3>
              <p className="text-[10px] text-stone-500 font-mono">
                Sajeda Mansion, Bagichagaon, Comilla • Mobile: 01712-421111
              </p>
              <div className="inline-block bg-[#4a5d4e] text-[#d9c5b2] font-serif font-bold text-xs px-4 py-1.5 mt-2 tracking-widest uppercase rounded">
                Combined Term Result (সম্মিলিত ফলাফল) — {combinedYear}
              </div>
            </div>

            {/* Student Meta */}
            <div className="grid grid-cols-2 gap-4 text-[11px] text-[#2c332d] bg-[#f5f2ed]/45 p-3 rounded border border-stone-200">
              <div className="space-y-1">
                <p>
                  <strong>Student Name:</strong>{' '}
                  <span className="font-bold text-stone-900">{viewingCombined.studentName}</span>
                </p>
                <p>
                  <strong>Student ID:</strong>{' '}
                  <span className="font-mono font-bold text-[#4a5d4e]">{viewingCombined.studentId}</span>
                </p>
              </div>
              <div className="space-y-1 text-right">
                <p>
                  <strong>Class:</strong> <span className="font-bold">{viewingCombined.class}</span>
                </p>
                <p>
                  <strong>Terms:</strong>{' '}
                  <span className="font-bold text-[#4a5d4e]">
                    {viewingCombined.hasT1 ? 'First Term ✔' : 'First Term —'}
                    {viewingCombined.hasT2 ? ' · Second Term ✔' : ' · Second Term —'}
                  </span>
                </p>
              </div>
            </div>

            {/* Combined subject table with Term 1 + Term 2 */}
            <table className="w-full text-left text-xs border border-stone-300">
              <thead>
                <tr className="bg-[#4a5d4e] text-stone-100 font-bold">
                  <th className="py-2 px-3 border border-stone-300">Subject (বিষয়)</th>
                  <th className="py-2 px-3 text-center border border-stone-300 w-20">Term 1</th>
                  <th className="py-2 px-3 text-center border border-stone-300 w-20">Term 2</th>
                  <th className="py-2 px-3 text-center border border-stone-300 w-20">Combined</th>
                  <th className="py-2 px-3 text-center border border-stone-300 w-16">Grade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {viewingCombined.subjects.map((s) => (
                  <tr key={s.subjectName} className="hover:bg-stone-50">
                    <td className="py-2 px-3 border border-stone-300 font-semibold text-[#2c332d]">{s.subjectName}</td>
                    <td className="py-2 px-3 text-center border border-stone-300 font-mono">
                      {s.t1 ? `${s.t1.marks}/${s.t1.full}` : '—'}
                    </td>
                    <td className="py-2 px-3 text-center border border-stone-300 font-mono">
                      {s.t2 ? `${s.t2.marks}/${s.t2.full}` : '—'}
                    </td>
                    <td className="py-2 px-3 text-center border border-stone-300 font-mono font-black text-stone-900">
                      {s.total}/{s.full}
                    </td>
                    <td className="py-2 px-3 text-center border border-stone-300 font-bold font-mono text-[#4a5d4e]">
                      {s.grade}
                    </td>
                  </tr>
                ))}
                <tr className="bg-[#f5f2ed]/60 font-bold text-stone-900">
                  <td className="py-2.5 px-3 border border-stone-300 text-right" colSpan={3}>
                    Aggregate Combined Totals:
                  </td>
                  <td className="py-2.5 px-3 text-center border border-stone-300 font-mono font-black text-sm text-[#4a5d4e]">
                    {viewingCombined.totalObtained}/{viewingCombined.totalFull}
                  </td>
                  <td className="py-2.5 px-3 text-center border border-stone-300 font-mono font-black text-sm uppercase">
                    {viewingCombined.grade}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Metrics */}
            <div className="grid grid-cols-3 gap-3 bg-stone-100/70 p-3 rounded border border-stone-200">
              <div className="text-center">
                <span className="text-[9px] text-stone-500 uppercase font-bold block">Combined GPA</span>
                <span className="text-base font-black font-mono text-[#2c332d]">{viewingCombined.gpa.toFixed(2)} / 5.00</span>
              </div>
              <div className="text-center">
                <span className="text-[9px] text-stone-500 uppercase font-bold block">Status</span>
                <span
                  className={`text-base font-bold uppercase ${
                    viewingCombined.status === 'Pass' ? 'text-emerald-700' : 'text-red-600'
                  }`}
                >
                  {viewingCombined.status === 'Pass' ? 'Pass (উত্তীর্ণ)' : 'Fail (অনুত্তীর্ণ)'}
                </span>
              </div>
              <div className="text-center">
                <span className="text-[9px] text-stone-500 uppercase font-bold block">Grade</span>
                <span className="text-base font-black font-mono text-[#4a5d4e]">{viewingCombined.grade}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-12 text-[10px] text-stone-500 font-bold">
              <div className="text-center">
                <div className="border-t border-stone-400 max-w-[150px] mx-auto pt-1 font-serif">samdaniaa madrasah</div>
                <span>Principal (নাজিম সাহেব)</span>
              </div>
              <div className="text-center">
                <div className="border-t border-stone-400 max-w-[150px] mx-auto pt-1 font-serif">Class Muallim</div>
                <span>Class Teacher (শ্রেণী শিক্ষক)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CLASS-WIDE COMBINED PRINT SHEET */}
      {showCombinedPrint && (
        <div className="fixed inset-0 bg-[#2c332d]/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="fixed top-4 right-4 z-[60] flex gap-2 no-print">
            <button
              onClick={handlePrint}
              className="bg-[#4a5d4e] hover:bg-[#3d4d41] text-white text-xs font-bold px-4 py-2 rounded-lg shadow flex items-center gap-1.5 cursor-pointer border border-[#3d4d41]"
            >
              <Printer className="h-4 w-4 text-[#d9c5b2]" />
              Print/Save as PDF
            </button>
            <button
              onClick={() => setShowCombinedPrint(false)}
              className="bg-white hover:bg-stone-100 text-stone-700 text-xs font-bold px-4 py-2 rounded-lg shadow border border-stone-200 cursor-pointer"
            >
              ✕ Close
            </button>
          </div>

          <div id="print-area" className="bg-white rounded-xl border border-stone-300 shadow-2xl max-w-3xl w-full p-6 space-y-6 relative mt-16">
            {/* Header */}
            <div className="text-center space-y-1 pb-4 border-b border-[#4a5d4e]/30">
              <img src={logo2} alt="Logo" className="h-14 w-14 object-contain mx-auto" />
              <h3 className="font-serif font-black text-lg text-[#2c332d] tracking-wider uppercase">
                Samdania Talimul Islam Madrasah
              </h3>
              <p className="text-[10px] text-stone-500 font-mono">
                Sajeda Mansion, Bagichagaon, Comilla • Mobile: 01712-421111
              </p>
              <div className="inline-block bg-[#4a5d4e] text-[#d9c5b2] font-serif font-bold text-xs px-4 py-1.5 mt-2 tracking-widest uppercase rounded">
                Combined Term Result Sheet (সম্মিলিত ফলাফল) — {combinedYear}
              </div>
              <p className="text-[11px] text-stone-600 mt-2">
                Class: <span className="font-bold">{combinedClass === 'All' ? 'All Classes' : combinedClass}</span>{' '}
                · Total Students: <span className="font-bold text-[#4a5d4e]">{combinedData.length}</span>
              </p>
            </div>

            {/* Per-student blocks */}
            <div className="space-y-6">
              {combinedData.map((c, idx) => (
                <div key={c.studentId} className="break-inside-avoid border border-stone-300 rounded-lg overflow-hidden">
                  <div className="bg-[#4a5d4e] text-stone-100 px-3 py-2 flex items-center justify-between text-xs font-bold">
                    <span>
                      {idx + 1}. {c.studentName}{' '}
                      <span className="font-normal opacity-80">({c.studentId})</span>
                    </span>
                    <span>Class: {c.class}</span>
                  </div>
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-stone-100 text-stone-700 font-bold">
                        <th className="py-1.5 px-3 border border-stone-200">Subject (বিষয়)</th>
                        <th className="py-1.5 px-3 text-center border border-stone-200 w-24">Term 1</th>
                        <th className="py-1.5 px-3 text-center border border-stone-200 w-24">Term 2</th>
                        <th className="py-1.5 px-3 text-center border border-stone-200 w-24">Combined</th>
                        <th className="py-1.5 px-3 text-center border border-stone-200 w-16">Grade</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {c.subjects.map((s) => (
                        <tr key={s.subjectName}>
                          <td className="py-1.5 px-3 border border-stone-200 font-semibold text-[#2c332d]">{s.subjectName}</td>
                          <td className="py-1.5 px-3 text-center border border-stone-200 font-mono">
                            {s.t1 ? `${s.t1.marks}/${s.t1.full}` : '—'}
                          </td>
                          <td className="py-1.5 px-3 text-center border border-stone-200 font-mono">
                            {s.t2 ? `${s.t2.marks}/${s.t2.full}` : '—'}
                          </td>
                          <td className="py-1.5 px-3 text-center border border-stone-200 font-mono font-black text-stone-900">
                            {s.total}/{s.full}
                          </td>
                          <td className="py-1.5 px-3 text-center border border-stone-200 font-bold font-mono text-[#4a5d4e]">
                            {s.grade}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-[#f5f2ed]/60 font-bold text-stone-900">
                        <td className="py-1.5 px-3 border border-stone-200 text-right" colSpan={3}>
                          Total: {c.totalObtained}/{c.totalFull}
                        </td>
                        <td className="py-1.5 px-3 text-center border border-stone-200 font-mono font-black text-[#4a5d4e]">
                          GPA {c.gpa.toFixed(2)}
                        </td>
                        <td className="py-1.5 px-3 text-center border border-stone-200 font-mono font-black uppercase">
                          {c.grade}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  <div
                    className={`text-[10px] font-bold text-center py-1 ${
                      c.status === 'Pass' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                    }`}
                  >
                    {c.status === 'Pass' ? 'PASS (উত্তীর্ণ)' : 'FAIL (অনুত্তীর্ণ)'} · Grade {c.grade}
                  </div>
                </div>
              ))}
            </div>

            <div className="text-center text-[10px] text-stone-400 pt-2">
              Generated by Samdania Madrasah Management System · Combined First & Second Term results.
            </div>
          </div>
        </div>
      )}

      <StudentPickerModal
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        students={students}
        academicClasses={academicClasses}
        onSelect={(student) => {
          setSelectedStudent(student);
        }}
      />

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
