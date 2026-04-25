import { Task } from './types';

export function getNextOccurrence(task: Task): Date | null {
  if (!task.scheduledAt) return null;
  const scheduled = new Date(task.scheduledAt);
  if (isNaN(scheduled.getTime())) return null;
  const now = new Date();

  if (task.recurrence === 'once') return scheduled;

  const next = new Date(scheduled);
  let safety = 0;

  switch (task.recurrence) {
    case 'daily':
      while (next <= now && safety++ < 400) next.setDate(next.getDate() + 1);
      break;
    case 'weekly':
      while (next <= now && safety++ < 200) next.setDate(next.getDate() + 7);
      break;
    case 'monthly':
      while (next <= now && safety++ < 100) {
        const day = next.getDate();
        next.setMonth(next.getMonth() + 1);
        // Handle month overflow (e.g. Jan 31 -> Feb 28)
        if (next.getDate() !== day) next.setDate(0);
      }
      break;
  }

  return safety >= 400 ? null : next;
}

export function isDue(task: Task, now: Date = new Date()): boolean {
  if (!task.scheduledAt || task.status === 'completed' || task.notified) return false;

  const scheduled = task.recurrence === 'once'
    ? new Date(task.scheduledAt)
    : getNextOccurrence(task);

  if (!scheduled || isNaN(scheduled.getTime())) return false;

  const diff = now.getTime() - scheduled.getTime();
  return diff >= -60000 && diff < 300000; // 1 min before to 5 min after
}

export function createRecurringInstance(task: Task): Task | null {
  if (task.recurrence === 'once') return null;

  const nextDate = getNextOccurrence(task);
  if (!nextDate) return null;

  let newEndAt: string | null = null;
  if (task.endAt && task.scheduledAt) {
    const startMs = new Date(task.scheduledAt).getTime();
    const endMs = new Date(task.endAt).getTime();
    if (!isNaN(startMs) && !isNaN(endMs)) {
      newEndAt = new Date(nextDate.getTime() + (endMs - startMs)).toISOString();
    }
  }

  return {
    ...task,
    id: '',
    status: 'pending',
    completedAt: null,
    scheduledAt: nextDate.toISOString(),
    endAt: newEndAt,
    notifyOnEnd: task.notifyOnEnd,
    notified: false,
    endNotified: false,
    pomodorosCompleted: 0,
    subtasks: task.subtasks.map((s) => ({ ...s, completed: false })),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
