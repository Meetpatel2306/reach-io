'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Plus, X, Tag, Clock } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { useStore } from '@/lib/store';
import { useToast } from '@/components/ui/Toast';
import { Task, Priority, Recurrence, TaskStatus } from '@/lib/types';
import { PRIORITY_CONFIG } from '@/lib/constants';
import { cn } from '@/lib/utils';

const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface TaskFormProps {
  isOpen: boolean;
  onClose: () => void;
  editTask?: Task | null;
}

export default function TaskForm({ isOpen, onClose, editTask }: TaskFormProps) {
  const addTask = useStore((s) => s.addTask);
  const updateTask = useStore((s) => s.updateTask);
  const categories = useStore((s) => s.categories);
  const settings = useStore((s) => s.settings);
  const { addToast } = useToast();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>(settings.defaultPriority);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [recurrence, setRecurrence] = useState<Recurrence>('once');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  // Schedule fields
  const [startHour, setStartHour] = useState(9);
  const [startMin, setStartMin] = useState(0);
  const [endHour, setEndHour] = useState(10);
  const [endMin, setEndMin] = useState(0);
  const [hasEndTime, setHasEndTime] = useState(false);
  const [selectedDate, setSelectedDate] = useState(''); // for 'once'
  const [weekDay, setWeekDay] = useState(new Date().getDay()); // for 'weekly'

  useEffect(() => {
    if (editTask) {
      setTitle(editTask.title);
      setDescription(editTask.description);
      setPriority(editTask.priority);
      setCategoryId(editTask.categoryId);
      setRecurrence(editTask.recurrence);
      setTags(editTask.tags);
      setHasEndTime(!!editTask.endAt);
      if (editTask.scheduledAt) {
        const d = new Date(editTask.scheduledAt);
        setStartHour(d.getHours());
        setStartMin(d.getMinutes());
        setWeekDay(d.getDay());
        setSelectedDate(d.toISOString().split('T')[0]);
      }
      if (editTask.endAt) {
        const d = new Date(editTask.endAt);
        setEndHour(d.getHours());
        setEndMin(d.getMinutes());
      }
    } else {
      setTitle('');
      setDescription('');
      setPriority(settings.defaultPriority);
      setCategoryId(null);
      setRecurrence('once');
      setTags([]);
      setHasEndTime(false);
      const now = new Date();
      const nextHour = now.getHours() + 1;
      setStartHour(nextHour > 23 ? 9 : nextHour);
      setStartMin(0);
      setEndHour(nextHour > 23 ? 10 : nextHour + 1);
      setEndMin(0);
      setWeekDay(now.getDay());
      // Default date = today
      const y = now.getFullYear();
      const m = (now.getMonth() + 1).toString().padStart(2, '0');
      const dd = now.getDate().toString().padStart(2, '0');
      setSelectedDate(`${y}-${m}-${dd}`);
    }
  }, [editTask, isOpen, settings]);

  const addTag = () => {
    const tag = tagInput.trim();
    if (tag && !tags.includes(tag)) { setTags([...tags, tag]); setTagInput(''); }
  };

  // Build the scheduledAt ISO string based on recurrence
  const buildScheduledAt = (): string | null => {
    const now = new Date();

    if (recurrence === 'once') {
      if (!selectedDate) return null;
      const [y, m, d] = selectedDate.split('-').map(Number);
      return new Date(y, m - 1, d, startHour, startMin).toISOString();
    }

    if (recurrence === 'daily') {
      // Today at the selected time (or tomorrow if time already passed)
      const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), startHour, startMin);
      if (target < now) target.setDate(target.getDate() + 1);
      return target.toISOString();
    }

    if (recurrence === 'weekly') {
      // Next occurrence of the selected weekday
      const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), startHour, startMin);
      const currentDay = now.getDay();
      let daysUntil = weekDay - currentDay;
      if (daysUntil < 0) daysUntil += 7;
      if (daysUntil === 0 && target < now) daysUntil = 7;
      target.setDate(target.getDate() + daysUntil);
      return target.toISOString();
    }

    if (recurrence === 'monthly') {
      if (!selectedDate) return null;
      const day = new Date(selectedDate).getDate();
      const target = new Date(now.getFullYear(), now.getMonth(), day, startHour, startMin);
      if (target < now) target.setMonth(target.getMonth() + 1);
      return target.toISOString();
    }

    return null;
  };

  const buildEndAt = (): string | null => {
    if (!hasEndTime) return null;
    const startISO = buildScheduledAt();
    if (!startISO) return null;
    const start = new Date(startISO);
    return new Date(start.getFullYear(), start.getMonth(), start.getDate(), endHour, endMin).toISOString();
  };

  // Duration display
  const duration = useMemo(() => {
    if (!hasEndTime) return null;
    const totalStartMin = startHour * 60 + startMin;
    const totalEndMin = endHour * 60 + endMin;
    let diff = totalEndMin - totalStartMin;
    if (diff <= 0) diff += 24 * 60;
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    if (h === 0) return `${m}m`;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }, [startHour, startMin, endHour, endMin, hasEndTime]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const common = {
      title: title.trim(),
      description: description.trim(),
      priority,
      status: (editTask?.status || 'pending') as TaskStatus,
      categoryId,
      tags,
      recurrence,
      recurrenceDay: recurrence === 'weekly' ? weekDay : undefined,
      scheduledAt: buildScheduledAt(),
      endAt: buildEndAt(),
      notifyOnEnd: hasEndTime,
      completedAt: editTask?.completedAt || null,
      pomodorosEstimated: 1,
      subtasks: editTask?.subtasks || [],
    };

    if (editTask) {
      updateTask(editTask.id, { ...common, pomodorosCompleted: editTask.pomodorosCompleted });
      addToast('Task updated!', 'success');
    } else {
      addTask(common);
      addToast('Task created!', 'success');
    }
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={editTask ? 'Edit Task' : 'New Task'} size="lg">
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Title *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs to be done?"
            className="input-field text-lg"
            autoFocus
            required
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add details..."
            rows={2}
            className="input-field resize-none"
          />
        </div>

        {/* Priority & Category */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Priority</label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(PRIORITY_CONFIG) as Priority[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className="px-3 py-2 rounded-xl text-sm font-medium transition-all border"
                  style={priority === p
                    ? { borderColor: PRIORITY_CONFIG[p].color, color: PRIORITY_CONFIG[p].color, background: PRIORITY_CONFIG[p].color + '15' }
                    : { borderColor: 'var(--border)', color: 'var(--text-secondary)' }
                  }
                >
                  {PRIORITY_CONFIG[p].label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Category</label>
            <select value={categoryId || ''} onChange={(e) => setCategoryId(e.target.value || null)} className="input-field">
              <option value="">None</option>
              {categories.map((cat) => (<option key={cat.id} value={cat.id}>{cat.name}</option>))}
            </select>
          </div>
        </div>

        {/* ── Schedule Type ── */}
        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Schedule</label>
          <div className="grid grid-cols-4 gap-2 mb-4">
            {(['once', 'daily', 'weekly', 'monthly'] as Recurrence[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRecurrence(r)}
                className="px-3 py-2.5 rounded-xl text-xs font-semibold transition-all border capitalize"
                style={recurrence === r
                  ? { borderColor: 'var(--accent-primary)', color: 'var(--accent-primary)', background: 'color-mix(in srgb, var(--accent-primary) 10%, transparent)' }
                  : { borderColor: 'var(--border)', color: 'var(--text-secondary)' }
                }
              >
                {r}
              </button>
            ))}
          </div>

          {/* ── Once: Date + Time ── */}
          {recurrence === 'once' && (
            <div className="space-y-3 p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)]">
              <label className="block text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Date</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="input-field text-sm"
              />
              <label className="block text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mt-3">Start Time</label>
              <TimePicker hour={startHour} min={startMin} onHourChange={setStartHour} onMinChange={setStartMin} />
            </div>
          )}

          {/* ── Daily: Time only ── */}
          {recurrence === 'daily' && (
            <div className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)]">
              <label className="block text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mb-2">Every day at</label>
              <TimePicker hour={startHour} min={startMin} onHourChange={setStartHour} onMinChange={setStartMin} />
            </div>
          )}

          {/* ── Weekly: Day selector + Time ── */}
          {recurrence === 'weekly' && (
            <div className="space-y-3 p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)]">
              <label className="block text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Every</label>
              <div className="grid grid-cols-7 gap-1.5">
                {WEEK_DAYS.map((d, i) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setWeekDay(i)}
                    className={cn(
                      'py-2.5 rounded-xl text-xs font-semibold transition-all border',
                    )}
                    style={weekDay === i
                      ? { borderColor: 'var(--accent-primary)', color: 'var(--accent-primary)', background: 'color-mix(in srgb, var(--accent-primary) 12%, transparent)' }
                      : { borderColor: 'var(--border)', color: 'var(--text-secondary)' }
                    }
                  >
                    {d}
                  </button>
                ))}
              </div>
              <label className="block text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mt-2">At</label>
              <TimePicker hour={startHour} min={startMin} onHourChange={setStartHour} onMinChange={setStartMin} />
            </div>
          )}

          {/* ── Monthly: Day of month + Time ── */}
          {recurrence === 'monthly' && (
            <div className="space-y-3 p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)]">
              <label className="block text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">On date</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="input-field text-sm"
              />
              <label className="block text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider mt-2">At</label>
              <TimePicker hour={startHour} min={startMin} onHourChange={setStartHour} onMinChange={setStartMin} />
            </div>
          )}
        </div>

        {/* ── End Time ── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-[var(--text-muted)]" />
              <span className="text-sm font-medium text-[var(--text-secondary)]">End Time</span>
              {duration && (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ color: 'var(--accent-primary)', background: 'color-mix(in srgb, var(--accent-primary) 10%, transparent)' }}>
                  {duration}
                </span>
              )}
            </div>
            <Toggle enabled={hasEndTime} onToggle={() => setHasEndTime(!hasEndTime)} />
          </div>

          {hasEndTime && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="p-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)]"
            >
              <TimePicker hour={endHour} min={endMin} onHourChange={setEndHour} onMinChange={setEndMin} />
            </motion.div>
          )}
        </div>

        {/* Tags */}
        <div>
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Tags</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {tags.map((tag) => (
              <span key={tag} className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium" style={{ color: 'var(--accent-primary)', background: 'color-mix(in srgb, var(--accent-primary) 10%, transparent)' }}>
                <Tag size={10} />{tag}
                <button type="button" onClick={() => setTags(tags.filter((t) => t !== tag))} className="hover:text-red-400 ml-0.5"><X size={10} /></button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }} placeholder="Add a tag..." className="input-field flex-1 text-sm" />
            <button type="button" onClick={addTag} className="btn-secondary px-3"><Plus size={16} /></button>
          </div>
        </div>

        {/* Submit */}
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button type="submit" className="btn-primary flex-1">{editTask ? 'Update Task' : 'Create Task'}</button>
        </div>
      </form>
    </Modal>
  );
}

