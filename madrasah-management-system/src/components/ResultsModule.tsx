import React, { useState } from 'react';
import { Student, StudentResult, SubjectMark, ACADEMIC_CLASSES, UserRole } from '../types';
import { 
  Award, 
  Plus, 
  Search, 
  BookOpen, 
  Download, 
  Printer, 
  Trash2, 
  FileText, 
  CheckCircle, 
  AlertCircle,
  UserCheck
} from 'lucide-react';

interface ResultsModuleProps {
  students: Student[];
  results: StudentResult[];
  onAddResult: (result: Omit<StudentResult, 'id' | 'recordedBy' | 'date'>) => void;
  onDeleteResult: (id: string) => void;
  userRole: UserRole;
}

const DEFAULT_SUBJECTS = [
  'Al-Quran & Tajweed',
  'Arabic & Grammer',
  'Hadith & Fiqh',
  'Bengali (বাংলা)',
  'Mathematics (গণিত)',
  'English (ইংরেজি)'
];

export default function ResultsModule({
  students,
  results,
  onAddResult,
  onDeleteResult,
  userRole
}: ResultsModuleProps) {
  const [activeTab, setActiveTab] = useState<'board' | 'enter' | 'report'>('board');
  const [selectedClass, setSelectedClass] = useState<string>('All');
  const [selectedExamType, setSelectedExamType] = useState<string>('All');
  const [searchStudentTerm, setSearchStudentTerm] = useState('');

  // Report Card Modal States
  const [viewingResult, setViewingResult] = useState<StudentResult | null>(null);

  // Result Entry Form State
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [entryExamType, setEntryExamType] = useState<'First Term' | 'Second Term' | 'Annual'>('First Term');
  const [entryYear, setEntryYear] = useState(new Date().getFullYear());
  const [subjectMarks, setSubjectMarks] = useState<Record<string, string>>(
    DEFAULT_SUBJECTS.reduce((acc, sub) => ({ ...acc, [sub]: '' }), {})
  );
  const [remarks, setRemarks] = useState('');

  const canWrite = userRole === 'Admin' || userRole === 'Teacher';

  const calculateGradeAndGPA = (marks: SubjectMark[]): { grade: string; gpa: number; status: 'Pass' | 'Fail' } => {
    if (marks.length === 0) return { grade: 'F', gpa: 0, status: 'Fail' };
    const total = marks.reduce((sum, m) => sum + m.marksObtained, 0);
    const maxTotal = marks.reduce((sum, m) => sum + m.maxMarks, 0);
    const percentage = (total / maxTotal) * 100;

    let grade = 'F';
    let gpa = 0;
    let status: 'Pass' | 'Fail' = 'Pass';

    // If any subject is below 33%, it is a fail in traditional madrasah system
    const hasFailedSubject = marks.some(m => (m.marksObtained / m.maxMarks) * 100 < 33);

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

  const handleResultSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId) {
      alert('Please select a student.');
      return;
    }

    const studentObj = students.find(s => s.id === selectedStudentId);
    if (!studentObj) return;

    // Build subject marks payload
    const marksList: SubjectMark[] = DEFAULT_SUBJECTS.map(sub => {
      const marksObtained = parseInt(subjectMarks[sub]) || 0;
      return {
        subjectName: sub,
        marksObtained,
        maxMarks: 100
      };
    });

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
      remarks: remarks || 'Masha-Allah, Progressing well.'
    });

    alert(`Marks recorded successfully for ${studentObj.name}!`);

    // Reset Form
    setSelectedStudentId('');
    setRemarks('');
    setSubjectMarks(DEFAULT_SUBJECTS.reduce((acc, sub) => ({ ...acc, [sub]: '' }), {}));
    setActiveTab('board');
  };

  // Filter student results lists
  const filteredResults = results.filter(r => {
    const matchesClass = selectedClass === 'All' || r.class === selectedClass;
    const matchesExam = selectedExamType === 'All' || r.examType === selectedExamType;
    const matchesSearch = r.studentName.toLowerCase().includes(searchStudentTerm.toLowerCase()) ||
                          r.studentId.toLowerCase().includes(searchStudentTerm.toLowerCase());
    return matchesClass && matchesExam && matchesSearch;
  });

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

        {canWrite && (
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
        
        {canWrite && (
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
                  {ACADEMIC_CLASSES.map(cls => <option key={cls} value={cls}>{cls}</option>)}
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
                  {filteredResults.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-stone-500 italic">No academic records matching selection.</td>
                    </tr>
                  ) : (
                    filteredResults.map((r) => {
                      const totalObtained = r.marks.reduce((sum, m) => sum + m.marksObtained, 0);
                      const maxPossible = r.marks.reduce((sum, m) => sum + m.maxMarks, 0);
                      
                      return (
                        <tr key={r.id} className="hover:bg-[#f5f2ed]/50 transition-all">
                          <td className="py-3 px-4 font-mono font-bold text-[#4a5d4e]">{r.studentId}</td>
                          <td className="py-3 px-4 font-bold text-[#2c332d]">{r.studentName}</td>
                          <td className="py-3 px-4">
                            <span className="bg-[#f5f2ed] text-[#4a5d4e] px-1.5 py-0.5 rounded font-bold border border-stone-200/50">{r.class}</span>
                          </td>
                          <td className="py-3 px-4 font-medium text-stone-600">{r.examType} ({r.year})</td>
                          <td className="py-3 px-4 text-center font-bold font-mono text-stone-700">{totalObtained} / {maxPossible}</td>
                          <td className="py-3 px-4 text-center font-bold font-mono text-stone-700">{r.gpa.toFixed(2)}</td>
                          <td className="py-3 px-4 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-black font-mono border ${
                              r.grade === 'A+' ? 'bg-green-100 text-green-700 border-green-200' :
                              r.grade.startsWith('A') ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                              r.grade === 'F' ? 'bg-red-100 text-red-700 border-red-200' : 'bg-stone-100 text-stone-700 border-stone-200'
                            }`}>
                              {r.grade}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`px-2 py-0.5 text-[10px] rounded font-bold uppercase ${
                              r.status === 'Pass' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {r.status === 'Pass' ? 'পাস' : 'ফেইল'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => setViewingResult(r)}
                                className="bg-stone-50 border border-stone-200 text-stone-600 hover:text-[#4a5d4e] hover:border-[#4a5d4e] text-[10px] font-bold px-2 py-1 rounded transition-all flex items-center gap-1 cursor-pointer"
                              >
                                <FileText className="h-3.5 w-3.5 text-[#d9c5b2]" />
                                Report Card
                              </button>

                              {userRole === 'Admin' && (
                                <button
                                  onClick={() => {
                                    if (confirm('Are you sure you want to delete this result record?')) {
                                      onDeleteResult(r.id);
                                    }
                                  }}
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

      {/* TAB 2: MARKS ENTRY FORM */}
      {activeTab === 'enter' && (
        <div className="max-w-2xl mx-auto bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
          <div className="p-4 bg-[#4a5d4e] text-stone-100 border-b border-[#3d4d41] flex justify-between items-center">
            <h3 className="text-sm font-serif font-bold flex items-center gap-1.5">
              <BookOpen className="h-4.5 w-4.5 text-[#d9c5b2]" />
              Enter Exam Marks (ফলাফল এন্ট্রি ফরম)
            </h3>
          </div>

          <form onSubmit={handleResultSubmit} className="p-6 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-stone-700 mb-1">Select Student *</label>
                <select
                  required
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="w-full bg-stone-50 text-xs border border-stone-200 rounded-lg px-3 py-2 focus:outline-none"
                >
                  <option value="">-- Choose Student --</option>
                  {students.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.class} - Roll {s.roll})</option>
                  ))}
                </select>
              </div>

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
              <h4 className="text-xs font-serif font-bold text-stone-800 mb-3 uppercase tracking-wide">
                Subject-Wise Scores (বিষয়ভিত্তিক নম্বর সমূহ - প্রতি বিষয় সর্বোচ্চ ১০০ নম্বর)
              </h4>

              <div className="grid grid-cols-2 gap-4">
                {DEFAULT_SUBJECTS.map((sub) => (
                  <div key={sub} className="flex items-center justify-between gap-3 bg-stone-50 p-2.5 rounded-lg border border-stone-200/50">
                    <span className="text-xs font-bold text-stone-700">{sub}</span>
                    <div className="w-24">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        required
                        placeholder="Marks"
                        value={subjectMarks[sub]}
                        onChange={(e) => setSubjectMarks({ ...subjectMarks, [sub]: e.target.value })}
                        className="w-full bg-white text-xs font-bold border border-stone-300 rounded text-center py-1 font-mono focus:border-[#4a5d4e]"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-stone-700 mb-1">Remarks & Conduct (মন্তব্য ও চারিত্রিক গুনাবলী)</label>
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
                  setSelectedStudentId('');
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

      {/* REPORT CARD DISPLAY OVERLAY (MODAL) */}
      {viewingResult && (
        <div className="fixed inset-0 bg-[#2c332d]/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl border border-stone-300 shadow-2xl max-w-2xl w-full p-6 space-y-6 relative print:p-0 print:shadow-none print:border-none">
            
            {/* Close Button - Hidden on Print */}
            <button
              onClick={() => setViewingResult(null)}
              className="absolute right-4 top-4 text-stone-400 hover:text-[#2c332d] font-bold p-1 hover:bg-stone-100 rounded-full print:hidden cursor-pointer"
            >
              ✕ Close
            </button>

            {/* Print trigger - Hidden on Print */}
            <div className="flex justify-end gap-2 print:hidden mb-2">
              <button
                onClick={handlePrint}
                className="bg-[#4a5d4e] hover:bg-[#3d4d41] text-white text-xs font-bold px-4 py-2 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer border border-[#3d4d41]"
              >
                <Printer className="h-4 w-4 text-[#d9c5b2]" />
                Print/Save as PDF
              </button>
            </div>

            {/* Official Report Card Blueprint */}
            <div className="border-4 border-double border-[#4a5d4e] p-5 space-y-6 bg-[#fcfbf9]">
              
              {/* Institution Header */}
              <div className="text-center space-y-1 pb-4 border-b border-[#4a5d4e]/30">
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
                  <p><strong>Student Name (ছাত্রের নাম):</strong> <span className="font-bold text-stone-900">{viewingResult.studentName}</span></p>
                  <p><strong>Student ID:</strong> <span className="font-mono font-bold text-[#4a5d4e]">{viewingResult.studentId}</span></p>
                  <p><strong>Academic Year (শিক্ষাবর্ষ):</strong> <span className="font-mono font-bold">{viewingResult.year}</span></p>
                </div>
                <div className="space-y-1 text-right">
                  <p><strong>Assigned Class (শ্রেণী):</strong> <span className="font-bold">{viewingResult.class}</span></p>
                  <p><strong>Exam Cycle (পরীক্ষা):</strong> <span className="font-bold text-[#4a5d4e]">{viewingResult.examType}</span></p>
                  <p><strong>Date Compiled:</strong> <span className="font-mono">{viewingResult.date || new Date().toISOString().split('T')[0]}</span></p>
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
                  {viewingResult.marks.map((m) => {
                    const percentage = (m.marksObtained / m.maxMarks) * 100;
                    let grade = 'F';
                    if (percentage >= 80) grade = 'A+';
                    else if (percentage >= 70) grade = 'A';
                    else if (percentage >= 60) grade = 'A-';
                    else if (percentage >= 50) grade = 'B';
                    else if (percentage >= 40) grade = 'C';
                    else if (percentage >= 33) grade = 'D';

                    return (
                      <tr key={m.subjectName} className="hover:bg-stone-50">
                        <td className="py-2 px-3 border border-stone-300 font-semibold text-[#2c332d]">{m.subjectName}</td>
                        <td className="py-2 px-3 text-center border border-stone-300 font-mono font-bold text-stone-500">{m.maxMarks}</td>
                        <td className="py-2 px-3 text-center border border-stone-300 font-mono font-black text-stone-900">{m.marksObtained}</td>
                        <td className="py-2 px-3 text-center border border-stone-300 font-bold font-mono text-[#4a5d4e]">{grade}</td>
                      </tr>
                    );
                  })}
                  
                  {/* Totals Section */}
                  <tr className="bg-[#f5f2ed]/60 font-bold text-stone-900">
                    <td className="py-2.5 px-3 border border-stone-300 text-right">Aggregate Weighted Totals:</td>
                    <td className="py-2.5 px-3 text-center border border-stone-300 font-mono font-bold">
                      {viewingResult.marks.reduce((s, m) => s + m.maxMarks, 0)}
                    </td>
                    <td className="py-2.5 px-3 text-center border border-stone-300 font-mono font-black text-sm text-[#4a5d4e]">
                      {viewingResult.marks.reduce((s, m) => s + m.marksObtained, 0)}
                    </td>
                    <td className="py-2.5 px-3 text-center border border-stone-300 font-mono font-black text-sm uppercase">
                      {viewingResult.grade}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Performance Metrics */}
              <div className="grid grid-cols-3 gap-3 bg-stone-100/70 p-3 rounded border border-stone-200">
                <div className="text-center">
                  <span className="text-[9px] text-stone-500 uppercase font-bold block">Final GPA (জিপিএ)</span>
                  <span className="text-base font-black font-mono text-[#2c332d]">{viewingResult.gpa.toFixed(2)} / 5.00</span>
                </div>
                <div className="text-center">
                  <span className="text-[9px] text-stone-500 uppercase font-bold block">Pass/Fail Status (ফলাফল)</span>
                  <span className={`text-base font-bold uppercase ${viewingResult.status === 'Pass' ? 'text-emerald-700' : 'text-red-600'}`}>
                    {viewingResult.status === 'Pass' ? 'Pass (উত্তীর্ণ)' : 'Fail (অনুত্তীর্ণ)'}
                  </span>
                </div>
                <div className="text-center">
                  <span className="text-[9px] text-stone-500 uppercase font-bold block">Final Class Grade</span>
                  <span className="text-base font-black font-mono text-[#4a5d4e]">{viewingResult.grade}</span>
                </div>
              </div>

              {/* Remarks/Comments */}
              <div className="space-y-1">
                <span className="text-[10px] text-stone-400 font-bold uppercase block">Guardian Notes & Remarks (শিক্ষক মন্তব্য):</span>
                <p className="text-[11px] text-stone-700 italic bg-[#fcfbf9] border border-stone-200/55 p-3 rounded">
                  "{viewingResult.remarks}"
                </p>
              </div>

              {/* Signatures */}
              <div className="grid grid-cols-2 gap-4 pt-12 text-[10px] text-stone-500 font-bold">
                <div className="text-center">
                  <div className="border-t border-stone-400 max-w-[150px] mx-auto pt-1 font-serif">
                    Mawlana Samdani
                  </div>
                  <span>Principal (নাজিম সাহেব)</span>
                </div>
                <div className="text-center">
                  <div className="border-t border-stone-400 max-w-[150px] mx-auto pt-1 font-serif">
                    Class Muallim
                  </div>
                  <span>Class Teacher (শ্রেণী শিক্ষক)</span>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
