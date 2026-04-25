export type Priority = 'low' | 'medium' | 'high' | 'urgent';
export type Recurrence = 'once' | 'daily' | 'weekly' | 'monthly';
export type TaskStatus = 'pending' | 'in-progress' | 'completed';

export interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  status: TaskStatus;
  categoryId: string | null;
  tags: string[];
  scheduledAt: string | null;
  endAt: string | null;
  notifyOnEnd: boolean;
  recurrence: Recurrence;
  recurrenceDay?: number;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  order: number;
  pomodorosCompleted: number;
  pomodorosEstimated: number;
  notified: boolean;
  endNotified: boolean;
  subtasks: Subtask[];
}

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface PomodoroSession {
  id: string;
  taskId: string | null;
  startedAt: string;
  duration: number;
  type: 'work' | 'break';
}

export interface DayCompletion {
  date: string;
  completed: number;
  created: number;
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  colorTheme: string;
  bgEffect: string;
  soundEnabled: boolean;
  notificationsEnabled: boolean;
  pomodoroWork: number;
  pomodoroBreak: number;
  pomodoroLongBreak: number;
  pomodoroSessionsBeforeLong: number;
  defaultPriority: Priority;
  defaultRecurrence: Recurrence;
  weekStartsOn: 0 | 1;
}

export interface ShareableTaskFile {
  version: string;
  exportedAt: string;
  appName: string;
  tasks: Task[];
  categories: Category[];
}

export interface StreakData {
  current: number;
  longest: number;
  lastCompletionDate: string | null;
}

export interface AppState {
  tasks: Task[];
  categories: Category[];
  pomodoroSessions: PomodoroSession[];
  completionHistory: DayCompletion[];
  settings: AppSettings;
  streak: StreakData;
}
