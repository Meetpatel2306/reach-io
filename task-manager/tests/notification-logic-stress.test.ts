import { describe, it, expect } from 'vitest';
import { planAll, decideStart, decideEnd, type MinimalTask, FIRE_WINDOW_MS } from '@/lib/notification-logic';

const NOW = new Date('2026-04-25T12:00:00Z').getTime();

function task(over: Partial<MinimalTask> = {}): MinimalTask {
  return {
    id: 't', status: 'pending', scheduledAt: null, endAt: null,
    notifyOnEnd: false, notified: false, endNotified: false, ...over,
  };
}

describe('notification-logic — stress + property tests', () => {
  it('ST1: planAll on empty list returns empty array', () => {
    expect(planAll([], { notificationsEnabled: true, alreadyFired: new Set(), now: NOW })).toEqual([]);
  });

  it('ST2: planAll on 10,000 future tasks all schedule, no fires', () => {
    const tasks: MinimalTask[] = [];
    for (let i = 0; i < 10000; i++) {
      tasks.push(task({ id: 't' + i, scheduledAt: new Date(NOW + (i + 1) * 1000).toISOString() }));
    }
    const t0 = performance.now();
    const actions = planAll(tasks, { notificationsEnabled: true, alreadyFired: new Set(), now: NOW });
    const elapsed = performance.now() - t0;
    expect(actions).toHaveLength(20000); // start+end each
    const schedules = actions.filter((a) => a.kind === 'schedule');
    expect(schedules).toHaveLength(10000);
    expect(elapsed).toBeLessThan(500); // 500ms ceiling for 20k decisions
  });

  it('ST3: alreadyFired set with 1000 keys correctly blocks re-firing', () => {
    const tasks: MinimalTask[] = [];
    const fired = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      tasks.push(task({ id: 'x' + i, scheduledAt: new Date(NOW).toISOString() }));
      fired.add('s:x' + i);
    }
    const actions = planAll(tasks, { notificationsEnabled: true, alreadyFired: fired, now: NOW });
    const fires = actions.filter((a) => a.kind === 'fire-now');
    expect(fires).toHaveLength(0);
  });

  it('ST4: every action has a taskId matching its source task', () => {
    const tasks: MinimalTask[] = [];
    for (let i = 0; i < 50; i++) tasks.push(task({ id: 'k' + i, scheduledAt: new Date(NOW).toISOString() }));
    const actions = planAll(tasks, { notificationsEnabled: true, alreadyFired: new Set(), now: NOW });
    for (let i = 0; i < tasks.length; i++) {
      expect(actions[i * 2].taskId).toBe(tasks[i].id);
      expect(actions[i * 2 + 1].taskId).toBe(tasks[i].id);
    }
  });

  it('ST5: decideStart is deterministic for identical inputs', () => {
    const t = task({ scheduledAt: new Date(NOW).toISOString() });
    const a = decideStart(t, { notificationsEnabled: true, alreadyFired: new Set(), now: NOW });
    const b = decideStart(t, { notificationsEnabled: true, alreadyFired: new Set(), now: NOW });
    expect(a).toEqual(b);
  });

  it('ST6: random-fuzz inputs never throw', () => {
    const random = (n: number) => Math.floor(Math.random() * n);
    for (let i = 0; i < 200; i++) {
      const offset = (random(1_000_000) - 500_000); // ±~6 days
      const scheduledAt = random(10) === 0 ? null : new Date(NOW + offset).toISOString();
      const endAt = random(3) === 0 ? new Date(NOW + offset + random(60_000)).toISOString() : null;
      const t = task({
        id: 'fuzz-' + i,
        scheduledAt,
        endAt,
        notifyOnEnd: random(2) === 0,
        notified: random(2) === 0,
        endNotified: random(2) === 0,
        status: random(4) === 0 ? 'completed' : 'pending',
      });
      expect(() => {
        decideStart(t, { notificationsEnabled: random(2) === 0, alreadyFired: new Set(), now: NOW });
        decideEnd(t, { notificationsEnabled: random(2) === 0, alreadyFired: new Set(), now: NOW });
      }).not.toThrow();
    }
  });

  it('ST7: schedule delays are positive (never negative)', () => {
    const tasks: MinimalTask[] = [];
    for (let i = 1; i <= 100; i++) {
      tasks.push(task({ id: 'p' + i, scheduledAt: new Date(NOW + i * 60_000).toISOString() }));
    }
    const actions = planAll(tasks, { notificationsEnabled: true, alreadyFired: new Set(), now: NOW });
    for (const a of actions) {
      if (a.kind === 'schedule') expect(a.delayMs).toBeGreaterThan(0);
    }
  });

  it('ST8: tasks distributed exactly across the fire-window boundary', () => {
    const offsets = [-FIRE_WINDOW_MS - 1, -FIRE_WINDOW_MS, -FIRE_WINDOW_MS + 1, -1, 0, 1, 60_000];
    const tasks = offsets.map((o, i) => task({ id: 'b' + i, scheduledAt: new Date(NOW + o).toISOString() }));
    const actions = offsets.map((_, i) => decideStart(tasks[i], { notificationsEnabled: true, alreadyFired: new Set(), now: NOW }));
    expect(actions[0].kind).toBe('skip'); // -window-1ms (past-window)
    expect(actions[1].kind).toBe('skip'); // exactly -window (out)
    expect(actions[2].kind).toBe('fire-now'); // -window+1ms (in)
    expect(actions[3].kind).toBe('fire-now'); // -1ms
    expect(actions[4].kind).toBe('fire-now'); // 0
    expect(actions[5].kind).toBe('schedule'); // +1ms
    expect(actions[6].kind).toBe('schedule'); // +60s
  });

  it('ST9: "completed" check happens BEFORE invalid-date check', () => {
    const t = task({ status: 'completed', scheduledAt: 'invalid-but-irrelevant' });
    const a = decideStart(t, { notificationsEnabled: true, alreadyFired: new Set(), now: NOW });
    expect(a.kind).toBe('skip');
    if (a.kind === 'skip') expect(a.reason).toBe('completed');
  });

  it('ST10: planAll output ordering: start always immediately before end for same task', () => {
    const tasks: MinimalTask[] = [];
    for (let i = 0; i < 20; i++) {
      tasks.push(task({
        id: 'o' + i,
        scheduledAt: new Date(NOW).toISOString(),
        endAt: new Date(NOW + 1000).toISOString(),
        notifyOnEnd: true,
      }));
    }
    const actions = planAll(tasks, { notificationsEnabled: true, alreadyFired: new Set(), now: NOW });
    for (let i = 0; i < tasks.length; i++) {
      const start = actions[i * 2];
      const end = actions[i * 2 + 1];
      if (start.kind !== 'skip') expect((start as any).type).toBe('start');
      if (end.kind !== 'skip') expect((end as any).type).toBe('end');
      expect(start.taskId).toBe(end.taskId);
    }
  });
});