/* ── Simple Time Picker — just use native time input ── */
function TimePicker({ hour, min, onHourChange, onMinChange }: {
  hour: number; min: number;
  onHourChange: (h: number) => void;
  onMinChange: (m: number) => void;
}) {
  const timeValue = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;

  const handleChange = (val: string) => {
    const [h, m] = val.split(':').map(Number);
    if (!isNaN(h) && !isNaN(m)) {
      onHourChange(Math.min(23, Math.max(0, h)));
      onMinChange(Math.min(59, Math.max(0, m)));
    }
  };

  const isPM = hour >= 12;
  const display12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const displayStr = `${display12}:${min.toString().padStart(2, '0')} ${isPM ? 'PM' : 'AM'}`;

  return (
    <div className="flex items-center gap-3">
      <input
        type="time"
        value={timeValue}
        onChange={(e) => handleChange(e.target.value)}
        className="flex-1 h-12 px-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] text-lg font-bold text-[var(--text-primary)] tabular-nums focus:outline-none focus:border-[var(--accent-primary)] focus:ring-2 focus:ring-[var(--accent-primary)]/20"
        aria-label="Select time"
      />
      <span className="text-sm font-medium text-[var(--text-muted)] min-w-[80px]">{displayStr}</span>
    </div>
  );
}

/* ── Toggle ── */
function Toggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="relative w-11 h-6 rounded-full transition-colors"
      style={{ background: enabled ? 'var(--accent-primary)' : 'var(--border)' }}
    >
      <div
        className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform"
        style={{ left: '2px', transform: enabled ? 'translateX(20px)' : 'translateX(0)' }}
      />
    </button>
  );
}
