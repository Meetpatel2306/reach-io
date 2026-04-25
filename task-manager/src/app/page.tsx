'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircle2, Clock, AlertTriangle, Flame, Plus,
  TrendingUp, Calendar, ArrowRight, ListTodo,
} from 'lucide-react';
import { useStore } from '@/lib/store';
import { isToday, isOverdue, formatRelative, cn, getDateKey, addDays } from '@/lib/utils';
import { PRIORITY_CONFIG } from '@/lib/constants';
import TaskForm from '@/components/tasks/TaskForm';
import { Task } from '@/lib/types';
import Link from 'next/link';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

export default function DashboardPage() {
  const tasks = useStore((s) => s.tasks);
  const streak = useStore((s) => s.streak);
  const completionHistory = useStore((s) => s.completionHistory);
  const [showForm, setShowForm] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);

  const stats = useMemo(() => {
    const today = tasks.filter((t) => t.scheduledAt && isToday(t.scheduledAt));
    const completedToday = tasks.filter((t) => t.completedAt && isToday(t.completedAt));
    const overdue = tasks.filter((t) => t.scheduledAt && t.status !== 'completed' && isOverdue(t.scheduledAt));
    const pending = tasks.filter((t) => t.status === 'pending');
    return { today: today.length, completedToday: completedToday.length, overdue: overdue.length, pending: pending.length };
  }, [tasks]);

  const upcomingTasks = useMemo(() => {
    return tasks
      .filter((t) => t.scheduledAt && t.status !== 'completed' && new Date(t.scheduledAt) > new Date())
      .sort((a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime())
      .slice(0, 5);
  }, [tasks]);

  const weeklyData = useMemo(() => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const today = new Date();
    const dayOfWeek = today.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

    return days.map((name, i) => {
      const date = addDays(today, mondayOffset + i);
      const key = getDateKey(date);
      // Count from completionHistory
      const histCount = completionHistory.find((h) => h.date === key)?.completed || 0;
      // Also count completed tasks by their completedAt date
      const taskCount = tasks.filter((t) => t.completedAt && getDateKey(new Date(t.completedAt)) === key).length;
      return { name, completed: Math.max(histCount, taskCount) };
    });
  }, [completionHistory, tasks]);

  const priorityData = useMemo(() => {
    const counts = { low: 0, medium: 0, high: 0, urgent: 0 };
    tasks.filter((t) => t.status !== 'completed').forEach((t) => counts[t.priority]++);
    return Object.entries(counts)
      .filter(([, count]) => count > 0)
      .map(([key, value]) => ({
        name: PRIORITY_CONFIG[key as keyof typeof counts].label,
        value,
        color: PRIORITY_CONFIG[key as keyof typeof counts].color,
      }));
  }, [tasks]);

  const statCards = [
    { label: 'Today\'s Tasks', value: stats.today, icon: Calendar, color: 'text-blue-400', bg: 'bg-blue-500/10', gradient: 'from-blue-500/20 to-cyan-500/5' },
    { label: 'Completed Today', value: stats.completedToday, icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10', gradient: 'from-emerald-500/20 to-teal-500/5' },
    { label: 'Overdue', value: stats.overdue, icon: AlertTriangle, color: 'text-rose-400', bg: 'bg-rose-500/10', gradient: 'from-rose-500/20 to-pink-500/5' },
    { label: 'Current Streak', value: `${streak.current}d`, icon: Flame, color: 'text-orange-400', bg: 'bg-orange-500/10', gradient: 'from-orange-500/20 to-amber-500/5' },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Greeting */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">
            Dashboard
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            {stats.pending > 0
              ? `You have ${stats.pending} pending tasks`
              : 'All caught up! Great work!'}
          </p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
          <Plus size={18} /> New Task
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="glass-card p-5 relative overflow-hidden group"
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-3">
                <div className={`p-2.5 rounded-xl ${card.bg}`}>
                  <card.icon size={20} className={card.color} />
                </div>
              </div>
              <p className="text-3xl font-extrabold text-[var(--text-primary)] stat-number">{card.value}</p>
              <p className="text-xs text-[var(--text-muted)] mt-1 font-medium">{card.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Charts & Upcoming */}
      <div className="grid md:grid-cols-3 gap-6">
        {/* Weekly Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="glass-card p-5 md:col-span-2"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <TrendingUp size={18} className="text-primary-400" />
              This Week
            </h2>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weeklyData}>
                <defs>
                  <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity={0.3} />
                    <stop offset="50%" stopColor="var(--accent-primary)" stopOpacity={0.1} />
                    <stop offset="100%" stopColor="var(--accent-primary)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="lineStroke" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="var(--accent-primary)" />
                    <stop offset="100%" stopColor="var(--accent-light, var(--accent-primary))" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.5} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 12 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, fontSize: 12, boxShadow: '0 12px 40px rgba(0,0,0,0.4)' }}
                  labelStyle={{ color: 'var(--text-primary)', fontWeight: 600 }}
                  cursor={{ stroke: 'var(--accent-primary)', strokeWidth: 1, strokeDasharray: '4 4' }}
                />
                <Area type="monotone" dataKey="completed" stroke="url(#lineStroke)" strokeWidth={2.5} fill="url(#areaFill)" dot={{ r: 4, fill: 'var(--accent-primary)', strokeWidth: 2, stroke: 'var(--bg-card)' }} activeDot={{ r: 6, fill: 'var(--accent-primary)', strokeWidth: 3, stroke: 'var(--bg-card)' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Priority Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="glass-card p-5"
        >
          <h2 className="font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
            <ListTodo size={18} className="text-primary-400" />
            By Priority
          </h2>
          {priorityData.length > 0 ? (
            <div className="space-y-3 mt-1">
              {(() => {
                const total = priorityData.reduce((s, d) => s + d.value, 0);
                return priorityData.map((d) => {
                  const pct = Math.round((d.value / total) * 100);
                  return (
                    <div key={d.name}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ background: d.color, boxShadow: `0 0 8px ${d.color}40` }} />
                          <span className="text-sm font-medium text-[var(--text-primary)]">{d.name}</span>
                        </div>
                        <span className="text-sm font-semibold text-[var(--text-primary)]">{d.value} <span className="text-xs text-[var(--text-muted)] font-normal">({pct}%)</span></span>
                      </div>
                      <div className="h-2 rounded-full bg-[var(--border)] overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.8, ease: 'easeOut' }}
                          className="h-full rounded-full"
                          style={{ background: d.color, boxShadow: `0 0 10px ${d.color}30` }}
                        />
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-[var(--text-muted)] text-sm">
              No active tasks
            </div>
          )}
        </motion.div>
      </div>

      {/* Upcoming Tasks */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="glass-card p-5"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <Clock size={18} className="text-primary-400" />
            Upcoming Tasks
          </h2>
          <Link href="/tasks" className="text-xs text-primary-400 hover:text-primary-300 flex items-center gap-1">
            View all <ArrowRight size={12} />
          </Link>
        </div>
        {upcomingTasks.length > 0 ? (
          <div className="space-y-2">
            {upcomingTasks.map((task) => (
              <div
                key={task.id}
                className={`flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-secondary)] hover:bg-white/5 transition-colors priority-stripe-${task.priority}`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--text-primary)] truncate">{task.title}</p>
                  <p className="text-xs text-[var(--text-muted)]">{formatRelative(task.scheduledAt!)}</p>
                </div>
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                  style={{ color: PRIORITY_CONFIG[task.priority].color, background: PRIORITY_CONFIG[task.priority].color + '15' }}
                >
                  {task.priority}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--text-muted)] text-center py-8">No upcoming scheduled tasks</p>
        )}
      </motion.div>

      <TaskForm isOpen={showForm} onClose={() => { setShowForm(false); setEditTask(null); }} editTask={editTask} />
    </div>
  );
}
