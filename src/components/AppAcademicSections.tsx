import React, { useMemo, useState } from 'react';
import { BookOpen, CalendarCheck, ClipboardPlus, Clock3, GraduationCap, ListPlus } from 'lucide-react';
import { dbGet, dbSet } from '../lib/localDb';
import { Student, StudentAttendanceRecord, StudentResult, TeacherAccount, TeacherRoutine, TeacherStaff } from '../types';

interface Props {
  students: Student[];
  teacherStaff: TeacherStaff[];
  teacherAccounts: TeacherAccount[];
  readOnly?: boolean;
}

type AcademicItem = { id: string; className: string; bookName: string; syllabus: string };
type HomeworkItem = { id: string; className: string; teacherId: string; teacherName: string; teacherPhotoUrl?: string; subject: string; description: string; dueAt: string };

const readArray = <T,>(key: string): T[] => {
  const value = dbGet(key);
  return Array.isArray(value) ? value as T[] : [];
};

export default function AppAcademicSections({ students, teacherStaff, teacherAccounts, readOnly = false }: Props) {
  const [section, setSection] = useState<'attendance' | 'results' | 'routine' | 'academic' | 'homework'>('attendance');
  const [message, setMessage] = useState('');
  const [attendance, setAttendance] = useState({ className: '', studentId: '', date: new Date().toISOString().slice(0, 10), present: true });
  const [result, setResult] = useState({ studentId: '', examType: 'First Term' as StudentResult['examType'], year: String(new Date().getFullYear()), subjectName: '', marks: '', maxMarks: '100' });
  const [routine, setRoutine] = useState({ className: 'Class 1', day: 'Sunday', time: '', subject: '', teacherId: '' });
  const [academic, setAcademic] = useState({ className: 'Class 1', bookName: '', syllabus: '' });
  const [homework, setHomework] = useState({ className: '', teacherId: '', subject: '', description: '', dueAt: '' });
  const [academicItems, setAcademicItems] = useState(() => readArray<AcademicItem>('samdani_academic_info'));
  const [homeworkItems, setHomeworkItems] = useState(() => readArray<HomeworkItem>('samdani_homework'));

  const classes = Array.from(new Set(students.map((student) => student.class).filter(Boolean)));
  const selectedClassStudents = useMemo(() => students.filter((student) => !attendance.className || student.class === attendance.className), [students, attendance.className]);
  const teachers = [
    ...teacherStaff.map((teacher) => {
      const account = teacherAccounts.find((item) => item.email === teacher.email || item.fullName === teacher.name);
      return { id: teacher.id, name: teacher.name, photoUrl: account?.photoUrl };
    }),
    ...teacherAccounts.map((teacher) => ({ id: teacher.id, name: teacher.fullName, photoUrl: teacher.photoUrl })),
  ];

  const saveAttendance = (event: React.FormEvent) => {
    event.preventDefault();
    const student = students.find((item) => item.id === attendance.studentId);
    if (!student || !attendance.date || readOnly) return;
    const current = readArray<StudentAttendanceRecord>('samdani_student_attendance_records');
    const record: StudentAttendanceRecord = {
      id: `ATT-${attendance.date}-${student.id}-${Date.now()}`,
      teacherId: 'admin', teacherName: 'Admin', className: student.class, date: attendance.date, createdAt: new Date().toISOString(),
      statuses: [{ id: `STATUS-${Date.now()}`, studentId: student.id, studentName: student.name, className: student.class, present: attendance.present, late: false, dairy: false, uniform: false, recordedAt: new Date().toISOString(), teacherId: 'admin', teacherName: 'Admin', date: attendance.date }],
    };
    dbSet('samdani_student_attendance_records', [...current, record]);
    setMessage('Attendance saved.');
  };

  const saveResult = (event: React.FormEvent) => {
    event.preventDefault();
    const student = students.find((item) => item.id === result.studentId);
    const marks = Number(result.marks);
    const maxMarks = Number(result.maxMarks);
    if (!student || !result.subjectName.trim() || !result.marks.trim() || !Number.isFinite(marks) || !Number.isFinite(maxMarks) || maxMarks <= 0 || readOnly) return;
    const percentage = Math.max(0, Math.min(100, (marks / maxMarks) * 100));
    const item: StudentResult = { id: `RESULT-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, studentId: student.id, studentName: student.name, class: student.class, examType: result.examType, year: Number(result.year) || new Date().getFullYear(), marks: [{ subjectName: result.subjectName.trim(), marksObtained: marks, maxMarks }], grade: percentage >= 80 ? 'A+' : percentage >= 70 ? 'A' : percentage >= 60 ? 'B' : percentage >= 33 ? 'C' : 'F', gpa: Number((percentage / 20).toFixed(2)), status: percentage >= 33 ? 'Pass' : 'Fail', remarks: '', recordedBy: 'Admin', date: new Date().toISOString() };
    dbSet('samdani_student_results', [...readArray<StudentResult>('samdani_student_results'), item]);
    setResult({ ...result, subjectName: '', marks: '' });
    setMessage('Result saved.');
  };

  const saveRoutine = (event: React.FormEvent) => {
    event.preventDefault();
    const teacher = teachers.find((item) => item.id === routine.teacherId);
    if (!routine.time || !routine.subject.trim() || !teacher || readOnly) return;
    const item = { id: `ROUTINE-${Date.now()}`, teacherId: teacher.id, teacherName: teacher.name, teacherPhotoUrl: teacher.photoUrl, time: routine.time, day: routine.day, class: routine.className, subject: routine.subject.trim(), restTime: '' };
    dbSet('samdani_teacher_routines', [...readArray<TeacherRoutine & { day?: string; teacherName?: string; teacherPhotoUrl?: string }>('samdani_teacher_routines'), item]);
    setRoutine({ ...routine, time: '', subject: '' });
    setMessage('Routine period saved.');
  };

  const saveAcademic = (event: React.FormEvent) => {
    event.preventDefault();
    if (!academic.bookName.trim() && !academic.syllabus.trim()) return;
    const item = { id: `ACADEMIC-${academic.className}`, ...academic };
    const next = [...academicItems.filter((entry) => entry.className !== academic.className), item];
    setAcademicItems(next);
    dbSet('samdani_academic_info', next);
    setMessage('Academic information saved.');
  };

  const saveHomework = (event: React.FormEvent) => {
    event.preventDefault();
    const teacher = teachers.find((item) => item.id === homework.teacherId);
    if (!homework.className || !teacher || !homework.subject.trim() || !homework.description.trim() || !homework.dueAt || readOnly) return;
    const item = { id: `HOMEWORK-${Date.now()}`, ...homework, teacherName: teacher.name, teacherPhotoUrl: teacher.photoUrl };
    const next = [item, ...homeworkItems];
    setHomeworkItems(next);
    dbSet('samdani_homework', next);
    setHomework({ ...homework, subject: '', description: '', dueAt: '' });
    setMessage('Homework posted.');
  };

  const tabs = [
    ['attendance', 'Attendance', CalendarCheck], ['results', 'Results', GraduationCap], ['routine', 'Class Routine', Clock3], ['academic', 'Academic', BookOpen], ['homework', 'Homework', ClipboardPlus],
  ] as const;

  return <section className="bg-white border border-stone-200 rounded-xl p-5 space-y-5">
    <div><h3 className="font-bold text-sm">Academic &amp; Student Management</h3><p className="text-xs text-stone-500 mt-1">All records are saved to the companion app data keys.</p></div>
    <div className="flex flex-wrap gap-2">{tabs.map(([id, label, Icon]) => <button key={id} onClick={() => setSection(id)} className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 ${section === id ? 'bg-[#4a5d4e] text-white' : 'bg-stone-100 text-stone-600'}`}><Icon className="h-3.5 w-3.5" />{label}</button>)}</div>
    {message && <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">{message}</p>}

    {section === 'attendance' && <form onSubmit={saveAttendance} className="grid md:grid-cols-4 gap-3 items-end"><label className="text-xs font-bold">Class<select value={attendance.className} onChange={(e) => setAttendance({ ...attendance, className: e.target.value, studentId: '' })} className="mt-1 w-full border rounded-lg px-3 py-2 font-normal"><option value="">Select class</option>{classes.map((item) => <option key={item}>{item}</option>)}</select></label><label className="text-xs font-bold">Student<select value={attendance.studentId} onChange={(e) => setAttendance({ ...attendance, studentId: e.target.value })} className="mt-1 w-full border rounded-lg px-3 py-2 font-normal"><option value="">Select student</option>{selectedClassStudents.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.roll}</option>)}</select></label><label className="text-xs font-bold">Date<input type="date" value={attendance.date} onChange={(e) => setAttendance({ ...attendance, date: e.target.value })} className="mt-1 w-full border rounded-lg px-3 py-2 font-normal" /></label><button disabled={readOnly} className="bg-[#4a5d4e] text-white rounded-lg px-3 py-2 text-xs font-bold">{attendance.present ? 'Mark Present' : 'Mark Absent'}</button><label className="text-xs flex items-center gap-2"><input type="checkbox" checked={attendance.present} onChange={(e) => setAttendance({ ...attendance, present: e.target.checked })} /> Present</label></form>}

    {section === 'results' && <form onSubmit={saveResult} className="grid md:grid-cols-3 gap-3 items-end"><label className="text-xs font-bold">Student<select value={result.studentId} onChange={(e) => setResult({ ...result, studentId: e.target.value })} className="mt-1 w-full border rounded-lg px-3 py-2 font-normal"><option value="">Select student</option>{students.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.class} · {item.roll}</option>)}</select></label><label className="text-xs font-bold">Exam Type<select value={result.examType} onChange={(e) => setResult({ ...result, examType: e.target.value as StudentResult['examType'] })} className="mt-1 w-full border rounded-lg px-3 py-2 font-normal"><option>First Term</option><option>Second Term</option><option>Annual</option></select></label><label className="text-xs font-bold">Year<input type="number" value={result.year} onChange={(e) => setResult({ ...result, year: e.target.value })} className="mt-1 w-full border rounded-lg px-3 py-2 font-normal" /></label><label className="text-xs font-bold">Subject<input value={result.subjectName} onChange={(e) => setResult({ ...result, subjectName: e.target.value })} className="mt-1 w-full border rounded-lg px-3 py-2 font-normal" /></label><label className="text-xs font-bold">Marks<input type="number" value={result.marks} onChange={(e) => setResult({ ...result, marks: e.target.value })} className="mt-1 w-full border rounded-lg px-3 py-2 font-normal" /></label><label className="text-xs font-bold">Maximum Marks<input type="number" value={result.maxMarks} onChange={(e) => setResult({ ...result, maxMarks: e.target.value })} className="mt-1 w-full border rounded-lg px-3 py-2 font-normal" /></label><button disabled={readOnly} className="bg-[#4a5d4e] text-white rounded-lg px-3 py-2 text-xs font-bold">Save Result</button></form>}

    {section === 'routine' && <form onSubmit={saveRoutine} className="grid md:grid-cols-5 gap-3 items-end"><label className="text-xs font-bold">Class<select value={routine.className} onChange={(e) => setRoutine({ ...routine, className: e.target.value })} className="mt-1 w-full border rounded-lg px-3 py-2 font-normal">{['Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5'].map((item) => <option key={item}>{item}</option>)}</select></label><label className="text-xs font-bold">Day<select value={routine.day} onChange={(e) => setRoutine({ ...routine, day: e.target.value })} className="mt-1 w-full border rounded-lg px-3 py-2 font-normal">{['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((item) => <option key={item}>{item}</option>)}</select></label><label className="text-xs font-bold">Time<input type="time" value={routine.time} onChange={(e) => setRoutine({ ...routine, time: e.target.value })} className="mt-1 w-full border rounded-lg px-3 py-2 font-normal" /></label><label className="text-xs font-bold">Subject<input value={routine.subject} onChange={(e) => setRoutine({ ...routine, subject: e.target.value })} className="mt-1 w-full border rounded-lg px-3 py-2 font-normal" /></label><label className="text-xs font-bold">Teacher<select value={routine.teacherId} onChange={(e) => setRoutine({ ...routine, teacherId: e.target.value })} className="mt-1 w-full border rounded-lg px-3 py-2 font-normal"><option value="">Select teacher</option>{teachers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><button disabled={readOnly} className="bg-[#4a5d4e] text-white rounded-lg px-3 py-2 text-xs font-bold">Add Period</button></form>}

    {section === 'academic' && <form onSubmit={saveAcademic} className="grid md:grid-cols-3 gap-3 items-end"><label className="text-xs font-bold">Class<select value={academic.className} onChange={(e) => setAcademic({ ...academic, className: e.target.value })} className="mt-1 w-full border rounded-lg px-3 py-2 font-normal">{['Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5'].map((item) => <option key={item}>{item}</option>)}</select></label><label className="text-xs font-bold">Book Name<input value={academic.bookName} onChange={(e) => setAcademic({ ...academic, bookName: e.target.value })} className="mt-1 w-full border rounded-lg px-3 py-2 font-normal" /></label><label className="text-xs font-bold">Syllabus<textarea value={academic.syllabus} onChange={(e) => setAcademic({ ...academic, syllabus: e.target.value })} className="mt-1 w-full border rounded-lg px-3 py-2 font-normal h-10" /></label><button disabled={readOnly} className="bg-[#4a5d4e] text-white rounded-lg px-3 py-2 text-xs font-bold">Save Academic Info</button></form>}

    {section === 'homework' && <form onSubmit={saveHomework} className="grid md:grid-cols-3 gap-3 items-end"><label className="text-xs font-bold">Class<select value={homework.className} onChange={(e) => setHomework({ ...homework, className: e.target.value })} className="mt-1 w-full border rounded-lg px-3 py-2 font-normal"><option value="">Select class</option>{classes.map((item) => <option key={item}>{item}</option>)}</select></label><label className="text-xs font-bold">Teacher<select value={homework.teacherId} onChange={(e) => setHomework({ ...homework, teacherId: e.target.value })} className="mt-1 w-full border rounded-lg px-3 py-2 font-normal"><option value="">Select teacher</option>{teachers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="text-xs font-bold">Subject<input value={homework.subject} onChange={(e) => setHomework({ ...homework, subject: e.target.value })} className="mt-1 w-full border rounded-lg px-3 py-2 font-normal" /></label><label className="text-xs font-bold md:col-span-2">Description<textarea value={homework.description} onChange={(e) => setHomework({ ...homework, description: e.target.value })} className="mt-1 w-full border rounded-lg px-3 py-2 font-normal h-16" /></label><label className="text-xs font-bold">Due Date/Time<input type="datetime-local" value={homework.dueAt} onChange={(e) => setHomework({ ...homework, dueAt: e.target.value })} className="mt-1 w-full border rounded-lg px-3 py-2 font-normal" /></label><button disabled={readOnly} className="bg-[#4a5d4e] text-white rounded-lg px-3 py-2 text-xs font-bold">Post Homework</button></form>}

    {section === 'homework' && homeworkItems.length > 0 && <div className="space-y-2">{homeworkItems.slice(0, 10).map((item) => <div key={item.id} className="border rounded-lg p-3 text-xs"><strong>{item.subject}</strong> · {item.className} · {item.teacherName}<div className="text-stone-500 mt-1">Due {item.dueAt}: {item.description}</div></div>)}</div>}
  </section>;
}
