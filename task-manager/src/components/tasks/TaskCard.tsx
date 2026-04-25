'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Check, Edit3, Trash2, Calendar, Tag, Share2,
} from 'lucide-react';
import { Task } from '@/lib/types';
import { useStore } from '@/lib/store';
import { PRIORITY_CONFIG } from '@/lib/constants';
import { cn, formatRelative, isOverdue, truncate } from '@/lib/utils';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

interface TaskCardProps {
  task: Task;
  onEdit: (task: Task) => void;
  onStartPomodoro?: (taskId: string) => void;
  dragHandleProps?: any;
  compact?: boolean;
}

export default function TaskCard({ task, onEdit, onStartPomodoro, dragHandleProps, compact }: TaskCardProps) {
  const toggleComplete = useStore((s) => s.toggleComplete);
  const deleteTask = useStore((s) => s.deleteTask);
  const exportTaskFile = useStore((s) => s.exportTaskFile);
  const categories = useStore((s) => s.categories);

  const [showDelete, setShowDelete] = useState(false);

  const category = task.categoryId ? categories.find((c) => c.id === task.categoryId) : null;
  const isComplete = task.status === 'completed';
  const overdue = task.scheduledAt && !isComplete && isOverdue(task.scheduledAt);

  return (
    <>
      <motion.div
        layout
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className={cn(
          `glass-card priority-stripe-${task.priority} p-4 group`,
          isComplete && 'opacity-60',
          overdue && `glow-${task.priority}`,
          compact && 'p-3'
        )}
      >
        <div className="flex items-start gap-3">
          {/* Checkbox */}
          <button
            onClick={() => toggleComplete(task.id)}
            className={cn(
              'mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all',
              isComplete
                ? 'bg-green-500 border-green-500'
                : `border-[var(--text-muted)] hover:border-primary-400`
            )}
          >
            {isComplete && <Check size={12} className="text-white" />}
          </button>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3
                className={cn(
                  'font-medium text-[var(--text-primary)] truncate',
                  isComplete && 'line-through text-[var(--text-muted)]'
                )}
              >
                {task.title}
              </h3>
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded-md uppercase"
                style={{ color: PRIORITY_CONFIG[task.priority].color, background: PRIORITY_CONFIG[task.priority].color + '15' }}
              >
                {task.priority}
              </span>
            </div>

            {task.description && !compact && (
              <p className="text-sm text-[var(--text-secondary)] mt-1 line-clamp-2">
                {task.description}
              </p>
            )}

            {/* Meta */}
            <div className="flex items-center flex-wrap gap-2 mt-2">
              {category && (
                <span
                  className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                  style={{ color: category.color, background: category.color + '15' }}
                >
                  {category.name}
                </span>
              )}
              {task.tags.map((tag) => (
                <span key={tag} className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-[var(--text-muted)]">
                  <Tag size={8} />{tag}
                </span>
              ))}
              {task.scheduledAt && (
                <span className={cn('flex items-center gap-1 text-[10px]', overdue ? 'text-red-400' : 'text-[var(--text-muted)]')}>
                  <Calendar size={10} />
                  {formatRelative(task.scheduledAt)}
                  {task.endAt && ` \u2192 ${formatRelative(task.endAt)}`}
                </span>
              )}
              {task.recurrence !== 'once' && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full accent-bg-soft accent-text">
                  {task.recurrence}
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => exportTaskFile([task.id])} className="p-1.5 rounded-lg hover:bg-white/10 text-[var(--text-muted)]" title="Share as file">
              <Share2 size={14} />
            </button>
            <button onClick={() => onEdit(task)} className="p-1.5 rounded-lg hover:bg-white/10 text-[var(--text-muted)]" title="Edit">
              <Edit3 size={14} />
            </button>
            <button onClick={() => setShowDelete(true)} className="p-1.5 rounded-lg hover:bg-white/10 text-red-400/60 hover:text-red-400" title="Delete">
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </motion.div>

      <ConfirmDialog
        isOpen={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={() => deleteTask(task.id)}
        title="Delete Task"
        message={`Are you sure you want to delete "${truncate(task.title, 30)}"?`}
        confirmText="Delete"
        danger
      />
    </>
  );
}
