import React, { useEffect, useState } from 'react';
import { Bell, Megaphone, Plus, Send, Trash2 } from 'lucide-react';
import { dbGet, dbSet, onDbChange } from '../lib/localDb';
import AppAcademicSections from './AppAcademicSections';
import { Student, TeacherAccount, TeacherStaff } from '../types';

type Notice = {
  id: string;
  title: string;
  content: string;
  published_at: string;
  is_breaking: boolean;
  category: 'Admission' | 'Exam' | 'General';
};

const NOTIFICATIONS_KEY = 'samdani_notifications';

function readNotices(): Notice[] {
  const value = dbGet(NOTIFICATIONS_KEY);
  return Array.isArray(value) ? value.filter((item): item is Notice => Boolean(item && typeof item.content === 'string')) : [];
}

interface AppManagementPageProps {
  students: Student[];
  teacherStaff: TeacherStaff[];
  teacherAccounts: TeacherAccount[];
  readOnly?: boolean;
}

export default function AppManagementPage({ students, teacherStaff, teacherAccounts, readOnly = false }: AppManagementPageProps) {
  const [notices, setNotices] = useState<Notice[]>(readNotices);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isBreaking, setIsBreaking] = useState(false);
  const [category, setCategory] = useState<Notice['category']>('General');
  const [pushTitle, setPushTitle] = useState('');
  const [pushMessage, setPushMessage] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const refresh = () => setNotices(readNotices());
    return onDbChange(refresh);
  }, []);

  const saveNotices = (next: Notice[]) => {
    setNotices(next);
    dbSet(NOTIFICATIONS_KEY, next);
  };

  const addNotice = (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !content.trim()) return;
    const publishedAt = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    saveNotices([{
      id: `NOTICE-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: title.trim(),
      content: content.trim(),
      published_at: publishedAt,
      is_breaking: isBreaking,
      category,
    }, ...notices]);
    setTitle('');
    setContent('');
    setIsBreaking(false);
    setCategory('General');
    setMessage('Notice saved for the Android app.');
  };

  const sendPush = (event: React.FormEvent) => {
    event.preventDefault();
    if (!pushTitle.trim() || !pushMessage.trim()) return;
    const publishedAt = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    saveNotices([{
      id: `PUSH-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: pushTitle.trim(),
      content: pushMessage.trim(),
      published_at: publishedAt,
      is_breaking: true,
      category: 'General',
    }, ...notices]);
    setPushTitle('');
    setPushMessage('');
    setMessage('Global notification sent.');
  };

  const removeNotice = (id: string) => saveNotices(notices.filter((notice) => notice.id !== id));

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold text-[#2c332d]">App Management</h2>
        <p className="text-xs text-stone-500 mt-1">Manage notices and notifications shared with the companion Android app.</p>
      </div>
      {message && <p className="rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-4 py-3">{message}</p>}

      <div className="grid lg:grid-cols-2 gap-6">
        {!readOnly && <form onSubmit={addNotice} className="bg-white border border-stone-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2"><Megaphone className="h-4 w-4 text-[#4a5d4e]" /><h3 className="font-bold text-sm">Create Notice</h3></div>
          <div><label className="block text-xs font-bold text-stone-600 mb-1">Notice Title</label><input value={title} onChange={(e) => setTitle(e.target.value)} required className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm" /></div>
          <div><label className="block text-xs font-bold text-stone-600 mb-1">Notice Content</label><textarea value={content} onChange={(e) => setContent(e.target.value)} required className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm h-28" /></div>
          <label className="block text-xs font-bold text-stone-600">Category<select value={category} onChange={(e) => setCategory(e.target.value as Notice['category'])} className="mt-1 w-full border border-stone-200 rounded-lg px-3 py-2 text-sm font-normal"><option>General</option><option>Admission</option><option>Exam</option></select></label>
          <label className="flex items-center gap-2 text-xs text-stone-700"><input type="checkbox" checked={isBreaking} onChange={(e) => setIsBreaking(e.target.checked)} /> Breaking notice</label>
          <button className="bg-[#4a5d4e] text-white rounded-lg px-4 py-2 text-xs font-bold flex items-center gap-2"><Plus className="h-4 w-4" /> Save Notice</button>
        </form>}

        {!readOnly && <form onSubmit={sendPush} className="bg-white border border-stone-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2"><Bell className="h-4 w-4 text-[#4a5d4e]" /><h3 className="font-bold text-sm">Global Push Notification</h3></div>
          <div><label className="block text-xs font-bold text-stone-600 mb-1">Notification Title</label><input value={pushTitle} onChange={(e) => setPushTitle(e.target.value)} required className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm" /></div>
          <div><label className="block text-xs font-bold text-stone-600 mb-1">Notification Message</label><textarea value={pushMessage} onChange={(e) => setPushMessage(e.target.value)} required className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm h-28" /></div>
          <button className="bg-[#4a5d4e] text-white rounded-lg px-4 py-2 text-xs font-bold flex items-center gap-2"><Send className="h-4 w-4" /> Send Notification</button>
        </form>}
      </div>

      <section className="bg-white border border-stone-200 rounded-xl p-5">
        <h3 className="font-bold text-sm mb-4">Published Notices</h3>
        <div className="space-y-3">
          {notices.length === 0 && <p className="text-xs text-stone-500">No notices have been published.</p>}
          {notices.map((notice) => <article key={notice.id} className="border border-stone-200 rounded-lg p-3 flex items-start justify-between gap-4">
            <div><div className="flex items-center gap-2"><h4 className="text-sm font-bold">{notice.title}</h4>{notice.is_breaking && <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Breaking</span>}</div><p className="text-xs text-stone-600 mt-1 whitespace-pre-wrap">{notice.content}</p><time className="text-[10px] text-stone-400">{notice.published_at} · {notice.category}</time></div>
            {!readOnly && <button title="Delete notice" onClick={() => removeNotice(notice.id)} className="text-red-600 p-1"><Trash2 className="h-4 w-4" /></button>}
          </article>)}
        </div>
      </section>

      <AppAcademicSections students={students} teacherStaff={teacherStaff} teacherAccounts={teacherAccounts} readOnly={readOnly} />
    </div>
  );
}
