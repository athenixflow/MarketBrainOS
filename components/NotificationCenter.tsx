import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { AppNotification } from '../types';
import { getUserNotifications, markNotificationRead, markAllNotificationsRead } from '../services/persistenceService';

const CATEGORY_COLORS: Record<string, string> = {
  Analysis: 'bg-blue-500',
  Subscription: 'bg-purple-500',
  Token: 'bg-green-500',
  Payment: 'bg-emerald-500',
  System: 'bg-gray-500',
  // Phase 6 organizational events
  Member: 'bg-indigo-500',
  Client: 'bg-orange-500',
  Report: 'bg-cyan-500',
  Enterprise: 'bg-rose-500',
};

const NotificationCenter: React.FC = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setItems(await getUserNotifications(user.uid));
  }, [user]);

  // Initial load + light polling so badges update without a manual refresh.
  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  // Close on outside click.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const unread = items.filter((n) => !n.read).length;

  const handleToggle = async () => {
    const next = !open;
    setOpen(next);
    if (next) await load();
  };

  const handleRead = async (n: AppNotification) => {
    if (n.read) return;
    setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    await markNotificationRead(n.id);
  };

  const handleReadAll = async () => {
    if (!user) return;
    setItems((prev) => prev.map((x) => ({ ...x, read: true })));
    await markAllNotificationsRead(user.uid);
  };

  if (!user) return null;

  return (
    <div className="relative" ref={ref}>
      <button onClick={handleToggle} className="relative text-gray-400 hover:text-white transition-colors p-1" aria-label="Notifications">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-[#FF0000] text-white text-[9px] font-bold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-3 w-[min(20rem,calc(100vw-2rem))] max-h-[28rem] overflow-hidden flex flex-col bg-white text-[#0B0B0B] rounded-2xl shadow-2xl border border-gray-100 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <p className="text-xs font-bold uppercase tracking-widest">Notifications</p>
            {unread > 0 && (
              <button onClick={handleReadAll} className="text-[9px] font-bold text-[#FF0000] hover:opacity-70 uppercase tracking-widest transition-opacity">
                Mark all read
              </button>
            )}
          </div>

          <div className="overflow-y-auto flex-grow">
            {items.length === 0 ? (
              <div className="py-12 text-center text-gray-400 text-sm font-medium">No notifications yet.</div>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleRead(n)}
                  className={`w-full text-left px-5 py-4 border-b border-gray-50 hover:bg-gray-50 transition-colors flex gap-3 ${n.read ? 'opacity-60' : ''}`}
                >
                  <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${CATEGORY_COLORS[n.category] || 'bg-gray-400'}`} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold truncate">{n.title}</p>
                      {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-[#FF0000] shrink-0" />}
                    </div>
                    {n.body && <p className="text-xs text-gray-500 font-medium leading-relaxed mt-0.5">{n.body}</p>}
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                      {n.category} · {n.created_at ? new Date(n.created_at).toLocaleDateString() : ''}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;
