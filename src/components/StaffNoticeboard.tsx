import React, { useCallback, useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { onDbChange } from '../lib/localDb';
import { getStaffNotices, noticeIsForStaff, type StaffNotice } from '../lib/staffNotices';

export default function StaffNoticeboard({ staffId }: { staffId: string }) {
  const [notices, setNotices] = useState<StaffNotice[]>([]);
  const refresh = useCallback(() => {
    setNotices(getStaffNotices().filter((notice) => noticeIsForStaff(notice, staffId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  }, [staffId]);

  useEffect(() => {
    refresh();
    return onDbChange(refresh);
  }, [refresh]);

  return (
    <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
      <h2 className="text-sm font-serif font-bold text-[#2c332d] flex items-center gap-2"><Bell className="h-4 w-4 text-[#4a5d4e]" /> Staff Notices (স্টাফ নোটিশ)</h2>
      {notices.length === 0 ? <p className="text-xs text-stone-500 mt-3">No staff notices yet. (এখনো কোনো স্টাফ নোটিশ নেই)</p> : (
        <div className="mt-3 space-y-2">
          {notices.map((notice) => <article key={notice.id} className="rounded-xl border border-stone-200 bg-[#fdfbf7] p-3">
            <h3 className="text-xs font-bold text-stone-800">{notice.title}</h3>
            <p className="text-xs text-stone-600 mt-1 whitespace-pre-wrap">{notice.message}</p>
            <time className="block text-[10px] text-stone-400 mt-2">{new Date(notice.createdAt).toLocaleString()}</time>
          </article>)}
        </div>
      )}
    </section>
  );
}
