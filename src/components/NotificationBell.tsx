import React, { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react';
import { Bell, CheckCheck, Trash2, UserPlus, UserCheck, Wallet, GraduationCap, HandCoins, Clock, LogOut, Plane, ReceiptText, Banknote, CircleAlert } from 'lucide-react';
import { onDbChange } from '../lib/localDb';
import {
  getNotifications,
  markAllRead,
  clearNotifications,
  NOTIFICATIONS_CHANGED_EVENT,
  type AppNotification,
  type NotificationType,
} from '../lib/notifications';

const TYPE_META: Record<NotificationType, { Icon: React.ComponentType<{ className?: string }>; ring: string; bg: string }> = {
  payment: { Icon: Banknote, ring: 'bg-emerald-100 ring-emerald-200', bg: 'text-emerald-600', },
  student: { Icon: UserPlus, ring: 'bg-sky-100 ring-sky-200', bg: 'text-sky-600', },
  teacher: { Icon: UserCheck, ring: 'bg-violet-100 ring-violet-200', bg: 'text-violet-600', },
  salary: { Icon: Wallet, ring: 'bg-amber-100 ring-amber-200', bg: 'text-amber-600', },
  result: { Icon: GraduationCap, ring: 'bg-indigo-100 ring-indigo-200', bg: 'text-indigo-600', },
  loan: { Icon: HandCoins, ring: 'bg-rose-100 ring-rose-200', bg: 'text-rose-600', },
  attendance: { Icon: Clock, ring: 'bg-teal-100 ring-teal-200', bg: 'text-teal-600', },
  resignation: { Icon: LogOut, ring: 'bg-orange-100 ring-orange-200', bg: 'text-orange-600', },
  leave: { Icon: Plane, ring: 'bg-cyan-100 ring-cyan-200', bg: 'text-cyan-600', },
  ledger: { Icon: ReceiptText, ring: 'bg-slate-100 ring-slate-200', bg: 'text-slate-600', },
  system: { Icon: CircleAlert, ring: 'bg-stone-100 ring-stone-200', bg: 'text-stone-600', },
};

function timeAgo(ts: number): string {
  const diff = Math.max(0, Date.now() - ts);
  const s = Math.floor(diff / 1000);
  if (s < 10) return 'Just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString();
}

interface PanelCoords { top: number; left: number; width: number; }

export default function NotificationBell({ light = false }: { light?: boolean }) {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<PanelCoords | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const tickRef = useRef<number | null>(null);

  const refresh = useCallback(() => {
    setItems(getNotifications());
  }, []);

  // Live updates: db-change (cross-tab/device) + in-tab event + periodic refresh.
  useEffect(() => {
    refresh();
    const unsub = onDbChange(() => refresh());
    const onEvent = () => refresh();
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, onEvent);
    return () => {
      unsub();
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, onEvent);
    };
  }, [refresh]);

  // Keep relative timestamps fresh.
  useEffect(() => {
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = window.setInterval(() => refresh(), 30000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [refresh]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  // Position the panel with fixed, viewport-clamped coordinates so it can never
  // be cut off (e.g. on the teacher portal's narrow centered header).
  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }
    const place = () => {
      const el = wrapRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const margin = 10;
      const maxW = Math.min(360, window.innerWidth - margin * 2);
      let left = rect.right - maxW;
      if (left < margin) left = margin;
      if (left + maxW > window.innerWidth - margin) left = window.innerWidth - margin - maxW;
      setCoords({ top: rect.bottom + 8, left, width: maxW });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open]);

  const unread = items.filter((n) => !n.read).length;

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) markAllRead();
  };

  return (
    <div className="relative" ref={wrapRef}>
      <button
        onClick={toggle}
        aria-label="Notifications"
        className={`relative flex items-center justify-center h-9 w-9 rounded-lg transition-all cursor-pointer ${
          light
            ? 'text-white/80 hover:text-white hover:bg-white/10'
            : 'text-white/70 hover:text-white hover:bg-white/5'
        }`}
      >
        <Bell className="h-[18px] w-[18px]" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-[#1e2a20] animate-pulse">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && coords && (
        <div
          className="z-[70] animate-[fadeIn_0.15s_ease-out]"
          style={{ position: 'fixed', top: coords.top, left: coords.left, width: coords.width }}
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden ring-1 ring-black/5">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100 bg-gradient-to-r from-[#1e2a20] to-[#253328]">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-[#d9c5b2]" />
                <h3 className="text-sm font-bold text-white">Notifications</h3>
                {unread > 0 && (
                  <span className="text-[10px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded-full">
                    {unread} new
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => markAllRead()}
                  title="Mark all as read"
                  className="flex items-center gap-1 text-[10px] font-semibold text-white/70 hover:text-white px-2 py-1 rounded-md hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Read
                </button>
                <button
                  onClick={() => clearNotifications()}
                  title="Clear all"
                  className="flex items-center gap-1 text-[10px] font-semibold text-white/70 hover:text-white px-2 py-1 rounded-md hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Clear
                </button>
              </div>
            </div>

            {/* List */}
            <div className="max-h-[60vh] overflow-y-auto divide-y divide-stone-100">
              {items.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <div className="mx-auto h-12 w-12 rounded-full bg-stone-100 flex items-center justify-center mb-3">
                    <Bell className="h-5 w-5 text-stone-400" />
                  </div>
                  <p className="text-sm font-semibold text-stone-600">No notifications yet</p>
                  <p className="text-xs text-stone-400 mt-1">
                    New activity across the madrasah will appear here instantly.
                  </p>
                </div>
              ) : (
                items.map((n) => {
                  const meta = TYPE_META[n.type] ?? TYPE_META.system;
                  const Icon = meta.Icon;
                  return (
                    <div
                      key={n.id}
                      className={`flex items-start gap-3 px-4 py-3 transition-colors hover:bg-stone-50 ${
                        n.read ? 'bg-white' : 'bg-[#f7faf7]'
                      }`}
                    >
                      <div className={`shrink-0 h-9 w-9 rounded-full flex items-center justify-center ring-1 ${meta.ring}`}>
                        <Icon className={`h-4 w-4 ${meta.bg}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`text-[13px] font-semibold leading-snug text-stone-800 ${n.read ? '' : 'text-stone-900'}`}>
                          {n.title}
                        </p>
                        <p className="text-xs text-stone-500 mt-0.5 leading-snug break-words">{n.message}</p>
                        <p className="text-[10px] text-stone-400 mt-1">{timeAgo(n.createdAt)}</p>
                      </div>
                      {!n.read && (
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-red-500" />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
