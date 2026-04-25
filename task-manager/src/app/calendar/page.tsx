'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { useStore } from '@/lib/store';
import { MONTHS, DAYS_OF_WEEK, PRIORITY_CONFIG } from '@/lib/constants';
import { cn, getDaysInMonth, getFirstDayOfMonth, isSameDay, formatTime } from '@/lib/utils';
import TaskForm from '@/components/tasks/TaskForm';
import { Task } from '@/lib/types';

export default function CalendarPage() {
  const tasks = useStore((s) => s.tasks);
  const toggleComplete = useStore((s) => s.toggleComplete);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showForm, setShowForm] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const tasksByDate = useMemo(() => {
    const map: Record<string, Task[]> = {};
    tasks.forEach((t) => {
      if (t.scheduledAt) {
        const key = new Date(t.scheduledAt).toDateString();
        if (!map[key]) map[key] = [];
        map[key].push(t);
      }
    });
    return map;
  }, [tasks]);

  const selectedDayTasks = useMemo(() => {
    return tasksByDate[selectedDate.toDateString()] || [];
  }, [tasksByDate, selectedDate]);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1));
  const goToday = () => { setCurrentDate(new Date()); setSelectedDate(new Date()); };

  const calendarDays = [];
  for (let i = 0; i < firstDay; i++) calendarDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarDays.push(new Date(year, month, d));

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Calendar</h1>
        <button onClick={goToday} className="btn-secondary text-sm">Today</button>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Calendar Grid */}
        <div className="md:col-span-2 glass-card p-5">
          <div className="flex items-center justify-between mb-6">
            <button onClick={prevMonth} className="btn-ghost p-2"><ChevronLeft size={20} /></button>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">
              {MONTHS[month]} {year}
            </h2>
            <button onClick={nextMonth} className="btn-ghost p-2"><ChevronRight size={20} /></button>
          </div>

          {/* Day Headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {DAYS_OF_WEEK.map((day) => (
              <div key={day} className="text-center text-xs font-medium text-[var(--text-muted)] py-2">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Cells */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((date, i) => {
              if (!date) return <div key={`empty-${i}`} />;
              const isToday = isSameDay(date, new Date());
              const isSelected = isSameDay(date, selectedDate);
              const dayTasks = tasksByDate[date.toDateString()] || [];
              const hasOverdue = dayTasks.some((t) => t.status !== 'completed' && new Date(t.scheduledAt!) < new Date());

              return (
                <button
                  key={i}
                  onClick={() => setSelectedDate(date)}
                  className={cn(
                    'aspect-square rounded-xl flex flex-col items-center justify-center gap-1 transition-all relative',
                    isSelected
                      ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/25'
                      : isToday
                      ? 'bg-primary-500/10 text-primary-400'
                      : 'hover:bg-white/5 text-[var(--text-primary)]'
                  )}
                >
                  <span className="text-sm font-medium">{date.getDate()}</span>
                  {dayTasks.length > 0 && (
                    <div className="flex gap-0.5">
                      {dayTasks.slice(0, 3).map((t) => (
                        <span
                          key={t.id}
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ background: PRIORITY_CONFIG[t.priority].color }}
                        />
                      ))}
                      {dayTasks.length > 3 && (
                        <span className="text-[8px] text-[var(--text-muted)]">+{dayTasks.length - 3}</span>
                      )}
                    </div>
                  )}
                  {hasOverdue && !isSelected && (
                    <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-red-500" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Day Detail */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-[var(--text-primary)]">
              {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </h3>
            <CalendarIcon size={18} className="text-primary-400" />
          </div>

          {selectedDayTasks.length > 0 ? (
            <div className="space-y-2">
              {selectedDayTasks.map((task) => (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={cn(
                    `p-3 rounded-xl bg-[var(--bg-secondary)] priority-stripe-${task.priority} cursor-pointer hover:bg-white/5 transition-colors`,
                    task.status === 'completed' && 'opacity-50'
                  )}
                  onClick={() => { setEditTask(task); setShowForm(true); }}
                >
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleComplete(task.id); }}
                      className={cn(
                        'w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0',
                        task.status === 'completed' ? 'bg-green-500 border-green-500' : 'border-[var(--text-muted)]'
                      )}
                    >
                      {task.status === 'completed' && (
                        <svg width="8" height="8" viewBox="0 0 12 12" fill="none"><path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-sm font-medium truncate', task.status === 'completed' && 'line-through text-[var(--text-muted)]')}>
                        {task.title}
                      </p>
                      <p className="text-[10px] text-[var(--text-muted)]">
                        {task.scheduledAt && formatTime(task.scheduledAt)}
                        {task.recurrence !== 'once' && ` · ${task.recurrence}`}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-[var(--text-muted)]">
              <p className="text-sm">No tasks scheduled</p>
              <button
                onClick={() => setShowForm(true)}
                className="text-primary-400 text-sm mt-2 hover:underline"
              >
                Add a task
              </button>
            </div>
          )}
        </div>
      </div>

      <TaskForm isOpen={showForm} onClose={() => { setShowForm(false); setEditTask(null); }} editTask={editTask} />
    </div>
  );
}
