'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useStore } from '@/lib/store';
import { sendNotification, playNotificationSound } from '@/lib/notifications';

type PomodoroState = 'idle' | 'running' | 'paused' | 'break';

export function usePomodoro() {
  const settings = useStore((s) => s.settings);
  const addSession = useStore((s) => s.addPomodoroSession);

  const [state, setState] = useState<PomodoroState>('idle');
  const [timeLeft, setTimeLeft] = useState(settings.pomodoroWork * 60);
  const [sessionType, setSessionType] = useState<'work' | 'break'>('work');
  const [sessionsCompleted, setSessionsCompleted] = useState(0);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<string>('');

  const totalTime = sessionType === 'work'
    ? settings.pomodoroWork * 60
    : (sessionsCompleted > 0 && sessionsCompleted % settings.pomodoroSessionsBeforeLong === 0
      ? settings.pomodoroLongBreak * 60
      : settings.pomodoroBreak * 60);

  const progress = ((totalTime - timeLeft) / totalTime) * 100;

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    setState('running');
    startTimeRef.current = new Date().toISOString();
    if (state === 'idle') {
      const duration = sessionType === 'work'
        ? settings.pomodoroWork * 60
        : (sessionsCompleted > 0 && sessionsCompleted % settings.pomodoroSessionsBeforeLong === 0
          ? settings.pomodoroLongBreak * 60
          : settings.pomodoroBreak * 60);
      setTimeLeft(duration);
    }
  }, [state, sessionType, settings, sessionsCompleted]);

  const pause = useCallback(() => {
    setState('paused');
    clearTimer();
  }, [clearTimer]);

  const reset = useCallback(() => {
    clearTimer();
    setState('idle');
    setSessionType('work');
    setTimeLeft(settings.pomodoroWork * 60);
    setSessionsCompleted(0);
  }, [clearTimer, settings.pomodoroWork]);

  const skip = useCallback(() => {
    clearTimer();
    if (sessionType === 'work') {
      setSessionType('break');
      const isLong = (sessionsCompleted + 1) % settings.pomodoroSessionsBeforeLong === 0;
      setTimeLeft(isLong ? settings.pomodoroLongBreak * 60 : settings.pomodoroBreak * 60);
      setSessionsCompleted((s) => s + 1);
    } else {
      setSessionType('work');
      setTimeLeft(settings.pomodoroWork * 60);
    }
    setState('idle');
  }, [clearTimer, sessionType, sessionsCompleted, settings]);

  useEffect(() => {
    if (state !== 'running') return;

    intervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearTimer();
          // Session complete
          addSession({
            taskId: selectedTaskId,
            startedAt: startTimeRef.current,
            duration: sessionType === 'work' ? settings.pomodoroWork : settings.pomodoroBreak,
            type: sessionType,
          });

          if (sessionType === 'work') {
            const newCount = sessionsCompleted + 1;
            setSessionsCompleted(newCount);
            sendNotification('Pomodoro Complete!', 'Time for a break!');
            playNotificationSound('pomodoro', settings.soundEnabled);
            setSessionType('break');
            const isLong = newCount % settings.pomodoroSessionsBeforeLong === 0;
            setState('idle');
            return isLong ? settings.pomodoroLongBreak * 60 : settings.pomodoroBreak * 60;
          } else {
            sendNotification('Break Over!', 'Time to get back to work!');
            playNotificationSound('pomodoro', settings.soundEnabled);
            setSessionType('work');
            setState('idle');
            return settings.pomodoroWork * 60;
          }
        }
        return prev - 1;
      });
    }, 1000);

    return clearTimer;
  }, [state, sessionType, sessionsCompleted, selectedTaskId, settings, addSession, clearTimer]);

  return {
    state, timeLeft, sessionType, sessionsCompleted, progress, totalTime,
    selectedTaskId, setSelectedTaskId,
    start, pause, reset, skip,
  };
}
