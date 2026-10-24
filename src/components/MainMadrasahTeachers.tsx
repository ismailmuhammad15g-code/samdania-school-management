import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ImagePlus, Pencil, Plus, Trash2, X } from 'lucide-react';
import { getAuthClient } from '../lib/auth';
import type { TeacherAccount } from '../types';

type TeacherProfile = {
  id: string;
  name_en: string;
  name_bn: string;
  role_en: string;
  role_bn: string;
  qualification_en: string;
  qualification_bn: string;
  subjects_en: string;
  subjects_bn: string;
  bio_en: string;
  bio_bn: string;
  photo_url: string;
  photo_name: string;
  sort_order: number;
  is_published: boolean;
};

type TeacherFields = Omit<TeacherProfile, 'id' | 'photo_url' | 'photo_name'>;

const EMPTY_TEACHER: TeacherFields = {
  name_en: '',
  name_bn: '',
  role_en: '',
  role_bn: '',
  qualification_en: '',
  qualification_bn: '',
  subjects_en: '',
  subjects_bn: '',
  bio_en: '',
  bio_bn: '',
  sort_order: 0,
  is_published: true,
};

type MainMadrasahTeachersProps = {
  apiUrl: string;
  readOnly: boolean;
  teacherAccounts: TeacherAccount[];
};

