import React, { useEffect, useState } from 'react';
import { Bell, Megaphone, Plus, Send, Trash2 } from 'lucide-react';
import { dbGet, dbSet, onDbChange } from '../lib/localDb';
import { Student } from '../types';
import { formatBangladeshMobile, getSchoolSmsStatus, sendSchoolSms, type SmsProviderStatus } from '../lib/sms';
import { getTeacherNotices, saveTeacherNotices, type TeacherNotice } from '../lib/teacherNotices';
import { TeacherAccount } from '../types';
import { getStaffNotices, saveStaffNotices, type StaffNotice } from '../lib/staffNotices';
import { StaffAccount } from '../types';

const isNonTeachingPortalAccount = (account: TeacherAccount): boolean =>
  /\b(staff|driver|cleaner|guard|security|accountant|cook|caretaker|peon|janitor|maintenance|office)\b/i
    .test(`${account.role || ''} ${account.designation || ''}`);

type Notice = {
  id: string;
  title: string;
  content: string;
  published_at: string;
  is_breaking: boolean;
  category: 'Admission' | 'Exam' | 'General';
};

const NOTIFICATIONS_KEY = 'samdani_notifications';
const SMS_API_URL = import.meta.env.VITE_MAIN_MADRASAH_API_URL || 'http://localhost:3018';

function readNotices(): Notice[] {
  const value = dbGet(NOTIFICATIONS_KEY);
  return Array.isArray(value) ? value.filter((item): item is Notice => Boolean(item && typeof item.content === 'string')) : [];
}

interface AppManagementPageProps {
  readOnly?: boolean;
  teacherAccounts: TeacherAccount[];
  staffAccounts: StaffAccount[];
  students: Student[];
  adminName: string;
}

