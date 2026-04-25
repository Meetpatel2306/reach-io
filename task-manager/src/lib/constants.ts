import { Category, AppSettings, Priority } from './types';

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'work', name: 'Work', color: '#6366f1', icon: 'Briefcase' },
  { id: 'personal', name: 'Personal', color: '#8b5cf6', icon: 'User' },
  { id: 'health', name: 'Health', color: '#10b981', icon: 'Heart' },
  { id: 'learning', name: 'Learning', color: '#f59e0b', icon: 'BookOpen' },
  { id: 'finance', name: 'Finance', color: '#06b6d4', icon: 'DollarSign' },
  { id: 'shopping', name: 'Shopping', color: '#ec4899', icon: 'ShoppingCart' },
  { id: 'home', name: 'Home', color: '#f97316', icon: 'Home' },
  { id: 'social', name: 'Social', color: '#14b8a6', icon: 'Users' },
];

export const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; bg: string; glow: string }> = {
  low: { label: 'Low', color: '#3b82f6', bg: 'bg-blue-500/10', glow: 'shadow-blue-500/20' },
  medium: { label: 'Medium', color: '#f59e0b', bg: 'bg-amber-500/10', glow: 'shadow-amber-500/20' },
  high: { label: 'High', color: '#f97316', bg: 'bg-orange-500/10', glow: 'shadow-orange-500/20' },
  urgent: { label: 'Urgent', color: '#ef4444', bg: 'bg-red-500/10', glow: 'shadow-red-500/20' },
};

export const RECURRENCE_OPTIONS = [
  { value: 'once', label: 'Once', description: 'One-time task' },
  { value: 'daily', label: 'Daily', description: 'Repeats every day' },
  { value: 'weekly', label: 'Weekly', description: 'Repeats every week' },
  { value: 'monthly', label: 'Monthly', description: 'Repeats every month' },
] as const;

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  colorTheme: 'violet',
  bgEffect: 'orbs',
  soundEnabled: true,
  notificationsEnabled: true,
  pomodoroWork: 25,
  pomodoroBreak: 5,
  pomodoroLongBreak: 15,
  pomodoroSessionsBeforeLong: 4,
  defaultPriority: 'medium',
  defaultRecurrence: 'once',
  weekStartsOn: 1,
};

export const TASK_FILE_EXTENSION = '.taskpro';
export const TASK_FILE_MIME = 'application/x-taskpro';
export const APP_VERSION = '1.0.0';
export const APP_NAME = 'TaskManager Pro';

export const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
