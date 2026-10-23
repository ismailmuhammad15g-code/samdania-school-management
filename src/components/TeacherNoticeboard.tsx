import React, { useCallback, useEffect, useState } from 'react';
import { Bell, Megaphone } from 'lucide-react';
import { onDbChange } from '../lib/localDb';
import { getTeacherNotices, noticeIsForTeacher, type TeacherNotice } from '../lib/teacherNotices';

export default function TeacherNoticeboard({ teacherId }: { teacherId?: string }) {
  const [notices, setNotices] = useState<TeacherNotice[]>([]);
  const refresh = useCallback(() => {
    if (!teacherId) {
      setNotices([]);
      return;
    }
    setNotices(
      getTeacherNotices()
        .filter((notice) => noticeIsForTeacher(notice, teacherId))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    );
  }, [teacherId]);

  useEffect(() => {
    refresh();
    return onDbChange(refresh);
  }, [refresh]);

  return (
    <section className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-3">
        <Megaphone className="h-4 w-4 text-[#4a5d4e]" />
        <h2 className="text-sm font-serif font-bold text-[#2c332d]">Noticeboard (নোটিশ বোর্ড)</h2>
      </div>
      {notices.length === 0 ? (
        <p className="text-xs text-stone-500">No notices for you at this time.</p>
      ) : (
        <div className="space-y-2.5">
          {notices.map((notice) => (
            <article key={notice.id} className="rounded-xl border border-amber-200 bg-amber-50/70 p-3">
              <div className="flex items-start gap-2">
                <Bell className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <h3 className="text-xs font-bold text-amber-900">{notice.title}</h3>
                  <p className="text-[11px] text-amber-800 mt-1 whitespace-pre-wrap">{notice.message}</p>
                  <time className="block text-[10px] text-amber-600 mt-2">
                    {new Date(notice.createdAt).toLocaleString()}
                  </time>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
