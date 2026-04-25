'use client';

import { useMemo } from 'react';
import { AnimatePresence } from 'framer-motion';
import { ClipboardList } from 'lucide-react';
import TaskCard from './TaskCard';
import { TaskFilterState } from './TaskFilters';
import { Task, Priority } from '@/lib/types';
import { useStore } from '@/lib/store';

const PRIORITY_ORDER: Record<Priority, number> = { urgent: 4, high: 3, medium: 2, low: 1 };

interface TaskListProps {
  filters: TaskFilterState;
  onEdit: (task: Task) => void;
  onStartPomodoro?: (taskId: string) => void;
}

export default function TaskList({ filters, onEdit, onStartPomodoro }: TaskListProps) {
  const tasks = useStore((s) => s.tasks);

  const filteredTasks = useMemo(() => {
    let result = [...tasks];

    // Filter by search
    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(
        (t) => t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q) || t.tags.some((tag) => tag.toLowerCase().includes(q))
      );
    }

    // Filter by status
    if (filters.status !== 'all') {
      result = result.filter((t) => t.status === filters.status);
    }

    // Filter by priority
    if (filters.priority !== 'all') {
      result = result.filter((t) => t.priority === filters.priority);
    }

    // Filter by category
    if (filters.categoryId !== 'all') {
      result = result.filter((t) => t.categoryId === filters.categoryId);
    }

    // Filter by recurrence
    if (filters.recurrence !== 'all') {
      result = result.filter((t) => t.recurrence === filters.recurrence);
    }

    // Sort
    result.sort((a, b) => {
      const dir = filters.sortOrder === 'asc' ? 1 : -1;
      switch (filters.sortBy) {
        case 'name':
          return dir * a.title.localeCompare(b.title);
        case 'priority':
          return dir * (PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
        case 'date':
          if (!a.scheduledAt && !b.scheduledAt) return 0;
          if (!a.scheduledAt) return 1;
          if (!b.scheduledAt) return -1;
          return dir * (new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
        case 'created':
        default:
          return dir * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      }
    });

    return result;
  }, [tasks, filters]);

  if (filteredTasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-20 h-20 rounded-2xl bg-primary-500/10 flex items-center justify-center mb-4">
          <ClipboardList size={36} className="text-primary-400" />
        </div>
        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">No tasks found</h3>
        <p className="text-sm text-[var(--text-muted)] max-w-sm">
          {tasks.length === 0
            ? 'Create your first task to get started!'
            : 'Try adjusting your filters to find what you\'re looking for.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <AnimatePresence mode="popLayout">
        {filteredTasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onEdit={onEdit}
            onStartPomodoro={onStartPomodoro}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
