'use client';

import { useState, useRef } from 'react';
import { Plus, Upload, Download } from 'lucide-react';
import TaskList from '@/components/tasks/TaskList';
import TaskFilters, { TaskFilterState, DEFAULT_FILTERS } from '@/components/tasks/TaskFilters';
import TaskForm from '@/components/tasks/TaskForm';
import { Task } from '@/lib/types';
import { useStore } from '@/lib/store';
import { useToast } from '@/components/ui/Toast';

export default function TasksPage() {
  const [filters, setFilters] = useState<TaskFilterState>(DEFAULT_FILTERS);
  const [showForm, setShowForm] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const exportTaskFile = useStore((s) => s.exportTaskFile);
  const importTaskFile = useStore((s) => s.importTaskFile);
  const { addToast } = useToast();

  const handleEdit = (task: Task) => {
    setEditTask(task);
    setShowForm(true);
  };

  const handleClose = () => {
    setShowForm(false);
    setEditTask(null);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const result = await importTaskFile(file);
    if (result.success) {
      addToast(`Imported ${result.count} tasks!`, 'success');
    } else {
      addToast('Failed to import task file', 'error');
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Tasks</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">Manage and organize your tasks</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => exportTaskFile()} className="btn-secondary flex items-center gap-2 text-sm">
            <Download size={16} /> Export
          </button>
          <button onClick={() => fileInputRef.current?.click()} className="btn-secondary flex items-center gap-2 text-sm">
            <Upload size={16} /> Import
          </button>
          <input ref={fileInputRef} type="file" accept=".taskpro,.json" onChange={handleImportFile} className="hidden" />
          <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
            <Plus size={18} /> New Task
          </button>
        </div>
      </div>

      {/* Filters */}
      <TaskFilters filters={filters} onChange={setFilters} />

      {/* Task List */}
      <TaskList filters={filters} onEdit={handleEdit} />

      {/* Form Modal */}
      <TaskForm isOpen={showForm} onClose={handleClose} editTask={editTask} />
    </div>
  );
}
