'use client';

import { motion } from 'framer-motion';
import { Play, Pause, RotateCcw, SkipForward, Timer, Coffee, Zap } from 'lucide-react';
import { usePomodoro } from '@/hooks/usePomodoro';
import { useStore } from '@/lib/store';
import { cn } from '@/lib/utils';

export default function PomodoroPage() {
  const {
    state, timeLeft, sessionType, sessionsCompleted, progress, totalTime,
    selectedTaskId, setSelectedTaskId,
    start, pause, reset, skip,
  } = usePomodoro();

  const tasks = useStore((s) => s.tasks);
  const settings = useStore((s) => s.settings);
  const pendingTasks = tasks.filter((t) => t.status !== 'completed');

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  const circumference = 2 * Math.PI * 120;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  const selectedTask = selectedTaskId ? tasks.find((t) => t.id === selectedTaskId) : null;

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Pomodoro Timer</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">Stay focused and productive</p>
      </div>

      {/* Timer Circle */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="flex flex-col items-center"
      >
        <div className="relative w-72 h-72">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 260 260">
            <circle cx="130" cy="130" r="120" fill="none" stroke="var(--border)" strokeWidth="6" opacity="0.3" />
            <circle
              cx="130" cy="130" r="120"
              fill="none"
              stroke={sessionType === 'work' ? '#6366f1' : '#10b981'}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-1000 ease-linear"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className={cn(
              'p-3 rounded-2xl mb-2',
              sessionType === 'work' ? 'bg-primary-500/10' : 'bg-green-500/10'
            )}>
              {sessionType === 'work' ? (
                <Zap size={24} className="text-primary-400" />
              ) : (
                <Coffee size={24} className="text-green-400" />
              )}
            </div>
            <span className="text-5xl font-bold text-[var(--text-primary)] tabular-nums tracking-wider">
              {timeStr}
            </span>
            <span className={cn(
              'text-sm font-medium mt-1',
              sessionType === 'work' ? 'text-primary-400' : 'text-green-400'
            )}>
              {sessionType === 'work' ? 'Focus Time' : 'Break Time'}
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-4 mt-6">
          <button onClick={reset} className="btn-ghost p-3 rounded-full" title="Reset">
            <RotateCcw size={20} />
          </button>
          <button
            onClick={state === 'running' ? pause : start}
            className={cn(
              'p-5 rounded-full text-white shadow-lg transition-all active:scale-95',
              sessionType === 'work'
                ? 'bg-primary-500 hover:bg-primary-600 shadow-primary-500/30'
                : 'bg-green-500 hover:bg-green-600 shadow-green-500/30'
            )}
          >
            {state === 'running' ? <Pause size={28} /> : <Play size={28} className="ml-1" />}
          </button>
          <button onClick={skip} className="btn-ghost p-3 rounded-full" title="Skip">
            <SkipForward size={20} />
          </button>
        </div>

        {/* Sessions */}
        <div className="flex items-center gap-2 mt-6">
          {Array.from({ length: settings.pomodoroSessionsBeforeLong }).map((_, i) => (
            <div
              key={i}
              className={cn(
                'w-3 h-3 rounded-full transition-all',
                i < (sessionsCompleted % settings.pomodoroSessionsBeforeLong)
                  ? 'bg-primary-500 shadow-lg shadow-primary-500/30'
                  : 'bg-[var(--border)]'
              )}
            />
          ))}
          <span className="text-xs text-[var(--text-muted)] ml-2">
            Session {(sessionsCompleted % settings.pomodoroSessionsBeforeLong) + 1}/{settings.pomodoroSessionsBeforeLong}
          </span>
        </div>
      </motion.div>

      {/* Task Selector */}
      <div className="glass-card p-5">
        <h3 className="font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
          <Timer size={18} className="text-primary-400" />
          Link to Task
        </h3>
        <select
          value={selectedTaskId || ''}
          onChange={(e) => setSelectedTaskId(e.target.value || null)}
          className="input-field"
        >
          <option value="">No task linked</option>
          {pendingTasks.map((t) => (
            <option key={t.id} value={t.id}>{t.title}</option>
          ))}
        </select>
        {selectedTask && (
          <div className="mt-3 p-3 rounded-xl bg-[var(--bg-secondary)]">
            <p className="text-sm font-medium text-[var(--text-primary)]">{selectedTask.title}</p>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs text-[var(--text-muted)]">
                {selectedTask.pomodorosCompleted}/{selectedTask.pomodorosEstimated} pomodoros
              </span>
              <div className="flex-1 h-1.5 rounded-full bg-white/5">
                <div
                  className="h-full rounded-full bg-primary-500 transition-all"
                  style={{ width: `${Math.min((selectedTask.pomodorosCompleted / selectedTask.pomodorosEstimated) * 100, 100)}%` }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="glass-card p-4 text-center">
          <p className="text-2xl font-bold text-primary-400">{sessionsCompleted}</p>
          <p className="text-xs text-[var(--text-muted)]">This Session</p>
        </div>
        <div className="glass-card p-4 text-center">
          <p className="text-2xl font-bold text-green-400">
            {Math.round(sessionsCompleted * settings.pomodoroWork / 60 * 10) / 10}h
          </p>
          <p className="text-xs text-[var(--text-muted)]">Focus Time</p>
        </div>
        <div className="glass-card p-4 text-center">
          <p className="text-2xl font-bold text-amber-400">{settings.pomodoroWork}m</p>
          <p className="text-xs text-[var(--text-muted)]">Session Length</p>
        </div>
      </div>
    </div>
  );
}
