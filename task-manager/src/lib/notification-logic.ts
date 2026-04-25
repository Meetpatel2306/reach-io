// Pure functions for notification scheduling decisions.
// Extracted so they can be unit tested without a browser, SW, or audio context.
//
// Mirrors the windows used by:
//   - useNotifications.ts foreground check (now <= t < now + 300_000)
//   - sw.js timer scheduling

export const FIRE_WINDOW_MS = 300_000; // 5 minutes

export type ScheduleAction =
  | { kind: 'fire-now'; key: string; type: 'start' | 'end'; taskId: string }
  | { kind: 'schedule'; key: string; type: 'start' | 'end'; taskId: string; delayMs: number }
  | { kind: 'skip'; reason: SkipReason; taskId: string };

export type SkipReason =
  | 'completed'
  | 'no-schedule'
  | 'invalid-date'
  | 'already-notified'
  | 'past-window'
  | 'end-not-requested'
  | 'duplicate-fired'
  | 'notifications-disabled';

export interface MinimalTask {
  id: string;
  status: 'pending' | 'in-progress' | 'completed';
  scheduledAt: string | null;
  endAt: string | null;
  notifyOnEnd: boolean;
  notified: boolean;
  endNotified: boolean;
}

export interface ScheduleOpts {
  notificationsEnabled: boolean;
  alreadyFired: ReadonlySet<string>;
  now: number;
}

export function startKey(taskId: string): string { return `s:${taskId}`; }
export function endKey(taskId: string): string { return `e:${taskId}`; }

function decideOne(
  task: MinimalTask,
  type: 'start' | 'end',
  opts: ScheduleOpts
): ScheduleAction {
  const { notificationsEnabled, alreadyFired, now } = opts;
  const key = type === 'start' ? startKey(task.id) : endKey(task.id);

  if (!notificationsEnabled) return { kind: 'skip', reason: 'notifications-disabled', taskId: task.id };
  if (task.status === 'completed') return { kind: 'skip', reason: 'completed', taskId: task.id };

  if (type === 'start') {
    if (!task.scheduledAt) return { kind: 'skip', reason: 'no-schedule', taskId: task.id };
    if (task.notified) return { kind: 'skip', reason: 'already-notified', taskId: task.id };
  } else {
    if (!task.endAt) return { kind: 'skip', reason: 'no-schedule', taskId: task.id };
    if (!task.notifyOnEnd) return { kind: 'skip', reason: 'end-not-requested', taskId: task.id };
    if (task.endNotified) return { kind: 'skip', reason: 'already-notified', taskId: task.id };
  }

  if (alreadyFired.has(key)) return { kind: 'skip', reason: 'duplicate-fired', taskId: task.id };

  const target = type === 'start' ? task.scheduledAt! : task.endAt!;
  const t = new Date(target).getTime();
  if (Number.isNaN(t)) return { kind: 'skip', reason: 'invalid-date', taskId: task.id };

  const delay = t - now;
  if (delay > 0) {
    return { kind: 'schedule', key, type, taskId: task.id, delayMs: delay };
  }
  // delay <= 0 — already due
  if (delay > -FIRE_WINDOW_MS) {
    return { kind: 'fire-now', key, type, taskId: task.id };
  }
  return { kind: 'skip', reason: 'past-window', taskId: task.id };
}

export function decideStart(task: MinimalTask, opts: ScheduleOpts): ScheduleAction {
  return decideOne(task, 'start', opts);
}

export function decideEnd(task: MinimalTask, opts: ScheduleOpts): ScheduleAction {
  return decideOne(task, 'end', opts);
}

export function planAll(tasks: readonly MinimalTask[], opts: ScheduleOpts): ScheduleAction[] {
  const out: ScheduleAction[] = [];
  for (const task of tasks) {
    out.push(decideStart(task, opts));
    out.push(decideEnd(task, opts));
  }
  return out;
}
