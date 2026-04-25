'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useStore } from '@/lib/store';
import { playNotificationSound, initAudioOnInteraction } from '@/lib/notifications';
import { addNotifLog } from '@/components/NotificationPanel';

export function useNotifications() {
  const firedRef = useRef<Set<string>>(new Set());

  // Use refs for values that change but shouldn't restart the interval
  const tasksRef = useRef(useStore.getState().tasks);
  const soundRef = useRef(useStore.getState().settings.soundEnabled);
  const notificationsEnabledRef = useRef(useStore.getState().settings.notificationsEnabled);
  const hasHydratedRef = useRef(useStore.getState()._hasHydrated);

  useEffect(() => {
    // Subscribe to store changes and update refs (no re-render)
    const unsub = useStore.subscribe((state) => {
      tasksRef.current = state.tasks;
      soundRef.current = state.settings.soundEnabled;
      notificationsEnabledRef.current = state.settings.notificationsEnabled;
      hasHydratedRef.current = state._hasHydrated;
    });
    return unsub;
  }, []);

  useEffect(() => { initAudioOnInteraction(); }, []);

  // ── Sync to SW ──
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const sync = () => {
      navigator.serviceWorker.ready.then((reg) => {
        if (reg.active) {
          const data = tasksRef.current.map((t) => ({
            id: t.id, title: t.title, status: t.status,
            scheduledAt: t.scheduledAt, endAt: t.endAt,
            notifyOnEnd: t.notifyOnEnd, notified: t.notified, endNotified: t.endNotified,
          }));
          reg.active.postMessage({
            type: 'SYNC_TASKS',
            tasks: data,
            notificationsEnabled: notificationsEnabledRef.current,
          });
        }
      });
    };

    // Sync now + on every store change + before close + periodic + on focus
    sync();
    const unsub = useStore.subscribe(() => sync());
    window.addEventListener('beforeunload', sync);
    // Periodic resync — prevents the SW going idle and dropping its setTimeout queue.
    // Chrome kills idle SWs after ~30s; resyncing every 25s keeps it warm AND re-registers timers.
    const periodic = setInterval(sync, 25_000);
    const onFocus = () => sync();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      unsub();
      clearInterval(periodic);
      window.removeEventListener('beforeunload', sync);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, []);

  // ── Listen for SW messages ──
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'MARK_NOTIFIED') {
        const { taskId, field } = event.data;
        const task = tasksRef.current.find((t) => t.id === taskId);
        if (task) {
          useStore.getState().updateTask(taskId, { [field]: true });
          if (notificationsEnabledRef.current) {
            playNotificationSound(undefined, soundRef.current);
            addNotifLog({ taskId, taskTitle: task.title, priority: task.priority, type: field === 'endNotified' ? 'end' : 'start', time: new Date().toISOString() });
          }
        }
      }
    };
    navigator.serviceWorker.addEventListener('message', handler);
    return () => navigator.serviceWorker.removeEventListener('message', handler);
  }, []);

  // ── Main notification check — runs once, never restarts ──
  useEffect(() => {
    const check = () => {
      if (!notificationsEnabledRef.current) return;
      const now = Date.now();
      const tasks = tasksRef.current;

      tasks.forEach((task) => {
        if (task.status === 'completed') return;

        // Start notification
        if (task.scheduledAt && !task.notified) {
          const t = new Date(task.scheduledAt).getTime();
          if (isNaN(t)) return;
          const key = `s:${task.id}`;
          if (now >= t && now < t + 300000 && !firedRef.current.has(key)) {
            firedRef.current.add(key);
            playNotificationSound(undefined, soundRef.current);
            useStore.getState().updateTask(task.id, { notified: true });
            addNotifLog({ taskId: task.id, taskTitle: task.title, priority: task.priority, type: 'start', time: new Date().toISOString() });
            try {
              if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('Task Due Now!', { body: task.title, icon: '/icons/icon-192.png', tag: 'task-' + task.id });
              }
            } catch {}
          }
        }

        // End notification
        if (task.endAt && task.notifyOnEnd && !task.endNotified) {
          const t = new Date(task.endAt).getTime();
          if (isNaN(t)) return;
          const key = `e:${task.id}`;
          if (now >= t && now < t + 300000 && !firedRef.current.has(key)) {
            firedRef.current.add(key);
            playNotificationSound(undefined, soundRef.current);
            useStore.getState().updateTask(task.id, { endNotified: true });
            addNotifLog({ taskId: task.id, taskTitle: task.title, priority: task.priority, type: 'end', time: new Date().toISOString() });
            try {
              if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('Task Time Complete!', { body: `"${task.title}" duration is over`, icon: '/icons/icon-192.png', tag: 'task-end-' + task.id });
              }
            } catch {}
          }
        }
      });
    };

    // Single interval that never gets reset
    const interval = setInterval(check, 2000);

    // Also check on focus/visibility
    const onFocus = () => check();
    const onVisible = () => { if (document.visibilityState === 'visible') check(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []); // Empty deps — runs once, interval never resets

  // Auto-request permission — wait for hydration so persisted tasks are loaded
  const requestedRef = useRef(false);
  useEffect(() => {
    if (requestedRef.current) return;
    const tryRequest = () => {
      if (requestedRef.current) return;
      const state = useStore.getState();
      if (!state._hasHydrated) return;
      const hasScheduled = state.tasks.some((t) => t.scheduledAt && t.status !== 'completed');
      if (!hasScheduled) return;
      if (typeof window === 'undefined' || !('Notification' in window)) return;
      if (Notification.permission !== 'default') return;
      requestedRef.current = true;
      Notification.requestPermission().catch(() => {});
    };
    tryRequest();
    const unsub = useStore.subscribe(() => tryRequest());
    return unsub;
  }, []);
}
