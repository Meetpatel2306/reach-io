'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar, Clock, ChevronLeft, ChevronRight, X,
  Sun, Sunset, Moon, Sunrise, CalendarDays, Zap,
} from 'lucide-react';
import { cn, isSameDay, getDaysInMonth, getFirstDayOfMonth } from '@/lib/utils';
import { MONTHS, DAYS_OF_WEEK } from '@/lib/constants';

interface DateTimePickerProps {
  value: string; // ISO or datetime-local format
  onChange: (value: string) => void;
  label?: string;
}

const QUICK_TIMES = [
  { label: 'Morning', time: '09:00', icon: Sunrise, color: 'text-amber-400', bg: 'bg-amber-500/10' },
  { label: 'Noon', time: '12:00', icon: Sun, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  { label: 'Afternoon', time: '15:00', icon: Sunset, color: 'text-orange-400', bg: 'bg-orange-500/10' },
  { label: 'Evening', time: '18:00', icon: Sunset, color: 'text-rose-400', bg: 'bg-rose-500/10' },
  { label: 'Night', time: '21:00', icon: Moon, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
];

const QUICK_DATES = [
  { label: 'Today', offset: 0 },
  { label: 'Tomorrow', offset: 1 },
  { label: 'In 3 days', offset: 3 },
  { label: 'Next Week', offset: 7 },
  { label: 'In 2 Weeks', offset: 14 },
  { label: 'Next Month', offset: 30 },
];

export default function DateTimePicker({ value, onChange, label }: DateTimePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<'date' | 'time'>('date');
  const [currentMonth, setCurrentMonth] = useState(() => {
    if (value) return new Date(value);
    return new Date();
  });
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse current value
  const selectedDate = value ? new Date(value) : null;
  const selectedHour = selectedDate ? selectedDate.getHours() : 9;
  const selectedMinute = selectedDate ? selectedDate.getMinutes() : 0;

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  // Calendar data
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const today = new Date();

  const calendarDays = useMemo(() => {
    const days: (Date | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(new Date(year, month, d));
    return days;
  }, [year, month, daysInMonth, firstDay]);

  const prevMonth = () => setCurrentMonth(new Date(year, month - 1));
  const nextMonth = () => setCurrentMonth(new Date(year, month + 1));

  const selectDate = (date: Date) => {
    const now = new Date();
    const h = selectedDate ? selectedDate.getHours() : now.getHours();
    const rawM = selectedDate ? selectedDate.getMinutes() : now.getMinutes();
    const m = selectedDate ? rawM : Math.ceil(rawM / 5) * 5;
    date.setHours(h, m, 0, 0);
    const localISO = formatLocalISO(date);
    onChange(localISO);
    setView('time');
  };

  const selectQuickDate = (offset: number) => {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    selectDate(date);
  };

  const selectTime = (hour: number, minute: number) => {
    const date = selectedDate ? new Date(selectedDate) : new Date();
    date.setHours(hour, minute, 0, 0);
    onChange(formatLocalISO(date));
  };

  const selectQuickTime = (timeStr: string) => {
    const [h, m] = timeStr.split(':').map(Number);
    selectTime(h, m);
  };

  const clearValue = () => {
    onChange('');
    setIsOpen(false);
  };

  const displayValue = selectedDate
    ? `${selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} at ${selectedDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`
    : '';

  const isPast = (date: Date) => {
    const d = new Date(date);
    d.setHours(23, 59, 59);
    return d < today;
  };

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">
          {label}
        </label>
      )}

      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => { setIsOpen(!isOpen); setView('date'); }}
        className={cn(
          'w-full flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-all text-left',
          isOpen
            ? 'border-primary-500 ring-2 ring-primary-500/30 bg-[var(--bg-secondary)]'
            : 'border-[var(--border)] bg-[var(--bg-secondary)] hover:border-primary-500/50',
          !displayValue && 'text-[var(--text-muted)]'
        )}
      >
        <div className={cn(
          'p-1.5 rounded-lg',
          displayValue ? 'bg-primary-500/10' : 'bg-white/5'
        )}>
          <Calendar size={16} className={displayValue ? 'text-primary-400' : 'text-[var(--text-muted)]'} />
        </div>
        <span className="flex-1 text-sm truncate text-[var(--text-primary)]">
          {displayValue || 'Pick a date & time...'}
        </span>
        {displayValue && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); clearValue(); }}
            className="p-1 rounded-lg hover:bg-white/10 text-[var(--text-muted)] hover:text-red-400 transition-colors"
          >
            <X size={14} />
          </button>
        )}
      </button>

      {/* Dropdown Picker */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ type: 'spring', damping: 25, stiffness: 400 }}
            className="absolute z-50 mt-2 w-full min-w-[340px] glass-card p-0 shadow-2xl shadow-black/20 overflow-hidden"
          >
            {/* Tab Header */}
            <div className="flex border-b border-[var(--border)]">
              <button
                type="button"
                onClick={() => setView('date')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-all relative',
                  view === 'date'
                    ? 'text-primary-400'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                )}
              >
                <CalendarDays size={16} />
                Date
                {view === 'date' && (
                  <motion.div layoutId="picker-tab" className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary-500 rounded-full" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setView('time')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-all relative',
                  view === 'time'
                    ? 'text-primary-400'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                )}
              >
                <Clock size={16} />
                Time
                {view === 'time' && (
                  <motion.div layoutId="picker-tab" className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary-500 rounded-full" />
                )}
              </button>
            </div>

            {view === 'date' ? (
              <div className="p-4">
                {/* Quick Dates */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {QUICK_DATES.map((qd) => {
                    const targetDate = new Date();
                    targetDate.setDate(targetDate.getDate() + qd.offset);
                    const isSelected = selectedDate && isSameDay(selectedDate, targetDate);
                    return (
                      <button
                        key={qd.label}
                        type="button"
                        onClick={() => selectQuickDate(qd.offset)}
                        className={cn(
                          'px-2.5 py-1 rounded-lg text-xs font-medium transition-all',
                          isSelected
                            ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/25'
                            : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-primary-500/10 hover:text-primary-400'
                        )}
                      >
                        {qd.label}
                      </button>
                    );
                  })}
                </div>

                {/* Month Navigation */}
                <div className="flex items-center justify-between mb-3">
                  <button type="button" onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-white/10 text-[var(--text-secondary)] transition-colors">
                    <ChevronLeft size={18} />
                  </button>
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                    {MONTHS[month]} {year}
                  </h3>
                  <button type="button" onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-white/10 text-[var(--text-secondary)] transition-colors">
                    <ChevronRight size={18} />
                  </button>
                </div>

                {/* Day of Week Headers */}
                <div className="grid grid-cols-7 gap-1 mb-1">
                  {DAYS_OF_WEEK.map((day) => (
                    <div key={day} className="text-center text-[10px] font-semibold text-[var(--text-muted)] py-1 uppercase tracking-wider">
                      {day}
                    </div>
                  ))}
                </div>

                {/* Calendar Grid */}
                <div className="grid grid-cols-7 gap-1">
                  {calendarDays.map((date, i) => {
                    if (!date) return <div key={`e-${i}`} />;

                    const isToday = isSameDay(date, today);
                    const isSelected = selectedDate && isSameDay(date, selectedDate);
                    const past = isPast(date) && !isToday;

                    return (
                      <motion.button
                        key={i}
                        type="button"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => selectDate(new Date(date))}
                        disabled={past}
                        className={cn(
                          'aspect-square rounded-xl flex items-center justify-center text-sm font-medium transition-all relative',
                          isSelected
                            ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/30'
                            : isToday
                            ? 'bg-primary-500/15 text-primary-400 font-bold'
                            : past
                            ? 'text-[var(--text-muted)]/40 cursor-not-allowed'
                            : 'text-[var(--text-primary)] hover:bg-white/10'
                        )}
                      >
                        {date.getDate()}
                        {isToday && !isSelected && (
                          <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-primary-400" />
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="p-4">
                {/* Quick Times */}
                <p className="text-xs font-medium text-[var(--text-muted)] mb-2 uppercase tracking-wider">Quick Pick</p>
                <div className="grid grid-cols-5 gap-2 mb-5">
                  {QUICK_TIMES.map((qt) => {
                    const [h, m] = qt.time.split(':').map(Number);
                    const isSelected = selectedHour === h && selectedMinute === m;
                    const Icon = qt.icon;
                    return (
                      <button
                        key={qt.label}
                        type="button"
                        onClick={() => selectQuickTime(qt.time)}
                        className={cn(
                          'flex flex-col items-center gap-1.5 p-2.5 rounded-xl transition-all border',
                          isSelected
                            ? 'border-primary-500 bg-primary-500/10 shadow-lg shadow-primary-500/10'
                            : 'border-transparent hover:bg-white/5'
                        )}
                      >
                        <div className={cn('p-1.5 rounded-lg', qt.bg)}>
                          <Icon size={14} className={qt.color} />
                        </div>
                        <span className="text-[10px] font-medium text-[var(--text-secondary)]">{qt.label}</span>
                        <span className="text-[10px] text-[var(--text-muted)]">{qt.time}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Custom Time */}
                <p className="text-xs font-medium text-[var(--text-muted)] mb-3 uppercase tracking-wider">Custom Time</p>
                <div className="flex items-center justify-center gap-3">
                  {/* Hour */}
                  <div className="flex flex-col items-center gap-1">
                    <button
                      type="button"
                      onClick={() => selectTime((selectedHour + 1) % 24, selectedMinute)}
                      className="p-1 rounded-lg hover:bg-white/10 text-[var(--text-muted)]"
                    >
                      <ChevronLeft size={16} className="rotate-90" />
                    </button>
                    <div className="w-16 h-14 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] flex items-center justify-center">
                      <span className="text-2xl font-bold text-[var(--text-primary)] tabular-nums">
                        {selectedHour.toString().padStart(2, '0')}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => selectTime((selectedHour - 1 + 24) % 24, selectedMinute)}
                      className="p-1 rounded-lg hover:bg-white/10 text-[var(--text-muted)]"
                    >
                      <ChevronLeft size={16} className="-rotate-90" />
                    </button>
                    <span className="text-[10px] text-[var(--text-muted)]">Hour</span>
                  </div>

                  <span className="text-2xl font-bold text-[var(--text-muted)] mt-[-20px]">:</span>

                  {/* Minute */}
                  <div className="flex flex-col items-center gap-1">
                    <button
                      type="button"
                      onClick={() => selectTime(selectedHour, (selectedMinute + 5) % 60)}
                      className="p-1 rounded-lg hover:bg-white/10 text-[var(--text-muted)]"
                    >
                      <ChevronLeft size={16} className="rotate-90" />
                    </button>
                    <div className="w-16 h-14 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] flex items-center justify-center">
                      <span className="text-2xl font-bold text-[var(--text-primary)] tabular-nums">
                        {selectedMinute.toString().padStart(2, '0')}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => selectTime(selectedHour, (selectedMinute - 5 + 60) % 60)}
                      className="p-1 rounded-lg hover:bg-white/10 text-[var(--text-muted)]"
                    >
                      <ChevronLeft size={16} className="-rotate-90" />
                    </button>
                    <span className="text-[10px] text-[var(--text-muted)]">Minute</span>
                  </div>

                  {/* AM/PM indicator */}
                  <div className="flex flex-col gap-1.5 mt-[-20px]">
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedHour >= 12) selectTime(selectedHour - 12, selectedMinute);
                      }}
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
                        selectedHour < 12
                          ? 'bg-primary-500 text-white shadow shadow-primary-500/30'
                          : 'bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:bg-white/10'
                      )}
                    >
                      AM
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedHour < 12) selectTime(selectedHour + 12, selectedMinute);
                      }}
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
                        selectedHour >= 12
                          ? 'bg-primary-500 text-white shadow shadow-primary-500/30'
                          : 'bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:bg-white/10'
                      )}
                    >
                      PM
                    </button>
                  </div>
                </div>

                {/* Minute Grid */}
                <div className="mt-4">
                  <p className="text-[10px] font-medium text-[var(--text-muted)] mb-2 uppercase tracking-wider">Minutes</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => selectTime(selectedHour, m)}
                        className={cn(
                          'w-9 h-8 rounded-lg text-xs font-medium transition-all',
                          selectedMinute === m
                            ? 'bg-primary-500 text-white shadow shadow-primary-500/25'
                            : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-primary-500/10 hover:text-primary-400'
                        )}
                      >
                        :{m.toString().padStart(2, '0')}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border)] bg-[var(--bg-secondary)]/50">
              {selectedDate ? (
                <div className="flex items-center gap-2">
                  <Zap size={14} className="text-primary-400" />
                  <span className="text-xs font-medium text-[var(--text-primary)]">
                    {selectedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    {' at '}
                    {selectedDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                  </span>
                </div>
              ) : (
                <span className="text-xs text-[var(--text-muted)]">No date selected</span>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-4 py-1.5 rounded-lg bg-primary-500 text-white text-xs font-medium hover:bg-primary-600 transition-colors shadow shadow-primary-500/25"
              >
                Done
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function formatLocalISO(date: Date): string {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const d = date.getDate().toString().padStart(2, '0');
  const h = date.getHours().toString().padStart(2, '0');
  const min = date.getMinutes().toString().padStart(2, '0');
  return `${y}-${m}-${d}T${h}:${min}`;
}
