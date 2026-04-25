'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckSquare, Calendar, Timer, BarChart3, Bell, Share2, Palette,
  X, ChevronLeft, ChevronRight, Briefcase, Heart, BookOpen, Star,
  Clock, Tag as TagIcon, Flame, Trophy, Zap, Download, Upload,
} from 'lucide-react';

// ── Sample data (self-contained — never written to user store) ──
const DEMO_TASKS = [
  { title: 'Project standup', priority: 'high', cat: 'Work', icon: Briefcase, color: '#6366f1', time: '9:30 AM', subs: 2, done: false },
  { title: 'Morning workout', priority: 'medium', cat: 'Health', icon: Heart, color: '#10b981', time: '7:00 AM', subs: 3, done: true },
  { title: 'Read chapter 5', priority: 'low', cat: 'Learning', icon: BookOpen, color: '#f59e0b', time: '8:00 PM', subs: 0, done: false },
];

const DEMO_HEATMAP = [
  [0, 1, 2, 3, 2, 1, 0],
  [1, 2, 3, 4, 3, 2, 1],
  [2, 3, 4, 5, 4, 3, 2],
  [1, 2, 3, 4, 3, 2, 1],
];

interface TourStep {
  id: string;
  title: string;
  subtitle: string;
  icon: any;
  color: string;
  body: () => React.ReactNode;
}

const STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to TaskManager Pro',
    subtitle: 'A 60-second guided tour',
    icon: Zap,
    color: '#8b5cf6',
    body: () => (
      <div className="text-center py-4">
        <p className="text-sm text-[var(--text-secondary)] mb-4 max-w-md mx-auto">
          Take a 60-second walk through every feature. The data shown in this tour is sample data only —
          it stays inside this window and never touches your tasks.
        </p>
        <ul className="text-xs text-[var(--text-muted)] space-y-1.5 max-w-xs mx-auto text-left">
          <li>• Tasks · Calendar · Pomodoro</li>
          <li>• Analytics · Notifications</li>
          <li>• Sharing · Themes</li>
        </ul>
      </div>
    ),
  },
  {
    id: 'tasks',
    title: 'Smart Tasks',
    subtitle: 'Priority, category, subtasks, tags — all in one card',
    icon: CheckSquare,
    color: '#6366f1',
    body: () => (
      <div className="space-y-2">
        {DEMO_TASKS.map((t, i) => (
          <div key={i} className={`p-3 rounded-xl border ${t.done ? 'bg-green-500/5 border-green-500/20' : 'bg-white/5 border-white/10'}`}>
            <div className="flex items-center gap-3">
              <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center ${t.done ? 'bg-green-500 border-green-500' : 'border-[var(--border)]'}`}>
                {t.done && <CheckSquare size={12} className="text-white" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${t.done ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text-primary)]'}`}>{t.title}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded" style={{ background: t.color + '20', color: t.color }}>
                    <t.icon size={10} /> {t.cat}
                  </span>
                  <span className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
                    <Clock size={10} /> {t.time}
                  </span>
                  {t.subs > 0 && (
                    <span className="text-[10px] text-[var(--text-muted)]">{t.subs} subtasks</span>
                  )}
                </div>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded uppercase font-bold ${
                t.priority === 'high' ? 'bg-orange-500/20 text-orange-400' :
                t.priority === 'medium' ? 'bg-amber-500/20 text-amber-400' :
                'bg-blue-500/20 text-blue-400'
              }`}>{t.priority}</span>
            </div>
          </div>
        ))}
        <p className="text-xs text-[var(--text-muted)] text-center pt-2">Drag to reorder · Tap to edit · Swipe for actions</p>
      </div>
    ),
  },
  {
    id: 'calendar',
    title: 'Calendar View',
    subtitle: 'See your week or month at a glance',
    icon: Calendar,
    color: '#3b82f6',
    body: () => {
      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const tasksOn = [2, 1, 3, 2, 1, 0, 4];
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-7 gap-2">
            {days.map((d, i) => (
              <div key={d} className="text-center">
                <p className="text-[10px] text-[var(--text-muted)] mb-1.5">{d}</p>
                <div className={`aspect-square rounded-lg flex flex-col items-center justify-center text-xs font-semibold ${
                  i === 3 ? 'bg-primary-500 text-white shadow-lg' : 'bg-white/5 text-[var(--text-primary)]'
                }`}>
                  <span>{20 + i}</span>
                  {tasksOn[i] > 0 && (
                    <span className={`text-[8px] mt-0.5 ${i === 3 ? 'text-white/80' : 'text-primary-400'}`}>{tasksOn[i]}●</span>
                  )}
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-[var(--text-muted)] text-center">Tasks aggregate by day · Once / Daily / Weekly / Monthly recurrence</p>
        </div>
      );
    },
  },
  {
    id: 'pomodoro',
    title: 'Pomodoro Timer',
    subtitle: 'Focus in 25-min blocks · Track sessions per task',
    icon: Timer,
    color: '#10b981',
    body: () => (
      <div className="text-center space-y-4">
        <div className="relative w-32 h-32 mx-auto">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
            <circle cx="50" cy="50" r="44" fill="none" stroke="#10b981" strokeWidth="8"
              strokeDasharray="276" strokeDashoffset="69" strokeLinecap="round" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-2xl font-bold text-[var(--text-primary)]">18:42</p>
            <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wide">Focus</p>
          </div>
        </div>
        <div className="flex items-center justify-center gap-4 text-xs">
          <span className="flex items-center gap-1.5 text-[var(--text-secondary)]">
            <Flame size={12} className="text-orange-400" /> 3/4 cycles
          </span>
          <span className="flex items-center gap-1.5 text-[var(--text-secondary)]">
            <Trophy size={12} className="text-amber-400" /> 12 today
          </span>
        </div>
        <p className="text-xs text-[var(--text-muted)]">Customize work / break / long-break in Settings</p>
      </div>
    ),
  },
  {
    id: 'analytics',
    title: 'Analytics & Streaks',
    subtitle: 'Heatmap · Streak · Charts',
    icon: BarChart3,
    color: '#f59e0b',
    body: () => (
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <div className="p-3 rounded-xl bg-orange-500/10 text-center">
            <p className="text-2xl font-bold text-orange-400">7</p>
            <p className="text-[10px] text-[var(--text-muted)]">Day Streak</p>
          </div>
          <div className="p-3 rounded-xl bg-green-500/10 text-center">
            <p className="text-2xl font-bold text-green-400">42</p>
            <p className="text-[10px] text-[var(--text-muted)]">Done This Week</p>
          </div>
          <div className="p-3 rounded-xl bg-blue-500/10 text-center">
            <p className="text-2xl font-bold text-blue-400">85%</p>
            <p className="text-[10px] text-[var(--text-muted)]">Completion</p>
          </div>
        </div>
        <div>
          <p className="text-[10px] text-[var(--text-muted)] mb-1.5 uppercase tracking-wider">Productivity heatmap</p>
          <div className="space-y-1">
            {DEMO_HEATMAP.map((row, i) => (
              <div key={i} className="grid grid-cols-7 gap-1">
                {row.map((v, j) => (
                  <div key={j} className="aspect-square rounded"
                    style={{ background: `rgba(245,158,11,${0.1 + v * 0.18})` }} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'notifications',
    title: 'Smart Notifications',
    subtitle: 'Browser + sound + service worker, all gated by your settings',
    icon: Bell,
    color: '#ef4444',
    body: () => (
      <div className="space-y-3">
        <div className="p-4 rounded-xl bg-white/5 border border-white/10">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center flex-shrink-0">
              <Bell size={18} className="text-red-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[var(--text-primary)]">Task Due Now!</p>
              <p className="text-xs text-[var(--text-secondary)]">Project standup</p>
              <p className="text-[10px] text-[var(--text-muted)] mt-1">just now · TaskPro</p>
            </div>
          </div>
        </div>
        <ul className="text-xs text-[var(--text-secondary)] space-y-1.5">
          <li>• Native browser notifications (granted in Settings)</li>
          <li>• Audio chime on the active tab</li>
          <li>• Service worker schedules notifications when tab is open</li>
          <li>• Open Settings → Notifications → "Send Test" to verify</li>
        </ul>
      </div>
    ),
  },
  {
    id: 'sharing',
    title: 'Shareable .taskpro Files',
    subtitle: 'Export tasks → send to anyone → they import with one click',
    icon: Share2,
    color: '#8b5cf6',
    body: () => (
      <div className="space-y-3">
        <div className="flex gap-3">
          <div className="flex-1 p-4 rounded-xl bg-white/5 border border-white/10 text-center">
            <Download size={20} className="mx-auto text-primary-400 mb-2" />
            <p className="text-sm font-semibold text-[var(--text-primary)]">Export</p>
            <p className="text-[10px] text-[var(--text-muted)]">tasks-2026-04-25.taskpro</p>
          </div>
          <div className="flex-1 p-4 rounded-xl bg-white/5 border border-white/10 text-center">
            <Upload size={20} className="mx-auto text-primary-400 mb-2" />
            <p className="text-sm font-semibold text-[var(--text-primary)]">Import</p>
            <p className="text-[10px] text-[var(--text-muted)]">Adds new tasks only — never overwrites</p>
          </div>
        </div>
        <p className="text-xs text-[var(--text-muted)] text-center">
          Use it for team workflows, lesson plans, recipe lists, project templates
        </p>
      </div>
    ),
  },
  {
    id: 'themes',
    title: 'Themes & Background Effects',
    subtitle: '30+ color themes, 15 animated backgrounds, dynamic favicon',
    icon: Palette,
    color: '#ec4899',
    body: () => {
      const swatches = ['#8b5cf6', '#10b981', '#3b82f6', '#f43f5e', '#f59e0b', '#06b6d4', '#a855f7', '#22c55e'];
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-8 gap-2">
            {swatches.map((c) => (
              <div key={c} className="aspect-square rounded-lg shadow-lg" style={{ background: `linear-gradient(135deg, ${c}, ${c}aa)` }} />
            ))}
          </div>
          <p className="text-xs text-[var(--text-muted)] text-center">
            Theme swatches above · Background effects: orbs, particles, waves, aurora, matrix, and more.
            Picked from Settings → Appearance.
          </p>
        </div>
      );
    },
  },
  {
    id: 'done',
    title: 'You\'ve seen it all',
    subtitle: 'Your data stays on your device · No account, no server',
    icon: Star,
    color: '#22c55e',
    body: () => (
      <div className="text-center py-2 space-y-3">
        <div className="w-14 h-14 mx-auto rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/30">
          <Star size={26} className="text-white" />
        </div>
        <p className="text-sm text-[var(--text-secondary)] max-w-sm mx-auto">
          That's the full tour. You can replay it anytime from <strong>Settings → Take Product Tour</strong>.
        </p>
        <p className="text-xs text-[var(--text-muted)]">No data was added to your store during this tour.</p>
      </div>
    ),
  },
];

export default function ProductTour({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [step, setStep] = useState(0);

  if (!open) return null;
  const s = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const isFirst = step === 0;
  const Icon = s.icon;

  const next = () => {
    if (isLast) { onClose(); setStep(0); }
    else setStep(step + 1);
  };
  const prev = () => { if (!isFirst) setStep(step - 1); };
  const close = () => { onClose(); setStep(0); };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Product Tour">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="relative w-full max-w-lg glass-card overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: s.color + '20' }}>
              <Icon size={18} style={{ color: s.color }} />
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">{s.title}</p>
              <p className="text-[11px] text-[var(--text-muted)]">{s.subtitle}</p>
            </div>
          </div>
          <button onClick={close} className="p-1.5 rounded-lg hover:bg-white/10 text-[var(--text-muted)]" aria-label="Close tour">
            <X size={16} />
          </button>
        </div>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-1.5 py-3 border-b border-[var(--border)]">
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === step ? 'w-6 bg-primary-500' :
                i < step ? 'w-1.5 bg-primary-500/40' : 'w-1.5 bg-[var(--border)]'
              }`}
              aria-label={`Go to step ${i + 1}`}
            />
          ))}
        </div>

        {/* Body */}
        <div className="p-5 min-h-[280px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={s.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              {s.body()}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-[var(--border)] bg-[var(--bg-secondary)]">
          <button
            onClick={prev}
            disabled={isFirst}
            className="btn-ghost text-xs flex items-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={14} /> Back
          </button>
          <p className="text-[10px] text-[var(--text-muted)]">{step + 1} of {STEPS.length}</p>
          <button
            onClick={next}
            className="btn-primary text-xs flex items-center gap-1"
          >
            {isLast ? 'Finish' : 'Next'} {!isLast && <ChevronRight size={14} />}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
