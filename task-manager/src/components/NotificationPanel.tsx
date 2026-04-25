'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X, CheckCircle2, Clock } from 'lucide-react';
import { useStore } from '@/lib/store';
import { formatRelative, safeLocalStorage, safeLocalStorageSet } from '@/lib/utils';
import { PRIORITY_CONFIG } from '@/lib/constants';

interface NotifEntry {
  id: string;
  taskId: string;
  taskTitle: string;
  priority: string;
  type: 'start' | 'end';
  time: string;
}

const NOTIF_STORAGE_KEY = 'taskpro-notification-log';
const DISMISSED_KEY = 'taskpro-notif-dismissed-ids';

function getNotifLog(): NotifEntry[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(safeLocalStorage(NOTIF_STORAGE_KEY, '[]')); } catch { return []; }
}

function getDismissedIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try { return new Set(JSON.parse(safeLocalStorage(DISMISSED_KEY, '[]'))); } catch { return new Set(); }
}

function saveDismissedIds(ids: Set<string>) {
  safeLocalStorageSet(DISMISSED_KEY, JSON.stringify([...ids]));
}

export function addNotifLog(entry: Omit<NotifEntry, 'id'>) {
  const log = getNotifLog();
  log.unshift({ ...entry, id: Date.now().toString(36) });
  if (log.length > 50) log.length = 50;
  safeLocalStorageSet(NOTIF_STORAGE_KEY, JSON.stringify(log));
}

export default function NotificationPanel() {
  const [open, setOpen] = useState(false);
  const [log, setLog] = useState<NotifEntry[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const panelRef = useRef<HTMLDivElement>(null);
  const tasks = useStore((s) => s.tasks);
  const updateTask = useStore((s) => s.updateTask);

  // Overdue tasks not yet dismissed
  const overdueTasks = tasks.filter(
    (t) => t.scheduledAt && new Date(t.scheduledAt) < new Date() && t.status !== 'completed' && !dismissedIds.has(t.id)
  );

  useEffect(() => {
    setDismissedIds(getDismissedIds());
  }, []);

  useEffect(() => {
    if (open) setLog(getNotifLog());
  }, [open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const clearAll = () => {
    try { localStorage.removeItem(NOTIF_STORAGE_KEY); } catch {}
    setLog([]);

    // Dismiss all overdue tasks from this panel
    const newDismissed = new Set(dismissedIds);
    overdueTasks.forEach((t) => newDismissed.add(t.id));
    saveDismissedIds(newDismissed);
    setDismissedIds(newDismissed);

    // Mark all as notified so they don't re-fire
    overdueTasks.forEach((t) => {
      updateTask(t.id, { notified: true, endNotified: true });
    });
  };

  const badgeCount = overdueTasks.length + log.length;

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(!open)}
        className="btn-ghost p-2.5 rounded-xl relative"
        title="Notifications"
      >
        <Bell size={18} />
        {badgeCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center font-bold animate-pulse">
            {badgeCount > 9 ? '9+' : badgeCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 400 }}
            className="absolute right-0 top-full mt-2 w-80 max-h-[420px] glass-card shadow-2xl overflow-hidden z-50"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
              <h3 className="text-sm font-bold text-[var(--text-primary)]">Notifications</h3>
              <div className="flex items-center gap-2">
                {(log.length > 0 || overdueTasks.length > 0) && (
                  <button
                    onClick={clearAll}
                    className="text-[10px] font-medium px-2.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                  >
                    Clear All
                  </button>
                )}
                <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-white/10 text-[var(--text-muted)]">
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="overflow-y-auto max-h-[350px] no-scrollbar">
              {/* Overdue */}
              {overdueTasks.length > 0 && (
                <div className="px-4 py-2 border-b border-[var(--border)]">
                  <p className="text-[10px] font-semibold text-red-400 uppercase tracking-wider mb-2">Overdue</p>
                  {overdueTasks.slice(0, 5).map((t) => (
                    <div key={t.id} className="flex items-center gap-2.5 py-1.5">
                      <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-[var(--text-primary)] truncate">{t.title}</p>
                        <p className="text-[10px] text-red-400">{formatRelative(t.scheduledAt!)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Log */}
              {log.length > 0 ? (
                <div className="px-4 py-2">
                  <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">Recent</p>
                  {log.map((n) => (
                    <div key={n.id} className="flex items-start gap-2.5 py-2 border-b border-[var(--border)] last:border-0">
                      <div className="mt-0.5">
                        {n.type === 'end' ? (
                          <CheckCircle2 size={14} className="text-green-400" />
                        ) : (
                          <Clock size={14} style={{ color: PRIORITY_CONFIG[n.priority as keyof typeof PRIORITY_CONFIG]?.color || 'var(--text-muted)' }} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-[var(--text-primary)] truncate">{n.taskTitle}</p>
                        <p className="text-[10px] text-[var(--text-muted)]">
                          {n.type === 'start' ? 'Task due' : 'Task ended'} · {formatRelative(n.time)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : overdueTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Bell size={28} className="text-[var(--text-muted)] mb-2 opacity-30" />
                  <p className="text-sm text-[var(--text-muted)]">No notifications</p>
                </div>
              ) : null}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
