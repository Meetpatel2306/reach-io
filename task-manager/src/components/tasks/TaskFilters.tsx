'use client';

import { Priority, TaskStatus, Recurrence } from '@/lib/types';
import { useStore } from '@/lib/store';
import { PRIORITY_CONFIG } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { Filter, SortAsc } from 'lucide-react';

export interface TaskFilterState {
  status: TaskStatus | 'all';
  priority: Priority | 'all';
  categoryId: string | 'all';
  recurrence: Recurrence | 'all';
  sortBy: 'date' | 'priority' | 'name' | 'created';
  sortOrder: 'asc' | 'desc';
  search: string;
}

export const DEFAULT_FILTERS: TaskFilterState = {
  status: 'all',
  priority: 'all',
  categoryId: 'all',
  recurrence: 'all',
  sortBy: 'created',
  sortOrder: 'desc',
  search: '',
};

interface TaskFiltersProps {
  filters: TaskFilterState;
  onChange: (filters: TaskFilterState) => void;
}

export default function TaskFilters({ filters, onChange }: TaskFiltersProps) {
  const categories = useStore((s) => s.categories);

  const statusTabs: { value: TaskStatus | 'all'; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'pending', label: 'Pending' },
    { value: 'in-progress', label: 'In Progress' },
    { value: 'completed', label: 'Done' },
  ];

  return (
    <div className="space-y-3">
      {/* Status Tabs */}
      <div className="flex items-center gap-1 bg-[var(--bg-secondary)] p-1 rounded-xl">
        {statusTabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => onChange({ ...filters, status: tab.value })}
            className={cn(
              'flex-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
              filters.status === tab.value
                ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/25'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filter Row */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1 text-[var(--text-muted)]">
          <Filter size={14} />
        </div>

        <select
          value={filters.priority}
          onChange={(e) => onChange({ ...filters, priority: e.target.value as Priority | 'all' })}
          className="input-field py-1.5 text-xs w-auto"
        >
          <option value="all">All Priorities</option>
          {(Object.keys(PRIORITY_CONFIG) as Priority[]).map((p) => (
            <option key={p} value={p}>{PRIORITY_CONFIG[p].label}</option>
          ))}
        </select>

        <select
          value={filters.categoryId}
          onChange={(e) => onChange({ ...filters, categoryId: e.target.value })}
          className="input-field py-1.5 text-xs w-auto"
        >
          <option value="all">All Categories</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>

        <select
          value={filters.recurrence}
          onChange={(e) => onChange({ ...filters, recurrence: e.target.value as Recurrence | 'all' })}
          className="input-field py-1.5 text-xs w-auto"
        >
          <option value="all">All Schedules</option>
          <option value="once">Once</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>

        <div className="flex-1" />

        <div className="flex items-center gap-1">
          <SortAsc size={14} className="text-[var(--text-muted)]" />
          <select
            value={`${filters.sortBy}-${filters.sortOrder}`}
            onChange={(e) => {
              const [sortBy, sortOrder] = e.target.value.split('-') as [TaskFilterState['sortBy'], TaskFilterState['sortOrder']];
              onChange({ ...filters, sortBy, sortOrder });
            }}
            className="input-field py-1.5 text-xs w-auto"
          >
            <option value="created-desc">Newest First</option>
            <option value="created-asc">Oldest First</option>
            <option value="date-asc">Due Date (Soon)</option>
            <option value="date-desc">Due Date (Late)</option>
            <option value="priority-desc">Priority (High)</option>
            <option value="priority-asc">Priority (Low)</option>
            <option value="name-asc">Name (A-Z)</option>
            <option value="name-desc">Name (Z-A)</option>
          </select>
        </div>
      </div>
    </div>
  );
}
