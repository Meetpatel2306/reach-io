'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Task, Category, PomodoroSession, DayCompletion, AppSettings, StreakData, Subtask, ShareableTaskFile } from './types';
import { DEFAULT_CATEGORIES, DEFAULT_SETTINGS, APP_VERSION, APP_NAME, TASK_FILE_EXTENSION } from './constants';
import { generateId, getDateKey, downloadFile, readFileAsText } from './utils';

interface TaskStore {
  tasks: Task[];
  categories: Category[];
  pomodoroSessions: PomodoroSession[];
  completionHistory: DayCompletion[];
  settings: AppSettings;
  streak: StreakData;
  _hasHydrated: boolean;
  setHasHydrated: (state: boolean) => void;

  // Task actions
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'order' | 'pomodorosCompleted' | 'notified' | 'endNotified'>) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  toggleComplete: (id: string) => void;
  reorderTasks: (tasks: Task[]) => void;
  addSubtask: (taskId: string, title: string) => void;
  toggleSubtask: (taskId: string, subtaskId: string) => void;
  deleteSubtask: (taskId: string, subtaskId: string) => void;

  // Category actions
  addCategory: (category: Omit<Category, 'id'>) => void;
  updateCategory: (id: string, updates: Partial<Category>) => void;
  deleteCategory: (id: string) => void;

  // Pomodoro actions
  addPomodoroSession: (session: Omit<PomodoroSession, 'id'>) => void;

  // Settings actions
  updateSettings: (updates: Partial<AppSettings>) => void;

  // Data actions
  exportData: () => string;
  importData: (jsonString: string) => boolean;
  exportTaskFile: (taskIds?: string[]) => void;
  importTaskFile: (file: File) => Promise<{ success: boolean; count: number }>;
  clearAllData: () => void;

  // Streak
  updateStreak: () => void;

  // Completion history
  recordCompletion: () => void;
}