export default function MainMadrasahTeachers({ apiUrl, readOnly, teacherAccounts }: MainMadrasahTeachersProps) {
  const [teachers, setTeachers] = useState<TeacherProfile[]>([]);
  const [fields, setFields] = useState<TeacherFields>(EMPTY_TEACHER);
  const [photo, setPhoto] = useState<File | null>(null);
  const [linkedPhotoUrl, setLinkedPhotoUrl] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [editingId, setEditingId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [message, setMessage] = useState('');

  const request = useCallback(async (init?: RequestInit) => {
    const base = apiUrl.trim().replace(/\/+$/, '');
    if (!base) throw new Error('The official website API address is not configured.');
    const client = getAuthClient();
    const { data, error: sessionError } = await client.auth.getSession();
    if (sessionError) throw sessionError;
    if (!data.session?.access_token) {
      throw new Error('The software login does not include the Supabase Auth session required to load teacher profiles.');
    }
    const headers = new Headers(init?.headers);
    headers.set('Authorization', `Bearer ${data.session.access_token}`);
    const response = await fetch(`${base}/api/admin/teachers`, {
      ...init,
      headers,
      cache: 'no-store',
    });
    const result = await response.json() as { message?: string; teachers?: TeacherProfile[]; teacher?: TeacherProfile };
    if (!response.ok) throw new Error(result.message || `Teacher request failed (${response.status}).`);
    return result;
  }, [apiUrl]);

  const refresh = async () => {
    const result = await request();
    setTeachers(result.teachers ?? []);
  };

  useEffect(() => {
    let active = true;
    void request()
      .then((result) => {
        if (active) setTeachers(result.teachers ?? []);
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(true);
          setMessage(cause instanceof Error ? cause.message : 'Teacher profiles could not be loaded.');
        }
      });
    return () => { active = false; };
  }, [request]);

  const resetEditor = () => {
    setEditingId('');
    setFields(EMPTY_TEACHER);
    setPhoto(null);
    setLinkedPhotoUrl('');
    setSelectedAccountId('');
  };

  const selectTeacherAccount = (accountId: string) => {
    setSelectedAccountId(accountId);
    const account = teacherAccounts.find((item) => item.id === accountId);
    if (!account) {
      setFields(EMPTY_TEACHER);
      setLinkedPhotoUrl('');
      return;
    }
    setFields((current) => ({
      ...current,
      name_en: account.fullName,
      role_en: account.designation || account.role || 'Teacher',
      bio_en: account.bio || '',
    }));
    setLinkedPhotoUrl(account.photoUrl || '');
    setPhoto(null);
  };

  const editTeacher = (teacher: TeacherProfile) => {
    const { id, photo_url: _photoUrl, photo_name: _photoName, ...teacherFields } = teacher;
    setEditingId(id);
    setFields(teacherFields);
    setPhoto(null);
    setLinkedPhotoUrl('');
    setSelectedAccountId('');
    setMessage('');
    setError(false);
  };

  const saveTeacher = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(false);
    setMessage('');
    try {
      const form = new FormData();
      Object.entries(fields).forEach(([key, value]) => form.set(key, String(value)));
      if (editingId) form.set('id', editingId);
      if (photo) form.set('photo', photo);
      else if (!editingId && linkedPhotoUrl) form.set('photo_url', linkedPhotoUrl);
      const result = await request({
        method: editingId ? 'PUT' : 'POST',
        body: form,
      });
      if (result.teacher) {
        setTeachers((current) => [result.teacher!, ...current.filter((teacher) => teacher.id !== result.teacher!.id)]);
      } else {
        await refresh();
      }
      resetEditor();
      setMessage(editingId ? 'Teacher profile updated.' : 'Teacher profile created.');
    } catch (cause) {
      setError(true);
      setMessage(cause instanceof Error ? cause.message : 'Teacher profile could not be saved.');
    } finally {
      setLoading(false);
    }
  };

  const deleteTeacher = async (teacher: TeacherProfile) => {
    if (!window.confirm(`Delete ${teacher.name_en}'s teacher profile?`)) return;
    setLoading(true);
    setError(false);
    setMessage('');
    try {
      await request({
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: teacher.id }),
      });
      setTeachers((current) => current.filter((item) => item.id !== teacher.id));
      if (editingId === teacher.id) resetEditor();
      setMessage('Teacher profile deleted.');
    } catch (cause) {
      setError(true);
      setMessage(cause instanceof Error ? cause.message : 'Teacher profile could not be deleted.');
    } finally {
      setLoading(false);
    }
  };

  const field = (key: Exclude<keyof TeacherFields, 'is_published'>, label: string, options: { required?: boolean; multiline?: boolean; maxLength: number }) => (
    <label key={key} className="grid gap-1.5 text-xs font-semibold text-stone-700">
      {label}
      {options.multiline ? (
        <textarea
          className="min-h-24 rounded-lg border border-stone-300 px-3 py-2.5 text-sm font-normal outline-none focus:border-emerald-700"
          value={String(fields[key])}
          onChange={(event) => setFields((current) => ({ ...current, [key]: event.target.value }))}
          maxLength={options.maxLength}
          required={options.required}
          disabled={readOnly || loading}
        />
      ) : (
        <input
          className="rounded-lg border border-stone-300 px-3 py-2.5 text-sm font-normal outline-none focus:border-emerald-700"
          type={key === 'sort_order' ? 'number' : 'text'}
          value={String(fields[key])}
          onChange={(event) => setFields((current) => ({
            ...current,
            [key]: key === 'sort_order' ? Number(event.target.value) : event.target.value,
          }))}
          maxLength={key === 'sort_order' ? undefined : options.maxLength}
          min={key === 'sort_order' ? 0 : undefined}
          max={key === 'sort_order' ? 10000 : undefined}
          required={options.required}
          disabled={readOnly || loading}
        />
      )}
    </label>
  );

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-7">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-violet-50 p-3 text-violet-800"><ImagePlus className="h-5 w-5" /></div>
        <div>
          <h3 className="font-bold text-stone-900">Teacher profiles — “আমাদের সম্পর্কে”</h3>
          <p className="mt-1 text-xs text-stone-500">Add verified teacher details in English and Bengali. Published profiles appear on the public About page.</p>
        </div>
      </div>

      {message && (
        <p className={`mt-4 rounded-lg px-3 py-2 text-sm ${error ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-800'}`} role="status">
          {message}
        </p>
      )}

      <form className="mt-5 grid gap-4 md:grid-cols-2" onSubmit={saveTeacher}>
        {!editingId && (
          <label className="grid gap-1.5 text-xs font-semibold text-stone-700 md:col-span-2">
            Choose an existing registered teacher
            <select
              value={selectedAccountId}
              onChange={(event) => selectTeacherAccount(event.target.value)}
              disabled={readOnly || loading}
              className="rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-emerald-700"
            >
              <option value="">Select a teacher to fill in saved details</option>
              {teacherAccounts
                .filter((account) => account.registered && account.status === 'verified' && !/\b(staff|driver|cleaner|guard|security|accountant|cook|caretaker|peon|janitor|maintenance|office)\b/i.test(`${account.role ?? ''} ${account.designation}`))
                .map((account) => (
                  <option key={account.id} value={account.id}>{account.fullName} · {account.designation || account.role || 'Teacher'}</option>
                ))}
            </select>
            <span className="font-normal text-stone-500">The saved name, position, biography, and photo are filled automatically. Complete the Bengali and academic details as needed.</span>
          </label>
        )}
        {field('name_en', 'Teacher name — English', { required: true, maxLength: 120 })}
        {field('name_bn', 'শিক্ষকের নাম — বাংলা', { required: true, maxLength: 120 })}
        {field('role_en', 'Position / title — English', { required: true, maxLength: 120 })}
        {field('role_bn', 'পদবি — বাংলা', { required: true, maxLength: 120 })}
        {field('qualification_en', 'Education / qualifications — English', { maxLength: 500, multiline: true })}
        {field('qualification_bn', 'শিক্ষাগত যোগ্যতা — বাংলা', { maxLength: 500, multiline: true })}
        {field('subjects_en', 'Subjects taught — English', { maxLength: 300 })}
        {field('subjects_bn', 'পঠিত বিষয় — বাংলা', { maxLength: 300 })}
        {field('bio_en', 'Biography — English', { maxLength: 4000, multiline: true })}
        {field('bio_bn', 'জীবনবৃত্তান্ত — বাংলা', { maxLength: 4000, multiline: true })}
        {field('sort_order', 'Display order', { maxLength: 5 })}
        <label className="grid gap-1.5 text-xs font-semibold text-stone-700">
          Teacher profile photo {editingId ? '(optional when editing)' : ''}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            required={!editingId && !linkedPhotoUrl}
            onChange={(event) => {
              setPhoto(event.target.files?.[0] ?? null);
              if (event.target.files?.[0]) setLinkedPhotoUrl('');
            }}
            disabled={readOnly || loading}
            className="block w-full text-sm text-stone-600 file:mr-3 file:rounded-lg file:border-0 file:bg-stone-100 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-stone-700"
          />
          <span className="font-normal text-stone-500">
            {linkedPhotoUrl ? 'Using the selected teacher’s saved profile photo. Choose another file to replace it.' : 'PNG, JPEG, or WebP, up to 8 MB.'}
          </span>
          {linkedPhotoUrl && !photo && <img src={linkedPhotoUrl} alt="Selected teacher profile preview" className="h-24 w-24 rounded-lg border border-stone-200 bg-stone-50 object-contain" />}
        </label>
        <label className="flex items-center gap-2 text-sm text-stone-700">
          <input
            type="checkbox"
            checked={fields.is_published}
            onChange={(event) => setFields((current) => ({ ...current, is_published: event.target.checked }))}
            disabled={readOnly || loading}
          />
          Publish profile publicly
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={loading || readOnly}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-emerald-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            {editingId ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {editingId ? 'Update teacher' : 'Add teacher'}
          </button>
          {editingId && (
            <button type="button" onClick={resetEditor} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-stone-300 px-4 py-2 text-sm">
              <X className="h-4 w-4" /> Cancel
            </button>
          )}
        </div>
      </form>

      <div className="mt-8 flex items-center justify-between gap-3">
        <h4 className="font-bold text-stone-900">Teacher directory ({teachers.length})</h4>
        <button type="button" disabled={loading} onClick={() => void refresh().catch((cause: unknown) => {
          setError(true);
          setMessage(cause instanceof Error ? cause.message : 'Teacher profiles could not be loaded.');
        })} className="rounded-lg border border-stone-300 px-3 py-2 text-xs font-semibold disabled:opacity-50">
          Refresh
        </button>
      </div>
      {teachers.length === 0 ? (
        <p className="mt-4 rounded-lg bg-stone-50 p-4 text-sm text-stone-500">No teacher profiles have been added yet.</p>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {teachers.map((teacher) => (
            <article key={teacher.id} className="flex gap-4 rounded-xl border border-stone-200 p-4">
              <img src={teacher.photo_url} alt="" className="h-20 w-20 rounded-lg bg-stone-100 object-cover" />
              <div className="min-w-0 flex-1">
                <h5 className="font-bold text-stone-900">{teacher.name_en} · {teacher.name_bn}</h5>
                <p className="mt-1 text-xs text-stone-600">{teacher.role_en} · {teacher.role_bn}</p>
                <p className="mt-1 text-xs text-stone-500">{teacher.is_published ? 'Published' : 'Draft'} · Order {teacher.sort_order}</p>
                <div className="mt-3 flex gap-2">
                  <button type="button" disabled={loading || readOnly} onClick={() => editTeacher(teacher)} className="inline-flex items-center gap-1 rounded-lg border border-stone-300 px-2.5 py-1.5 text-xs disabled:opacity-50">
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </button>
                  <button type="button" disabled={loading || readOnly} onClick={() => void deleteTeacher(teacher)} className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs text-red-700 disabled:opacity-50">
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
