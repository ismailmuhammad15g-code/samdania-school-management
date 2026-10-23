import React, { useMemo, useState } from 'react';
import { CheckCircle2, ImagePlus, Search, Upload } from 'lucide-react';
import { Student } from '../types';
import { uploadStudentPhoto } from '../lib/imgbb';

interface MissingFilloutsPageProps {
  students: Student[];
  academicClasses: string[];
  onSaveStudent: (student: Student) => void;
  onOpenEditStudent: (student: Student) => void;
  readOnly?: boolean;
}

export default function MissingFilloutsPage({ students, academicClasses, onSaveStudent, onOpenEditStudent, readOnly = false }: MissingFilloutsPageProps) {
  const [classFilter, setClassFilter] = useState('All Classes');
  const [departmentFilter, setDepartmentFilter] = useState('All Departments');
  const [search, setSearch] = useState('');
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [contactDrafts, setContactDrafts] = useState<Record<string, string>>({});
  const [photoLinkDrafts, setPhotoLinkDrafts] = useState<Record<string, string>>({});

  const missingStudents = useMemo(() => students.filter((student) => {
    const department = (student as Student & { department?: string }).department || '';
    const matchesClass = classFilter === 'All Classes' || student.class === classFilter;
    const matchesDepartment = departmentFilter === 'All Departments' || department === departmentFilter;
    const matchesSearch = !search.trim() || `${student.name} ${student.roll}`.toLowerCase().includes(search.trim().toLowerCase());
    return matchesClass && matchesDepartment && matchesSearch && (!(student.photoUrl || student.photo_url) || !student.contact?.trim());
  }), [students, classFilter, departmentFilter, search]);

  const departments = Array.from(new Set(students.map((student) => (student as Student & { department?: string }).department).filter(Boolean))) as string[];

  const uploadPhoto = async (student: Student, file?: File) => {
    if (!file || readOnly) return;
    setUploadingId(student.id);
    try {
      const photoUrl = await uploadStudentPhoto(file);
      onSaveStudent({ ...student, photoUrl, photo_url: photoUrl });
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Photo upload failed.');
    } finally {
      setUploadingId(null);
    }
  };

  const saveContact = (student: Student) => {
    const contact = contactDrafts[student.id]?.trim();
    if (!contact || readOnly) return;
    onSaveStudent({ ...student, contact });
    setContactDrafts((current) => { const next = { ...current }; delete next[student.id]; return next; });
  };

  const savePhotoLink = (student: Student) => {
    const photoUrl = photoLinkDrafts[student.id]?.trim();
    if (!photoUrl || readOnly) return;
    onSaveStudent({ ...student, photoUrl, photo_url: photoUrl });
    setPhotoLinkDrafts((current) => { const next = { ...current }; delete next[student.id]; return next; });
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div><h2 className="text-xl font-bold text-[#2c332d]">Missing Fillouts</h2><p className="text-xs text-stone-500 mt-1">Students missing a profile photo or guardian contact information.</p></div>
      <div className="bg-white border border-stone-200 rounded-xl p-4 grid md:grid-cols-4 gap-3">
        <label className="text-xs font-bold text-stone-600">Class<select value={classFilter} onChange={(e) => setClassFilter(e.target.value)} className="mt-1 w-full border border-stone-200 rounded-lg px-3 py-2 font-normal"><option>All Classes</option>{academicClasses.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="text-xs font-bold text-stone-600">Department<select value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)} className="mt-1 w-full border border-stone-200 rounded-lg px-3 py-2 font-normal"><option>All Departments</option>{departments.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="text-xs font-bold text-stone-600 md:col-span-2">Search<input value={search} onChange={(e) => setSearch(e.target.value)} className="mt-1 w-full border border-stone-200 rounded-lg px-3 py-2 font-normal" /></label>
      </div>
      <div className="space-y-3">
        {missingStudents.length === 0 && <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-sm text-emerald-800 flex items-center gap-2"><CheckCircle2 className="h-5 w-5" /> No incomplete student records match these filters.</div>}
        {missingStudents.map((student) => <article key={student.id} className="bg-white border border-stone-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center gap-4">
          {(student.photoUrl || student.photo_url) ? <img src={student.photoUrl || student.photo_url} alt={student.name} className="h-16 w-16 rounded-lg object-cover border border-stone-200" /> : <div className="h-16 w-16 rounded-lg bg-stone-100 flex items-center justify-center"><ImagePlus className="h-5 w-5 text-stone-400" /></div>}
          <div className="flex-1"><h3 className="font-bold text-sm">{student.name}</h3><p className="text-xs text-stone-500">Class: {student.class} | Roll: {student.roll}</p><p className="text-xs text-red-600 mt-1">{!(student.photoUrl || student.photo_url) && 'Missing photo. '}{!student.contact?.trim() && 'Missing guardian contact.'}</p></div>
          {!readOnly && <div className="flex flex-wrap items-center gap-2">
            <label className="cursor-pointer inline-flex items-center gap-1.5 border border-stone-200 rounded-lg px-3 py-2 text-xs font-bold"><Upload className="h-3.5 w-3.5" /> {uploadingId === student.id ? 'Uploading...' : 'Upload Photo'}<input type="file" accept="image/*" className="hidden" disabled={uploadingId === student.id} onChange={(e) => uploadPhoto(student, e.target.files?.[0])} /></label>
            <input aria-label="Student image link" type="url" value={photoLinkDrafts[student.id] || ''} onChange={(e) => setPhotoLinkDrafts({ ...photoLinkDrafts, [student.id]: e.target.value })} className="border border-stone-200 rounded-lg px-3 py-2 text-xs" />
            <button onClick={() => savePhotoLink(student)} className="border border-stone-200 rounded-lg px-3 py-2 text-xs font-bold">Save Image Link</button>
            {!student.contact?.trim() && <><input value={contactDrafts[student.id] || ''} onChange={(e) => setContactDrafts({ ...contactDrafts, [student.id]: e.target.value })} className="border border-stone-200 rounded-lg px-3 py-2 text-xs" /><button onClick={() => saveContact(student)} className="bg-[#4a5d4e] text-white rounded-lg px-3 py-2 text-xs font-bold">Save Contact</button></>}
            <button onClick={() => onOpenEditStudent(student)} className="text-[#4a5d4e] border border-[#4a5d4e] rounded-lg px-3 py-2 text-xs font-bold">Edit</button>
          </div>}
        </article>)}
      </div>
    </div>
  );
}
