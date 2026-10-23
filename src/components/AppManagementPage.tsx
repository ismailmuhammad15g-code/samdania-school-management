import React, { useEffect, useState } from 'react';
import { Bell, Megaphone, Plus, Send, Trash2 } from 'lucide-react';
import { dbGet, dbSet, onDbChange } from '../lib/localDb';
import { Student } from '../types';
import { getTeacherNotices, saveTeacherNotices, type TeacherNotice } from '../lib/teacherNotices';
import { TeacherAccount } from '../types';

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
  readOnly?: boolean;
  teacherAccounts: TeacherAccount[];
  adminName: string;
  principalName: string;
  onUpdatePrincipalName: (name: string) => void;
}

export default function AppManagementPage({ readOnly = false, teacherAccounts, adminName, principalName, onUpdatePrincipalName }: AppManagementPageProps) {
  const [notices, setNotices] = useState<Notice[]>(readNotices);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isBreaking, setIsBreaking] = useState(false);
  const [category, setCategory] = useState<Notice['category']>('General');
  const [pushTitle, setPushTitle] = useState('');
  const [pushMessage, setPushMessage] = useState('');
  const [message, setMessage] = useState('');
  const [teacherNoticeTitle, setTeacherNoticeTitle] = useState('');
  const [teacherNoticeMessage, setTeacherNoticeMessage] = useState('');
  const [teacherNoticeTarget, setTeacherNoticeTarget] = useState<'all' | 'selected'>('all');
  const [teacherNoticeRecipients, setTeacherNoticeRecipients] = useState<string[]>([]);
  const [teacherNotices, setTeacherNotices] = useState<TeacherNotice[]>(getTeacherNotices);

  useEffect(() => {
    const refresh = () => setNotices(readNotices());
    return onDbChange(refresh);
  }, []);

  useEffect(() => {
    const refresh = () => setTeacherNotices(getTeacherNotices());
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

  const sendTeacherNotice = (event: React.FormEvent) => {
    event.preventDefault();
    if (!teacherNoticeTitle.trim() || !teacherNoticeMessage.trim()) return;
    if (teacherNoticeTarget === 'selected' && teacherNoticeRecipients.length === 0) {
      setMessage('Select at least one teacher for a targeted notice.');
      return;
    }
    const notice: TeacherNotice = {
      id: `TNOTICE-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: teacherNoticeTitle.trim(),
      message: teacherNoticeMessage.trim(),
      createdAt: new Date().toISOString(),
      target: teacherNoticeTarget,
      recipientIds: teacherNoticeTarget === 'all' ? [] : teacherNoticeRecipients,
      createdBy: adminName,
    };
    const next = [notice, ...teacherNotices];
    saveTeacherNotices(next);
    setTeacherNotices(next);
    setTeacherNoticeTitle('');
    setTeacherNoticeMessage('');
    setTeacherNoticeTarget('all');
    setTeacherNoticeRecipients([]);
    setMessage('Teacher notice sent successfully.');
  };

  const removeTeacherNotice = (id: string) => {
    const next = teacherNotices.filter((notice) => notice.id !== id);
    saveTeacherNotices(next);
    setTeacherNotices(next);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold text-[#2c332d]">App Management</h2>
        <p className="text-xs text-stone-500 mt-1">Manage notices and notifications shared with the companion Android app.</p>
      </div>
      {message && <p className="rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-4 py-3">{message}</p>}

      <div className="grid lg:grid-cols-2 gap-6">
        {!readOnly && <section className="bg-white border border-stone-200 rounded-xl p-5 space-y-3 lg:col-span-2">
          <div>
            <h3 className="font-bold text-sm">Result Report Principal</h3>
            <p className="text-xs text-stone-500 mt-1">This name appears only in the Principal signature on result reports. It is stored separately from fee/admin recipient names.</p>
          </div>
          <label className="block text-xs font-bold text-stone-600">
            Principal name
            <input
              value={principalName}
              onChange={(event) => onUpdatePrincipalName(event.target.value)}
              placeholder="Enter the principal's name"
              className="mt-1 w-full max-w-md border border-stone-200 rounded-lg px-3 py-2 text-sm font-normal"
              maxLength={100}
            />
          </label>
        </section>}
        {!readOnly && <form onSubmit={sendTeacherNotice} className="bg-white border border-stone-200 rounded-xl p-5 space-y-4 lg:col-span-2">
          <div className="flex items-center gap-2"><Megaphone className="h-4 w-4 text-[#4a5d4e]" /><h3 className="font-bold text-sm">Teacher Noticeboard</h3></div>
          <div className="grid md:grid-cols-2 gap-3">
            <input value={teacherNoticeTitle} onChange={(e) => setTeacherNoticeTitle(e.target.value)} required placeholder="Notice title" className="border border-stone-200 rounded-lg px-3 py-2 text-sm" />
            <select value={teacherNoticeTarget} onChange={(e) => { setTeacherNoticeTarget(e.target.value as 'all' | 'selected'); setTeacherNoticeRecipients([]); }} className="border border-stone-200 rounded-lg px-3 py-2 text-sm">
              <option value="all">Send to all teachers</option>
              <option value="selected">Send to selected teachers</option>
            </select>
          </div>
          {teacherNoticeTarget === 'selected' && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {teacherAccounts.filter((account) => account.registered).map((account) => (
                <label key={account.id} className="flex items-center gap-2 rounded-lg border border-stone-200 px-3 py-2 text-xs">
                  <input type="checkbox" checked={teacherNoticeRecipients.includes(account.id)} onChange={(e) => setTeacherNoticeRecipients((prev) => e.target.checked ? [...prev, account.id] : prev.filter((id) => id !== account.id))} />
                  {account.fullName}
                </label>
              ))}
            </div>
          )}
          <textarea value={teacherNoticeMessage} onChange={(e) => setTeacherNoticeMessage(e.target.value)} required placeholder="Notice message" className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm h-24" />
          <button className="bg-[#4a5d4e] text-white rounded-lg px-4 py-2 text-xs font-bold flex items-center gap-2"><Send className="h-4 w-4" /> Send to Teacher Portal</button>
        </form>}
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
        <h3 className="font-bold text-sm mb-4">Teacher Notices</h3>
        <div className="space-y-3">
          {teacherNotices.length === 0 && <p className="text-xs text-stone-500">No teacher notices have been sent.</p>}
          {teacherNotices.map((notice) => <article key={notice.id} className="border border-stone-200 rounded-lg p-3 flex items-start justify-between gap-4">
            <div><h4 className="text-sm font-bold">{notice.title}</h4><p className="text-xs text-stone-600 mt-1 whitespace-pre-wrap">{notice.message}</p><time className="text-[10px] text-stone-400">{new Date(notice.createdAt).toLocaleString()} · {notice.target === 'all' ? 'All teachers' : `${notice.recipientIds.length} teacher(s)`}</time></div>
            {!readOnly && <button title="Delete teacher notice" onClick={() => removeTeacherNotice(notice.id)} className="text-red-600 p-1"><Trash2 className="h-4 w-4" /></button>}
          </article>)}
        </div>
      </section>

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

    </div>
  );
}
