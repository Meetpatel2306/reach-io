import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getNextOccurrence, isDue, createRecurringInstance } from '@/lib/scheduler';
import type { Task } from '@/lib/types';

function task(over: Partial<Task> = {}): Task {
  return {
    id: 't1',
    title: 'Test',
    description: '',
    priority: 'medium',
    status: 'pending',
    categoryId: null,
    tags: [],
    scheduledAt: null,
    endAt: null,
    notifyOnEnd: false,
    recurrence: 'once',
    completedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    order: 0,
    pomodorosCompleted: 0,
    pomodorosEstimated: 0,
    notified: false,
    endNotified: false,
    subtasks: [],
    ...over,
  };
}

describe('scheduler — getNextOccurrence', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-04-25T12:00:00Z')); });
  afterEach(() => { vi.useRealTimers(); });

  it('S1: returns null when scheduledAt is null', () => {
    expect(getNextOccurrence(task())).toBeNull();
  });

  it('S2: returns the same date for once', () => {
    const t = task({ scheduledAt: '2026-04-30T09:00:00Z', recurrence: 'once' });
    expect(getNextOccurrence(t)?.toISOString()).toBe('2026-04-30T09:00:00.000Z');
  });

  it('S3: daily — already-future scheduledAt returned as-is', () => {
    const t = task({ scheduledAt: '2026-04-26T09:00:00Z', recurrence: 'daily' });
    expect(getNextOccurrence(t)?.toISOString()).toBe('2026-04-26T09:00:00.000Z');
  });

  it('S4: daily — past date advances to next future occurrence', () => {
    const t = task({ scheduledAt: '2026-04-20T09:00:00Z', recurrence: 'daily' });
    const next = getNextOccurrence(t)!;
    expect(next.getTime()).toBeGreaterThan(Date.now());
  });

  it('S5: weekly — past date advances by full weeks', () => {
    const t = task({ scheduledAt: '2026-04-18T09:00:00Z', recurrence: 'weekly' });
    const next = getNextOccurrence(t)!;
    expect(next.getTime()).toBeGreaterThan(Date.now());
    // diff from base must be a multiple of 7 days
    const dayDiff = Math.round((next.getTime() - new Date('2026-04-18T09:00:00Z').getTime()) / 86400000);
    expect(dayDiff % 7).toBe(0);
  });

  it('S6: monthly — Jan 31 → Feb 28 via overflow handling', () => {
    vi.setSystemTime(new Date('2026-02-15T00:00:00Z'));
    const t = task({ scheduledAt: '2026-01-31T09:00:00Z', recurrence: 'monthly' });
    const next = getNextOccurrence(t)!;
    expect(next.getMonth()).toBe(1); // February
    expect([28, 29]).toContain(next.getDate());
  });

  it('S7: invalid scheduledAt returns null', () => {
    expect(getNextOccurrence(task({ scheduledAt: 'garbage' }))).toBeNull();
  });
});

describe('scheduler — isDue', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-04-25T12:00:00Z')); });
  afterEach(() => { vi.useRealTimers(); });

  it('S8: due exactly at scheduled time', () => {
    expect(isDue(task({ scheduledAt: '2026-04-25T12:00:00Z' }))).toBe(true);
  });

  it('S9: not due 2 minutes before window starts', () => {
    expect(isDue(task({ scheduledAt: '2026-04-25T12:05:00Z' }))).toBe(false);
  });

  it('S10: not due if completed', () => {
    expect(isDue(task({ scheduledAt: '2026-04-25T12:00:00Z', status: 'completed' }))).toBe(false);
  });

  it('S11: not due if already notified', () => {
    expect(isDue(task({ scheduledAt: '2026-04-25T12:00:00Z', notified: true }))).toBe(false);
  });

  it('S12: not due 6 minutes after scheduled time', () => {
    expect(isDue(task({ scheduledAt: '2026-04-25T11:54:00Z' }))).toBe(false);
  });
});

describe('scheduler — createRecurringInstance', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-04-25T12:00:00Z')); });
  afterEach(() => { vi.useRealTimers(); });

  it('S13: returns null for once tasks', () => {
    expect(createRecurringInstance(task({ recurrence: 'once' }))).toBeNull();
  });

  it('S14: preserves duration between scheduledAt and endAt', () => {
    const t = task({
      recurrence: 'daily',
      scheduledAt: '2026-04-20T09:00:00Z',
      endAt: '2026-04-20T10:30:00Z',
    });
    const next = createRecurringInstance(t)!;
    const startMs = new Date(next.scheduledAt!).getTime();
    const endMs = new Date(next.endAt!).getTime();
    expect(endMs - startMs).toBe(90 * 60 * 1000);
  });

  it('S15: clears notification + completion flags', () => {
    const t = task({
      recurrence: 'daily',
      scheduledAt: '2026-04-20T09:00:00Z',
      notified: true,
      endNotified: true,
      status: 'completed',
      completedAt: '2026-04-20T09:30:00Z',
    });
    const next = createRecurringInstance(t)!;
    expect(next.notified).toBe(false);
    expect(next.endNotified).toBe(false);
    expect(next.status).toBe('pending');
    expect(next.completedAt).toBeNull();
  });

  it('S16: resets subtasks to incomplete', () => {
    const t = task({
      recurrence: 'daily',
      scheduledAt: '2026-04-20T09:00:00Z',
      subtasks: [{ id: 's1', title: 'a', completed: true }, { id: 's2', title: 'b', completed: true }],
    });
    const next = createRecurringInstance(t)!;
    expect(next.subtasks.every((s) => !s.completed)).toBe(true);
  });

  it('S17: handles missing endAt cleanly', () => {
    const t = task({ recurrence: 'daily', scheduledAt: '2026-04-20T09:00:00Z', endAt: null });
    const next = createRecurringInstance(t)!;
    expect(next.endAt).toBeNull();
  });
});