export default function AppManagementPage({ readOnly = false, teacherAccounts, staffAccounts, students, adminName }: AppManagementPageProps) {
  const [notices, setNotices] = useState<Notice[]>(readNotices);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isBreaking, setIsBreaking] = useState(false);
  const [category, setCategory] = useState<Notice['category']>('General');
  const [showNoticeDeliveryOptions, setShowNoticeDeliveryOptions] = useState(false);
  const [sendingNoticeSms, setSendingNoticeSms] = useState(false);
  const [smsStatusLoading, setSmsStatusLoading] = useState(false);
  const [smsBalance, setSmsBalance] = useState('');
  const [lastSmsRequestId, setLastSmsRequestId] = useState<string | number>();
  const [smsReport, setSmsReport] = useState<SmsProviderStatus | null>(null);
  const [pushTitle, setPushTitle] = useState('');
  const [pushMessage, setPushMessage] = useState('');
  const [message, setMessage] = useState('');
  const [teacherNoticeTitle, setTeacherNoticeTitle] = useState('');
  const [teacherNoticeMessage, setTeacherNoticeMessage] = useState('');
  const [teacherNoticeTarget, setTeacherNoticeTarget] = useState<'all' | 'selected'>('all');
  const [teacherNoticeRecipients, setTeacherNoticeRecipients] = useState<string[]>([]);
  const [teacherNotices, setTeacherNotices] = useState<TeacherNotice[]>(getTeacherNotices);
  const [staffNoticeTitle, setStaffNoticeTitle] = useState('');
  const [staffNoticeMessage, setStaffNoticeMessage] = useState('');
  const [staffNoticeTarget, setStaffNoticeTarget] = useState<'all' | 'selected'>('all');
  const [staffNoticeRecipients, setStaffNoticeRecipients] = useState<string[]>([]);
  const [staffNotices, setStaffNotices] = useState<StaffNotice[]>(getStaffNotices);

  useEffect(() => {
    const refresh = () => setNotices(readNotices());
    return onDbChange(refresh);
  }, []);

  useEffect(() => {
    const refresh = () => setTeacherNotices(getTeacherNotices());
    return onDbChange(refresh);
  }, []);

  useEffect(() => {
    const refresh = () => setStaffNotices(getStaffNotices());
    return onDbChange(refresh);
  }, []);

  const saveNotices = (next: Notice[]) => {
    setNotices(next);
    dbSet(NOTIFICATIONS_KEY, next);
  };

  const prepareNoticeDelivery = (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !content.trim()) return;
    setShowNoticeDeliveryOptions(true);
  };

  const resetNoticeDraft = () => {
    setTitle('');
    setContent('');
    setIsBreaking(false);
    setCategory('General');
    setShowNoticeDeliveryOptions(false);
  };

  const addNoticeToApp = () => {
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
    resetNoticeDraft();
    setMessage('Notice saved for the Android app.');
  };

  const sendNoticeSms = async () => {
    if (!title.trim() || !content.trim()) return;
    const recipients = [...new Set(students
      .map((student) => formatBangladeshMobile(student.contact))
      .filter((number): number is string => number !== null))];
    if (recipients.length === 0) {
      setMessage('SMS not sent: no students have a valid Bangladesh guardian phone number.');
      return;
    }
    if (!window.confirm(`Send this SMS notice to ${recipients.length} student guardian phone number(s)? This may incur SMS charges.`)) return;

    setSendingNoticeSms(true);
    setMessage('');
    try {
      const sms = await sendSchoolSms(
        SMS_API_URL,
        recipients,
        `${title.trim()}\n${content.trim()}\nসামদানিয়া তালিমূল ইসলাম মাদ্রাসা`,
      );
      setLastSmsRequestId(sms.requestId);
      setSmsReport(null);
      resetNoticeDraft();
      setMessage(`SMS notice submitted to ${sms.recipientCount} guardian number(s). Request ${sms.requestId}.`);
    } catch (error) {
      setMessage(`SMS notice could not be sent: ${error instanceof Error ? error.message : 'Unknown SMS error'}`);
    } finally {
      setSendingNoticeSms(false);
    }
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

  const checkSmsBalance = async () => {
    setSmsStatusLoading(true);
    setMessage('');
    try {
      const status = await getSchoolSmsStatus(SMS_API_URL);
      if (typeof status.balance !== 'string') throw new Error('The SMS provider did not return a balance.');
      setSmsBalance(status.balance);
    } catch (error) {
      setMessage(`SMS balance could not be loaded: ${error instanceof Error ? error.message : 'Unknown SMS error'}`);
    } finally {
      setSmsStatusLoading(false);
    }
  };

  const checkSmsReport = async () => {
    if (lastSmsRequestId === undefined) return;
    setSmsStatusLoading(true);
    setMessage('');
    try {
      setSmsReport(await getSchoolSmsStatus(SMS_API_URL, lastSmsRequestId));
    } catch (error) {
      setMessage(`SMS report could not be loaded: ${error instanceof Error ? error.message : 'Unknown SMS error'}`);
    } finally {
      setSmsStatusLoading(false);
    }
  };

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

  const sendStaffNotice = (event: React.FormEvent) => {
    event.preventDefault();
    if (!staffNoticeTitle.trim() || !staffNoticeMessage.trim()) return;
    if (staffNoticeTarget === 'selected' && staffNoticeRecipients.length === 0) {
      setMessage('Select at least one staff member for a targeted notice.');
      return;
    }
    const notice: StaffNotice = {
      id: `SNOTICE-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: staffNoticeTitle.trim(),
      message: staffNoticeMessage.trim(),
      createdAt: new Date().toISOString(),
      target: staffNoticeTarget,
      recipientIds: staffNoticeTarget === 'all' ? [] : staffNoticeRecipients,
      createdBy: adminName,
    };
    const next = [notice, ...staffNotices];
    saveStaffNotices(next);
    setStaffNotices(next);
    setStaffNoticeTitle('');
    setStaffNoticeMessage('');
    setStaffNoticeTarget('all');
    setStaffNoticeRecipients([]);
    setMessage('Staff notice sent successfully. (স্টাফ নোটিশ পাঠানো হয়েছে)');
  };

  const removeStaffNotice = (id: string) => {
    const next = staffNotices.filter((notice) => notice.id !== id);
    saveStaffNotices(next);
    setStaffNotices(next);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold text-[#2c332d]">App Management</h2>
        <p className="text-xs text-stone-500 mt-1">Manage notices and notifications shared with the companion Android app.</p>
      </div>
      {message && <p className={`rounded-lg border text-xs px-4 py-3 ${message.includes('could not') || message.includes('not sent') ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`} role="status">{message}</p>}

      <div className="grid lg:grid-cols-2 gap-6">
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
              {teacherAccounts.filter((account) => account.registered && !isNonTeachingPortalAccount(account)).map((account) => (
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
        {!readOnly && <form onSubmit={sendStaffNotice} className="bg-white border border-stone-200 rounded-xl p-5 space-y-4 lg:col-span-2">
          <div className="flex items-center gap-2"><Megaphone className="h-4 w-4 text-[#4a5d4e]" /><h3 className="font-bold text-sm">Staff Noticeboard (স্টাফ নোটিশ)</h3></div>
          <div className="grid md:grid-cols-2 gap-3">
            <input value={staffNoticeTitle} onChange={(e) => setStaffNoticeTitle(e.target.value)} required placeholder="Notice title (নোটিশের শিরোনাম)" className="border border-stone-200 rounded-lg px-3 py-2 text-sm" />
            <select value={staffNoticeTarget} onChange={(e) => { setStaffNoticeTarget(e.target.value as 'all' | 'selected'); setStaffNoticeRecipients([]); }} className="border border-stone-200 rounded-lg px-3 py-2 text-sm">
              <option value="all">Send to all staff (সকল স্টাফকে পাঠান)</option>
              <option value="selected">Send to selected staff (নির্বাচিত স্টাফকে পাঠান)</option>
            </select>
          </div>
          {staffNoticeTarget === 'selected' && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {staffAccounts.map((account) => (
                <label key={account.id} className="flex items-center gap-2 rounded-lg border border-stone-200 px-3 py-2 text-xs">
                  <input type="checkbox" checked={staffNoticeRecipients.includes(account.id)} onChange={(e) => setStaffNoticeRecipients((prev) => e.target.checked ? [...prev, account.id] : prev.filter((id) => id !== account.id))} />
                  {account.fullName} · {account.role}
                </label>
              ))}
              {staffAccounts.length === 0 && <p className="text-xs text-stone-500">No staff accounts are registered yet.</p>}
            </div>
          )}
          <textarea value={staffNoticeMessage} onChange={(e) => setStaffNoticeMessage(e.target.value)} required placeholder="Notice message (নোটিশের বার্তা)" className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm h-24" />
          <button className="bg-[#4a5d4e] text-white rounded-lg px-4 py-2 text-xs font-bold flex items-center gap-2"><Send className="h-4 w-4" /> Send to Staff Portal (স্টাফ পোর্টালে পাঠান)</button>
        </form>}
        {!readOnly && <form onSubmit={prepareNoticeDelivery} className="bg-white border border-stone-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2"><Megaphone className="h-4 w-4 text-[#4a5d4e]" /><h3 className="font-bold text-sm">Create Notice</h3></div>
          <div><label className="block text-xs font-bold text-stone-600 mb-1">Notice Title</label><input value={title} onChange={(e) => setTitle(e.target.value)} required className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm" /></div>
          <div><label className="block text-xs font-bold text-stone-600 mb-1">Notice Content</label><textarea value={content} onChange={(e) => setContent(e.target.value)} required className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm h-28" /></div>
          <label className="block text-xs font-bold text-stone-600">Category<select value={category} onChange={(e) => setCategory(e.target.value as Notice['category'])} className="mt-1 w-full border border-stone-200 rounded-lg px-3 py-2 text-sm font-normal"><option>General</option><option>Admission</option><option>Exam</option></select></label>
          <label className="flex items-center gap-2 text-xs text-stone-700"><input type="checkbox" checked={isBreaking} onChange={(e) => setIsBreaking(e.target.checked)} /> Breaking notice</label>
          {!showNoticeDeliveryOptions ? (
            <button className="bg-[#4a5d4e] text-white rounded-lg px-4 py-2 text-xs font-bold flex items-center gap-2"><Send className="h-4 w-4" /> Send Notice</button>
          ) : (
            <div className="rounded-lg border border-stone-200 bg-stone-50 p-4 space-y-3">
              <p className="text-xs font-bold text-stone-700">Choose how to deliver this notice:</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={addNoticeToApp} disabled={sendingNoticeSms} className="bg-[#4a5d4e] text-white rounded-lg px-4 py-2 text-xs font-bold flex items-center gap-2 disabled:opacity-50">
                  <Plus className="h-4 w-4" /> Save to app
                </button>
                <button type="button" onClick={() => void sendNoticeSms()} disabled={sendingNoticeSms} className="bg-amber-700 text-white rounded-lg px-4 py-2 text-xs font-bold flex items-center gap-2 disabled:opacity-50">
                  <Send className="h-4 w-4" /> {sendingNoticeSms ? 'Sending SMS…' : `Send SMS to guardians (${new Set(students.map((student) => formatBangladeshMobile(student.contact)).filter(Boolean)).size})`}
                </button>
                <button type="button" onClick={() => setShowNoticeDeliveryOptions(false)} disabled={sendingNoticeSms} className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-xs font-bold text-stone-700 disabled:opacity-50">
                  Back to edit
                </button>
              </div>
              <p className="text-[11px] text-stone-500">Bulk SMS may require an approved SMS.net.bd campaign content ID and may incur charges.</p>
            </div>
          )}
        </form>}

        {!readOnly && <form onSubmit={sendPush} className="bg-white border border-stone-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2"><Bell className="h-4 w-4 text-[#4a5d4e]" /><h3 className="font-bold text-sm">Global Push Notification</h3></div>
          <div><label className="block text-xs font-bold text-stone-600 mb-1">Notification Title</label><input value={pushTitle} onChange={(e) => setPushTitle(e.target.value)} required className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm" /></div>
          <div><label className="block text-xs font-bold text-stone-600 mb-1">Notification Message</label><textarea value={pushMessage} onChange={(e) => setPushMessage(e.target.value)} required className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm h-28" /></div>
          <button className="bg-[#4a5d4e] text-white rounded-lg px-4 py-2 text-xs font-bold flex items-center gap-2"><Send className="h-4 w-4" /> Send Notification</button>
        </form>}
      </div>

      {!readOnly && (
        <section className="bg-white border border-stone-200 rounded-xl p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-sm">SMS status</h3>
              <p className="mt-1 text-xs text-stone-500">Check the SMS.net.bd account balance or delivery report for the latest notice request.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={smsStatusLoading} onClick={() => void checkSmsBalance()} className="rounded-lg border border-stone-300 px-3 py-2 text-xs font-semibold disabled:opacity-50">
                {smsStatusLoading ? 'Checking…' : 'Check balance'}
              </button>
              {lastSmsRequestId !== undefined && (
                <button type="button" disabled={smsStatusLoading} onClick={() => void checkSmsReport()} className="rounded-lg border border-stone-300 px-3 py-2 text-xs font-semibold disabled:opacity-50">
                  Check request {lastSmsRequestId}
                </button>
              )}
            </div>
          </div>
          {smsBalance && <p className="text-xs text-stone-700">SMS balance: ৳{smsBalance}</p>}
          {smsReport && (
            <div className="rounded-lg bg-stone-50 p-3 text-xs text-stone-700">
              <p>Request {smsReport.request_id}: {smsReport.request_status || 'Status unavailable'} · charge ৳{smsReport.request_charge || '0.0000'}</p>
              {smsReport.recipients?.map((recipient) => (
                <p key={recipient.number} className="mt-1">{recipient.number} · {recipient.status} · ৳{recipient.charge}</p>
              ))}
            </div>
          )}
        </section>
      )}

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
        <h3 className="font-bold text-sm mb-4">Staff Notices (স্টাফ নোটিশ)</h3>
        <div className="space-y-3">
          {staffNotices.length === 0 && <p className="text-xs text-stone-500">No staff notices have been sent. (কোনো স্টাফ নোটিশ পাঠানো হয়নি)</p>}
          {staffNotices.map((notice) => <article key={notice.id} className="border border-stone-200 rounded-lg p-3 flex items-start justify-between gap-4">
            <div><h4 className="text-sm font-bold">{notice.title}</h4><p className="text-xs text-stone-600 mt-1 whitespace-pre-wrap">{notice.message}</p><time className="text-[10px] text-stone-400">{new Date(notice.createdAt).toLocaleString()} · {notice.target === 'all' ? 'All staff' : `${notice.recipientIds.length} staff member(s)`}</time></div>
            {!readOnly && <button title="Delete staff notice" onClick={() => removeStaffNotice(notice.id)} className="text-red-600 p-1"><Trash2 className="h-4 w-4" /></button>}
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
