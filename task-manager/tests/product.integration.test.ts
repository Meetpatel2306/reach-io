// Product-wide integration tests — exercise multiple modules end-to-end:
// store + scheduler + notification-logic + persistence
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useStore } from '@/lib/store';
import { planAll, type MinimalTask } from '@/lib/notification-logic';
import { isDue, getNextOccurrence, createRecurringInstance } from '@/lib/scheduler';

function resetStore() {
  useStore.setState({
    tasks: [],
    pomodoroSessions: [],
    completionHistory: [],
    streak: { current: 0, longest: 0, lastCompletionDate: null },
    settings: { ...useStore.getState().settings, notificationsEnabled: true },
  });
}

function freezeNow(iso: string) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(iso));
}

function asMinimal(t: any): MinimalTask {
  return {
    id: t.id, status: t.status, scheduledAt: t.scheduledAt, endAt: t.endAt,
    notifyOnEnd: t.notifyOnEnd, notified: t.notified, endNotified: t.endNotified,
  };
}

describe('PRODUCT INTEGRATION', () => {
  beforeEach(() => { resetStore(); localStorage.clear(); });
  afterEach(() => { vi.useRealTimers(); });

  it('P1: end-to-end — create scheduled task, plan fires it, mark notified, plan skips it', () => {
    freezeNow('2026-04-25T12:00:00Z');
    useStore.getState().addTask({
      title: 'Standup', description: '', priority: 'high', status: 'pending',
      categoryId: null, tags: [], scheduledAt: '2026-04-25T12:00:00Z', endAt: null,
      notifyOnEnd: false, recurrence: 'once', completedAt: null,
      pomodorosEstimated: 1, subtasks: [],
    });
    const t1 = useStore.getState().tasks[0];

    let actions = planAll([asMinimal(t1)], { notificationsEnabled: true, alreadyFired: new Set(), now: Date.now() });
    expect(actions[0].kind).toBe('fire-now');

    useStore.getState().updateTask(t1.id, { notified: true });
    const t1After = useStore.getState().tasks[0];

    actions = planAll([asMinimal(t1After)], { notificationsEnabled: true, alreadyFired: new Set(), now: Date.now() });
    expect(actions[0].kind).toBe('skip');
    if (actions[0].kind === 'skip') expect(actions[0].reason).toBe('already-notified');
  });

  it('P2: turning off notificationsEnabled stops every fire across many tasks', () => {
    freezeNow('2026-04-25T12:00:00Z');
    for (let i = 0; i < 10; i++) {
      useStore.getState().addTask({
        title: 'T' + i, description: '', priority: 'medium', status: 'pending',
        categoryId: null, tags: [], scheduledAt: '2026-04-25T12:00:00Z',
        endAt: '2026-04-25T13:00:00Z', notifyOnEnd: true, recurrence: 'once',
        completedAt: null, pomodorosEstimated: 1, subtasks: [],
      });
    }
    const tasks = useStore.getState().tasks.map(asMinimal);

    const enabledActions = planAll(tasks, { notificationsEnabled: true, alreadyFired: new Set(), now: Date.now() });
    expect(enabledActions.filter((a) => a.kind === 'fire-now')).toHaveLength(10);

    const disabledActions = planAll(tasks, { notificationsEnabled: false, alreadyFired: new Set(), now: Date.now() });
    expect(disabledActions.every((a) => a.kind === 'skip')).toBe(true);
  });

  it('P3: persist + rehydrate — store survives JSON round-trip and notifications still plan correctly', () => {
    freezeNow('2026-04-25T12:00:00Z');
    useStore.getState().addTask({
      title: 'Lunch', description: '', priority: 'low', status: 'pending',
      categoryId: null, tags: ['food'], scheduledAt: '2026-04-25T13:00:00Z', endAt: null,
      notifyOnEnd: false, recurrence: 'once', completedAt: null,
      pomodorosEstimated: 1, subtasks: [],
    });
    const json = useStore.getState().exportData();

    // Wipe + reimport
    useStore.getState().clearAllData();
    expect(useStore.getState().tasks).toHaveLength(0);
    const ok = useStore.getState().importData(json);
    expect(ok).toBe(true);
    expect(useStore.getState().tasks).toHaveLength(1);

    const tasks = useStore.getState().tasks.map(asMinimal);
    const plan = planAll(tasks, { notificationsEnabled: true, alreadyFired: new Set(), now: Date.now() });
    expect(plan[0].kind).toBe('schedule'); // 1 hour in the future
    if (plan[0].kind === 'schedule') expect(plan[0].delayMs).toBe(3_600_000);
  });

  it('P4: recurring task lifecycle — daily task instance generated, isDue cycles correctly', () => {
    freezeNow('2026-04-25T12:00:00Z');
    useStore.getState().addTask({
      title: 'Daily Review', description: '', priority: 'medium', status: 'pending',
      categoryId: null, tags: [], scheduledAt: '2026-04-20T17:00:00Z',
      endAt: '2026-04-20T17:30:00Z', notifyOnEnd: true, recurrence: 'daily',
      completedAt: null, pomodorosEstimated: 1, subtasks: [],
    });
    const t = useStore.getState().tasks[0];
    const next = getNextOccurrence(t)!;
    expect(next.getTime()).toBeGreaterThan(Date.now());

    const instance = createRecurringInstance(t)!;
    expect(instance.scheduledAt).toBe(next.toISOString());
    // duration preserved (30 min)
    const dur = new Date(instance.endAt!).getTime() - new Date(instance.scheduledAt!).getTime();
    expect(dur).toBe(30 * 60 * 1000);
    expect(instance.notified).toBe(false);
    expect(instance.status).toBe('pending');

    // While original is "now" + 5h-ish, isDue must be false
    expect(isDue(t)).toBe(false);
  });

  it('P5: simulated load — 200 mixed tasks, notifications plan only the due ones, no key collisions', () => {
    freezeNow('2026-04-25T12:00:00Z');
    const now = Date.now();
    for (let i = 0; i < 200; i++) {
      const offset = (i - 50) * 60_000; // half past, half future
      useStore.getState().addTask({
        title: 'Bulk ' + i, description: '', priority: 'low', status: i % 17 === 0 ? 'completed' : 'pending',
        categoryId: null, tags: [], scheduledAt: new Date(now + offset).toISOString(),
        endAt: i % 3 === 0 ? new Date(now + offset + 30_000).toISOString() : null,
        notifyOnEnd: i % 3 === 0, recurrence: 'once', completedAt: null,
        pomodorosEstimated: 1, subtasks: [],
      });
    }

    const tasks = useStore.getState().tasks.map(asMinimal);
    const actions = planAll(tasks, { notificationsEnabled: true, alreadyFired: new Set(), now });

    // 1 action per (start,end) per task
    expect(actions).toHaveLength(400);

    // No completed task fires
    const completedIds = new Set(useStore.getState().tasks.filter((t) => t.status === 'completed').map((t) => t.id));
    expect(actions.filter((a) => a.kind !== 'skip' && completedIds.has(a.taskId))).toHaveLength(0);

    // Keys for fire/schedule are unique
    const keys = actions.filter((a) => a.kind !== 'skip').map((a) => (a as any).key);
    expect(new Set(keys).size).toBe(keys.length);

    // At least some fires happened (tasks within 5-min past window)
    const fires = actions.filter((a) => a.kind === 'fire-now');
    expect(fires.length).toBeGreaterThan(0);
  });
});
