import { describe, it, expect } from 'vitest';
import {
  decideStart,
  decideEnd,
  planAll,
  startKey,
  endKey,
  FIRE_WINDOW_MS,
  type MinimalTask,
  type ScheduleOpts,
} from '@/lib/notification-logic';

const NOW = new Date('2026-04-25T12:00:00.000Z').getTime();

function makeTask(overrides: Partial<MinimalTask> = {}): MinimalTask {
  return {
    id: 't1',
    status: 'pending',
    scheduledAt: new Date(NOW).toISOString(),
    endAt: null,
    notifyOnEnd: false,
    notified: false,
    endNotified: false,
    ...overrides,
  };
}

function opts(over: Partial<ScheduleOpts> = {}): ScheduleOpts {
  return {
    notificationsEnabled: true,
    alreadyFired: new Set(),
    now: NOW,
    ...over,
  };
}

describe('notification-logic — normal cases', () => {
  it('N1: fires immediately when scheduledAt equals now', () => {
    const action = decideStart(makeTask(), opts());
    expect(action.kind).toBe('fire-now');
    if (action.kind === 'fire-now') expect(action.type).toBe('start');
  });

  it('N2: schedules when scheduledAt is in the future', () => {
    const future = new Date(NOW + 60_000).toISOString();
    const action = decideStart(makeTask({ scheduledAt: future }), opts());
    expect(action.kind).toBe('schedule');
    if (action.kind === 'schedule') expect(action.delayMs).toBe(60_000);
  });

  it('N3: skips when scheduledAt is null', () => {
    const action = decideStart(makeTask({ scheduledAt: null }), opts());
    expect(action).toEqual({ kind: 'skip', reason: 'no-schedule', taskId: 't1' });
  });

  it('N4: skips when notified is true', () => {
    const action = decideStart(makeTask({ notified: true }), opts());
    expect(action).toEqual({ kind: 'skip', reason: 'already-notified', taskId: 't1' });
  });

  it('N5: skips when status is completed', () => {
    const action = decideStart(makeTask({ status: 'completed' }), opts());
    expect(action).toEqual({ kind: 'skip', reason: 'completed', taskId: 't1' });
  });

  it('N6: end notification fires when endAt equals now', () => {
    const task = makeTask({ endAt: new Date(NOW).toISOString(), notifyOnEnd: true });
    const action = decideEnd(task, opts());
    expect(action.kind).toBe('fire-now');
    if (action.kind === 'fire-now') expect(action.type).toBe('end');
  });

  it('N7: end skips when notifyOnEnd is false', () => {
    const task = makeTask({ endAt: new Date(NOW).toISOString(), notifyOnEnd: false });
    expect(decideEnd(task, opts()).kind).toBe('skip');
  });

  it('N8: end skips when endNotified is true', () => {
    const task = makeTask({ endAt: new Date(NOW).toISOString(), notifyOnEnd: true, endNotified: true });
    const action = decideEnd(task, opts());
    expect(action).toEqual({ kind: 'skip', reason: 'already-notified', taskId: 't1' });
  });

  it('N9: skips everything when notificationsEnabled is false', () => {
    const action = decideStart(makeTask(), opts({ notificationsEnabled: false }));
    expect(action).toEqual({ kind: 'skip', reason: 'notifications-disabled', taskId: 't1' });
  });

  it('N10: planAll returns one start and one end action per task', () => {
    const tasks = [makeTask({ id: 'a' }), makeTask({ id: 'b' })];
    const actions = planAll(tasks, opts());
    expect(actions).toHaveLength(4);
  });

  it('N11: planAll respects notificationsEnabled = false for every task', () => {
    const tasks = [makeTask({ id: 'a' }), makeTask({ id: 'b' })];
    const actions = planAll(tasks, opts({ notificationsEnabled: false }));
    expect(actions.every((a) => a.kind === 'skip' && a.reason === 'notifications-disabled')).toBe(true);
  });

  it('N12: schedule key is "s:<id>" for start', () => {
    expect(startKey('xyz')).toBe('s:xyz');
  });

  it('N13: schedule key is "e:<id>" for end', () => {
    expect(endKey('xyz')).toBe('e:xyz');
  });

  it('N14: scheduling delay matches future offset', () => {
    const action = decideStart(makeTask({ scheduledAt: new Date(NOW + 3_600_000).toISOString() }), opts());
    if (action.kind !== 'schedule') throw new Error('expected schedule');
    expect(action.delayMs).toBe(3_600_000);
  });

  it('N15: end fires when endAt is just inside fire window past', () => {
    const task = makeTask({ endAt: new Date(NOW - 1000).toISOString(), notifyOnEnd: true });
    expect(decideEnd(task, opts()).kind).toBe('fire-now');
  });

  it('N16: planAll returns fire-now for due tasks and skip for completed', () => {
    const tasks = [
      makeTask({ id: 'due' }),
      makeTask({ id: 'done', status: 'completed' }),
    ];
    const actions = planAll(tasks, opts());
    expect(actions.find((a) => a.taskId === 'due' && a.kind === 'fire-now')).toBeTruthy();
    expect(actions.find((a) => a.taskId === 'done' && a.kind === 'skip')).toBeTruthy();
  });

  it('N17: alreadyFired key prevents re-firing', () => {
    const action = decideStart(makeTask(), opts({ alreadyFired: new Set(['s:t1']) }));
    expect(action).toEqual({ kind: 'skip', reason: 'duplicate-fired', taskId: 't1' });
  });

  it('N18: alreadyFired with end key blocks end only, not start', () => {
    const task = makeTask({ endAt: new Date(NOW).toISOString(), notifyOnEnd: true });
    const o = opts({ alreadyFired: new Set(['e:t1']) });
    expect(decideStart(task, o).kind).toBe('fire-now');
    expect(decideEnd(task, o).kind).toBe('skip');
  });

  it('N19: future end-only task schedules an end action', () => {
    const task = makeTask({
      scheduledAt: null,
      endAt: new Date(NOW + 30_000).toISOString(),
      notifyOnEnd: true,
    });
    const start = decideStart(task, opts());
    const end = decideEnd(task, opts());
    expect(start.kind).toBe('skip');
    expect(end.kind).toBe('schedule');
  });

  it('N20: in-progress task still fires when due (not completed)', () => {
    const action = decideStart(makeTask({ status: 'in-progress' }), opts());
    expect(action.kind).toBe('fire-now');
  });

  it('N21: FIRE_WINDOW_MS is exactly 5 minutes', () => {
    expect(FIRE_WINDOW_MS).toBe(5 * 60 * 1000);
  });
});

