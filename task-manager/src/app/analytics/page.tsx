'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Flame, Trophy, Target, TrendingUp, Calendar, CheckCircle2 } from 'lucide-react';
import { useStore } from '@/lib/store';
import { cn, getDateKey, addDays } from '@/lib/utils';
import { PRIORITY_CONFIG } from '@/lib/constants';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';

export default function AnalyticsPage() {
  const tasks = useStore((s) => s.tasks);
  const streak = useStore((s) => s.streak);
  const completionHistory = useStore((s) => s.completionHistory);

  // Completion rate
  const completionRate = useMemo(() => {
    if (tasks.length === 0) return 0;
    return Math.round((tasks.filter((t) => t.status === 'completed').length / tasks.length) * 100);
  }, [tasks]);

  // Last 30 days chart
  const last30Days = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 30 }, (_, i) => {
      const date = addDays(today, -29 + i);
      const key = getDateKey(date);
      const histCount = completionHistory.find((h) => h.date === key)?.completed || 0;
      const taskCount = tasks.filter((t) => t.completedAt && getDateKey(new Date(t.completedAt)) === key).length;
      return {
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        completed: Math.max(histCount, taskCount),
      };
    });
  }, [completionHistory, tasks]);

  // Category breakdown
  const categoryData = useMemo(() => {
    const cats = useStore.getState().categories;
    const counts: Record<string, { name: string; count: number; color: string }> = {};
    tasks.forEach((t) => {
      const cat = t.categoryId ? cats.find((c) => c.id === t.categoryId) : null;
      const key = cat ? cat.id : 'none';
      if (!counts[key]) counts[key] = { name: cat?.name || 'Uncategorized', count: 0, color: cat?.color || '#64748b' };
      counts[key].count++;
    });
    return Object.values(counts).filter((c) => c.count > 0);
  }, [tasks]);

  // Heatmap data (last 12 weeks)
  const heatmapData = useMemo(() => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const weeks: { date: Date; count: number }[][] = [];

    for (let w = 11; w >= 0; w--) {
      const week: { date: Date; count: number }[] = [];
      for (let d = 0; d < 7; d++) {
        const daysBack = w * 7 + (6 - d) + (6 - dayOfWeek);
        const date = addDays(today, -daysBack);
        const key = getDateKey(date);
        const histCount = completionHistory.find((h) => h.date === key)?.completed || 0;
        const taskCount = tasks.filter((t) => t.completedAt && getDateKey(new Date(t.completedAt)) === key).length;
        week.push({ date, count: Math.max(histCount, taskCount) });
      }
      weeks.push(week);
    }
    return weeks;
  }, [completionHistory]);

  const maxHeatmapCount = Math.max(1, ...heatmapData.flat().map((d) => d.count));

  // Productivity score
  const productivityScore = useMemo(() => {
    const streakScore = Math.min(streak.current * 5, 30);
    const completionScore = completionRate * 0.5;
    const recent = last30Days.slice(-7).reduce((sum, d) => sum + d.completed, 0);
    const activityScore = Math.min(recent * 3, 20);
    return Math.min(Math.round(streakScore + completionScore + activityScore), 100);
  }, [streak, completionRate, last30Days]);

  const scoreColor = productivityScore >= 80 ? '#10b981' : productivityScore >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-[var(--text-primary)]">Analytics</h1>

      {/* Top Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Current Streak', value: `${streak.current}d`, icon: Flame, color: 'text-orange-400', bg: 'bg-orange-500/10' },
          { label: 'Longest Streak', value: `${streak.longest}d`, icon: Trophy, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
          { label: 'Completion Rate', value: `${completionRate}%`, icon: Target, color: 'text-green-400', bg: 'bg-green-500/10' },
          { label: 'Total Tasks', value: tasks.length, icon: CheckCircle2, color: 'text-blue-400', bg: 'bg-blue-500/10' },
        ].map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="glass-card p-4"
          >
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl ${card.bg}`}>
                <card.icon size={20} className={card.color} />
              </div>
              <div>
                <p className="text-2xl font-bold text-[var(--text-primary)]">{card.value}</p>
                <p className="text-xs text-[var(--text-muted)]">{card.label}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Completion History Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="glass-card p-5 md:col-span-2"
        >
          <h2 className="font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
            <TrendingUp size={18} className="text-primary-400" />
            Last 30 Days
          </h2>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={last30Days}>
                <defs>
                  <linearGradient id="a30Fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity={0.25} />
                    <stop offset="60%" stopColor="var(--accent-primary)" stopOpacity={0.08} />
                    <stop offset="100%" stopColor="var(--accent-primary)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="a30Stroke" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="var(--accent-primary)" />
                    <stop offset="100%" stopColor="var(--accent-light, var(--accent-primary))" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.4} />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} interval={4} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, fontSize: 12, boxShadow: '0 12px 40px rgba(0,0,0,0.4)' }} cursor={{ stroke: 'var(--accent-primary)', strokeWidth: 1, strokeDasharray: '4 4' }} />
                <Area type="monotone" dataKey="completed" stroke="url(#a30Stroke)" strokeWidth={2.5} fill="url(#a30Fill)" dot={false} activeDot={{ r: 5, fill: 'var(--accent-primary)', strokeWidth: 3, stroke: 'var(--bg-card)' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Productivity Score */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="glass-card p-5 flex flex-col items-center justify-center"
        >
          <h2 className="font-semibold text-[var(--text-primary)] mb-4">Productivity Score</h2>
          <div className="relative w-32 h-32">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="50" fill="none" stroke="var(--border)" strokeWidth="8" opacity="0.3" />
              <circle
                cx="60" cy="60" r="50"
                fill="none"
                stroke={scoreColor}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={314}
                strokeDashoffset={314 - (productivityScore / 100) * 314}
                className="transition-all duration-1000"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-3xl font-bold" style={{ color: scoreColor }}>{productivityScore}</span>
            </div>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-3 text-center">
            {productivityScore >= 80 ? 'Excellent! Keep it up!' : productivityScore >= 50 ? 'Good progress!' : 'Room for improvement'}
          </p>
        </motion.div>
      </div>

      {/* Heatmap & Categories */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Contribution Heatmap */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="glass-card p-5"
        >
          <h2 className="font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
            <Calendar size={18} className="text-primary-400" />
            Activity (12 weeks)
          </h2>
          <div className="flex gap-1 justify-center">
            {heatmapData.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-1">
                {week.map((day, di) => (
                  <div
                    key={di}
                    className="w-3 h-3 rounded-sm transition-colors"
                    title={`${getDateKey(day.date)}: ${day.count} tasks`}
                    style={{
                      background: day.count === 0
                        ? 'var(--border)'
                        : `rgba(99, 102, 241, ${0.2 + (day.count / maxHeatmapCount) * 0.8})`,
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-center gap-1 mt-3">
            <span className="text-[10px] text-[var(--text-muted)]">Less</span>
            {[0, 0.2, 0.4, 0.6, 0.8].map((opacity) => (
              <div
                key={opacity}
                className="w-3 h-3 rounded-sm"
                style={{
                  background: opacity === 0 ? 'var(--border)' : `rgba(99, 102, 241, ${0.2 + opacity * 0.8})`,
                }}
              />
            ))}
            <span className="text-[10px] text-[var(--text-muted)]">More</span>
          </div>
        </motion.div>

        {/* Category Breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="glass-card p-5"
        >
          <h2 className="font-semibold text-[var(--text-primary)] mb-4">By Category</h2>
          {categoryData.length > 0 ? (
            <div className="space-y-3 mt-1">
              {(() => {
                const total = categoryData.reduce((s, d) => s + d.count, 0);
                return categoryData.map((d) => {
                  const pct = Math.round((d.count / total) * 100);
                  return (
                    <div key={d.name}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ background: d.color, boxShadow: `0 0 8px ${d.color}40` }} />
                          <span className="text-sm font-medium text-[var(--text-primary)]">{d.name}</span>
                        </div>
                        <span className="text-sm font-semibold text-[var(--text-primary)]">{d.count} <span className="text-xs text-[var(--text-muted)] font-normal">({pct}%)</span></span>
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
            <div className="h-40 flex items-center justify-center text-sm text-[var(--text-muted)]">No data yet</div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