export const useStore = create<TaskStore>()(
  persist(
    (set, get) => ({
      tasks: [],
      categories: DEFAULT_CATEGORIES,
      pomodoroSessions: [],
      completionHistory: [],
      settings: DEFAULT_SETTINGS,
      streak: { current: 0, longest: 0, lastCompletionDate: null },
      _hasHydrated: false,
      setHasHydrated: (state) => set({ _hasHydrated: state }),

      addTask: (taskData) => {
        const task: Task = {
          ...taskData,
          id: generateId(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          order: get().tasks.length,
          pomodorosCompleted: 0,
          notified: false,
          endNotified: false,
        };
        set((state) => ({ tasks: [...state.tasks, task] }));
      },

      updateTask: (id, updates) => {
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t
          ),
        }));
      },

      deleteTask: (id) => {
        set((state) => ({ tasks: state.tasks.filter((t) => t.id !== id) }));
      },

      toggleComplete: (id) => {
        const task = get().tasks.find((t) => t.id === id);
        if (!task) return;
        const isCompleting = task.status !== 'completed';
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === id
              ? {
                  ...t,
                  status: isCompleting ? 'completed' : 'pending',
                  completedAt: isCompleting ? new Date().toISOString() : null,
                  notified: isCompleting ? true : t.notified,
                  endNotified: isCompleting ? true : t.endNotified,
                  updatedAt: new Date().toISOString(),
                }
              : t
          ),
        }));
        if (isCompleting) {
          get().recordCompletion();
          get().updateStreak();
        }
      },

      reorderTasks: (tasks) => {
        set({ tasks: tasks.map((t, i) => ({ ...t, order: i })) });
      },

      addSubtask: (taskId, title) => {
        const subtask: Subtask = { id: generateId(), title, completed: false };
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === taskId ? { ...t, subtasks: [...t.subtasks, subtask] } : t
          ),
        }));
      },

      toggleSubtask: (taskId, subtaskId) => {
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  subtasks: t.subtasks.map((s) =>
                    s.id === subtaskId ? { ...s, completed: !s.completed } : s
                  ),
                }
              : t
          ),
        }));
      },

      deleteSubtask: (taskId, subtaskId) => {
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === taskId
              ? { ...t, subtasks: t.subtasks.filter((s) => s.id !== subtaskId) }
              : t
          ),
        }));
      },

      addCategory: (categoryData) => {
        const category: Category = { ...categoryData, id: generateId() };
        set((state) => ({ categories: [...state.categories, category] }));
      },

      updateCategory: (id, updates) => {
        set((state) => ({
          categories: state.categories.map((c) => (c.id === id ? { ...c, ...updates } : c)),
        }));
      },

      deleteCategory: (id) => {
        set((state) => ({
          categories: state.categories.filter((c) => c.id !== id),
          tasks: state.tasks.map((t) => (t.categoryId === id ? { ...t, categoryId: null } : t)),
        }));
      },

      addPomodoroSession: (sessionData) => {
        const session: PomodoroSession = { ...sessionData, id: generateId() };
        set((state) => ({ pomodoroSessions: [...state.pomodoroSessions, session] }));
        if (sessionData.taskId && sessionData.type === 'work') {
          const task = get().tasks.find((t) => t.id === sessionData.taskId);
          if (task) {
            get().updateTask(task.id, { pomodorosCompleted: task.pomodorosCompleted + 1 });
          }
        }
      },

      updateSettings: (updates) => {
        set((state) => ({ settings: { ...state.settings, ...updates } }));
      },

      exportData: () => {
        const state = get();
        return JSON.stringify({
          version: APP_VERSION,
          exportedAt: new Date().toISOString(),
          appName: APP_NAME,
          tasks: state.tasks,
          categories: state.categories,
          pomodoroSessions: state.pomodoroSessions,
          completionHistory: state.completionHistory,
          settings: state.settings,
          streak: state.streak,
        }, null, 2);
      },

      importData: (jsonString) => {
        try {
          const data = JSON.parse(jsonString);
          if (!data.tasks || !Array.isArray(data.tasks)) return false;
          set({
            tasks: data.tasks,
            categories: data.categories || DEFAULT_CATEGORIES,
            pomodoroSessions: data.pomodoroSessions || [],
            completionHistory: data.completionHistory || [],
            settings: { ...DEFAULT_SETTINGS, ...data.settings },
            streak: data.streak || { current: 0, longest: 0, lastCompletionDate: null },
          });
          return true;
        } catch {
          return false;
        }
      },

      exportTaskFile: (taskIds) => {
        const state = get();
        const tasksToExport = taskIds
          ? state.tasks.filter((t) => taskIds.includes(t.id))
          : state.tasks;
        const fileData: ShareableTaskFile = {
          version: APP_VERSION,
          exportedAt: new Date().toISOString(),
          appName: APP_NAME,
          tasks: tasksToExport,
          categories: state.categories,
        };
        const content = JSON.stringify(fileData, null, 2);
        const filename = `tasks-${new Date().toISOString().split('T')[0]}${TASK_FILE_EXTENSION}`;
        downloadFile(content, filename, 'application/json');
      },

      importTaskFile: async (file) => {
        try {
          const content = await readFileAsText(file);
          const data: ShareableTaskFile = JSON.parse(content);
          if (!data.tasks || !Array.isArray(data.tasks) || data.appName !== APP_NAME) {
            return { success: false, count: 0 };
          }
          const existingIds = new Set(get().tasks.map((t) => t.id));
          const newTasks = data.tasks
            .filter((t) => !existingIds.has(t.id))
            .map((t) => ({ ...t, id: generateId(), order: get().tasks.length }));

          const existingCatIds = new Set(get().categories.map((c) => c.id));
          const newCategories = (data.categories || []).filter((c) => !existingCatIds.has(c.id));

          set((state) => ({
            tasks: [...state.tasks, ...newTasks],
            categories: [...state.categories, ...newCategories],
          }));
          return { success: true, count: newTasks.length };
        } catch {
          return { success: false, count: 0 };
        }
      },

      clearAllData: () => {
        set({
          tasks: [],
          categories: DEFAULT_CATEGORIES,
          pomodoroSessions: [],
          completionHistory: [],
          settings: DEFAULT_SETTINGS,
          streak: { current: 0, longest: 0, lastCompletionDate: null },
        });
      },

      updateStreak: () => {
        const today = getDateKey(new Date());
        const { streak } = get();

        if (streak.lastCompletionDate === today) return;

        const yesterday = getDateKey(new Date(Date.now() - 86400000));
        const newCurrent = streak.lastCompletionDate === yesterday ? streak.current + 1 : 1;
        const newLongest = Math.max(streak.longest, newCurrent);

        set({
          streak: { current: newCurrent, longest: newLongest, lastCompletionDate: today },
        });
      },

      recordCompletion: () => {
        const today = getDateKey(new Date());
        set((state) => {
          const existing = state.completionHistory.find((h) => h.date === today);
          if (existing) {
            return {
              completionHistory: state.completionHistory.map((h) =>
                h.date === today ? { ...h, completed: h.completed + 1 } : h
              ),
            };
          }
          return {
            completionHistory: [...state.completionHistory, { date: today, completed: 1, created: 0 }],
          };
        });
      },
    }),
    {
      name: 'task-manager-pro-storage',
      storage: createJSONStorage(() => {
        if (typeof window === 'undefined') {
          return { getItem: () => null, setItem: () => {}, removeItem: () => {} };
        }
        return localStorage;
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