describe('notification-logic — hard / edge cases', () => {
  it('H1: invalid date string returns skip with invalid-date', () => {
    const action = decideStart(makeTask({ scheduledAt: 'not-a-date' }), opts());
    expect(action).toEqual({ kind: 'skip', reason: 'invalid-date', taskId: 't1' });
  });

  it('H2: due 6 minutes ago is outside fire window — skipped', () => {
    const past = new Date(NOW - 6 * 60_000).toISOString();
    const action = decideStart(makeTask({ scheduledAt: past }), opts());
    expect(action).toEqual({ kind: 'skip', reason: 'past-window', taskId: 't1' });
  });

  it('H3: due exactly at -FIRE_WINDOW_MS boundary is OUT of window (strict gt check)', () => {
    const past = new Date(NOW - FIRE_WINDOW_MS).toISOString();
    const action = decideStart(makeTask({ scheduledAt: past }), opts());
    expect(action.kind).toBe('skip');
  });

  it('H4: due 1ms inside the window fires', () => {
    const past = new Date(NOW - (FIRE_WINDOW_MS - 1)).toISOString();
    const action = decideStart(makeTask({ scheduledAt: past }), opts());
    expect(action.kind).toBe('fire-now');
  });

  it('H5: zero-millisecond future schedules fire-now (delay <= 0 path)', () => {
    const action = decideStart(makeTask(), opts());
    expect(action.kind).toBe('fire-now');
  });

  it('H6: enormous future date schedules with correct delay (year 9999)', () => {
    const far = new Date('9999-01-01T00:00:00.000Z').toISOString();
    const action = decideStart(makeTask({ scheduledAt: far }), opts());
    expect(action.kind).toBe('schedule');
    if (action.kind === 'schedule') expect(action.delayMs).toBeGreaterThan(0);
  });

  it('H7: empty string scheduledAt is treated as invalid', () => {
    const action = decideStart(makeTask({ scheduledAt: '' }), opts());
    expect(action.kind).toBe('skip');
    if (action.kind === 'skip') expect(['no-schedule', 'invalid-date']).toContain(action.reason);
  });

  it('H8: notificationsEnabled=false short-circuits BEFORE invalid-date check', () => {
    const action = decideStart(
      makeTask({ scheduledAt: 'garbage' }),
      opts({ notificationsEnabled: false })
    );
    expect(action.kind).toBe('skip');
    if (action.kind === 'skip') expect(action.reason).toBe('notifications-disabled');
  });

  it('H9: planAll over a large task list (1000) does not duplicate keys', () => {
    const tasks: MinimalTask[] = [];
    for (let i = 0; i < 1000; i++) tasks.push(makeTask({ id: 'task-' + i }));
    const actions = planAll(tasks, opts());
    const fireKeys = actions.filter((a) => a.kind !== 'skip').map((a) => (a as any).key);
    expect(new Set(fireKeys).size).toBe(fireKeys.length);
  });

  it('H10: same task processed twice with alreadyFired updated between runs', () => {
    const task = makeTask();
    const fired = new Set<string>();
    const first = decideStart(task, opts({ alreadyFired: fired }));
    expect(first.kind).toBe('fire-now');
    if (first.kind === 'fire-now') fired.add(first.key);
    const second = decideStart(task, opts({ alreadyFired: fired }));
    expect(second.kind).toBe('skip');
    if (second.kind === 'skip') expect(second.reason).toBe('duplicate-fired');
  });

  it('H11: end fires before start when both due and end is earlier (rare but valid plan order)', () => {
    // This tests that planAll returns both decisions independently — ordering is per-task: [start, end]
    const task = makeTask({
      scheduledAt: new Date(NOW).toISOString(),
      endAt: new Date(NOW - 1000).toISOString(),
      notifyOnEnd: true,
    });
    const actions = planAll([task], opts());
    expect(actions[0].kind).toBe('fire-now'); // start
    expect((actions[0] as any).type).toBe('start');
    expect(actions[1].kind).toBe('fire-now'); // end
    expect((actions[1] as any).type).toBe('end');
  });

  it('H12: completed task with scheduledAt in past still skipped (not past-window — completed comes first)', () => {
    const action = decideStart(
      makeTask({ status: 'completed', scheduledAt: new Date(NOW - 1_000_000).toISOString() }),
      opts()
    );
    expect(action).toEqual({ kind: 'skip', reason: 'completed', taskId: 't1' });
  });
});
