import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  cn,
  formatDate,
  formatTime,
  formatDateTime,
  formatRelative,
  isToday,
  isOverdue,
  isSameDay,
  getDateKey,
  getDaysInMonth,
  getFirstDayOfMonth,
  startOfDay,
  addDays,
  truncate,
  pluralize,
  generateId,
  safeLocalStorage,
  safeLocalStorageSet,
} from '@/lib/utils';

describe('utils — normal cases', () => {
  it('U1: cn merges truthy strings', () => {
    expect(cn('a', 'b', 'c')).toBe('a b c');
  });

  it('U2: cn drops falsy values', () => {
    expect(cn('a', false, undefined, null, 'b')).toBe('a b');
  });

  it('U3: pluralize singular when count is 1', () => {
    expect(pluralize(1, 'task')).toBe('task');
  });

  it('U4: pluralize default-plural when count != 1', () => {
    expect(pluralize(0, 'task')).toBe('tasks');
    expect(pluralize(2, 'task')).toBe('tasks');
  });

  it('U5: pluralize uses explicit plural', () => {
    expect(pluralize(2, 'foot', 'feet')).toBe('feet');
  });

  it('U6: truncate keeps short strings intact', () => {
    expect(truncate('hello', 10)).toBe('hello');
  });

  it('U7: truncate adds ellipsis when over limit', () => {
    expect(truncate('hello world', 5)).toBe('hello...');
  });

  it('U8: getDateKey returns YYYY-MM-DD with zero-padding', () => {
    const d = new Date(2026, 0, 5); // Jan 5 in local time
    expect(getDateKey(d)).toBe('2026-01-05');
  });

  it('U9: getDaysInMonth returns 31 for January', () => {
    expect(getDaysInMonth(2026, 0)).toBe(31);
  });

  it('U10: getDaysInMonth handles leap year February', () => {
    expect(getDaysInMonth(2024, 1)).toBe(29);
    expect(getDaysInMonth(2025, 1)).toBe(28);
  });

  it('U11: addDays moves date forward', () => {
    const d = new Date(2026, 3, 25);
    expect(addDays(d, 5).getDate()).toBe(30);
  });

  it('U12: addDays moves date backward with negative', () => {
    const d = new Date(2026, 3, 25);
    expect(addDays(d, -5).getDate()).toBe(20);
  });

  it('U13: startOfDay zeros all time fields', () => {
    const d = new Date(2026, 3, 25, 14, 30, 45, 123);
    const s = startOfDay(d);
    expect(s.getHours()).toBe(0);
    expect(s.getMinutes()).toBe(0);
    expect(s.getSeconds()).toBe(0);
    expect(s.getMilliseconds()).toBe(0);
  });

  it('U14: isSameDay true when same Y/M/D', () => {
    expect(isSameDay(new Date(2026, 0, 1, 9), new Date(2026, 0, 1, 23))).toBe(true);
  });

  it('U15: isSameDay false when different days', () => {
    expect(isSameDay(new Date(2026, 0, 1), new Date(2026, 0, 2))).toBe(false);
  });

  it('U16: generateId returns a non-empty string', () => {
    expect(generateId().length).toBeGreaterThan(0);
  });

  it('U17: generateId returns different ids on consecutive calls', () => {
    const ids = new Set();
    for (let i = 0; i < 100; i++) ids.add(generateId());
    expect(ids.size).toBe(100);
  });

  it('U18: safeLocalStorage round-trips a value', () => {
    safeLocalStorageSet('k', 'v');
    expect(safeLocalStorage('k')).toBe('v');
  });

  it('U19: safeLocalStorage returns fallback for missing key', () => {
    expect(safeLocalStorage('missing-key', 'fallback')).toBe('fallback');
  });
});

describe('utils — formatting cases', () => {
  it('U20: formatDate renders a known date', () => {
    expect(formatDate('2026-04-25')).toMatch(/2026/);
  });

  it('U21: formatTime returns hh:mm with am/pm', () => {
    const out = formatTime(new Date(2026, 3, 25, 14, 30));
    expect(out).toMatch(/(AM|PM|am|pm)/i);
  });

  it('U22: formatDateTime combines date and time', () => {
    const out = formatDateTime(new Date(2026, 3, 25, 14, 30));
    expect(out).toContain(' at ');
  });

  it('U23: isToday true for now', () => {
    expect(isToday(new Date())).toBe(true);
  });

  it('U24: isToday false for yesterday', () => {
    expect(isToday(addDays(new Date(), -1))).toBe(false);
  });
});

describe('utils — hard / edge cases', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('UH1: formatDate returns "Invalid date" for garbage', () => {
    expect(formatDate('garbage')).toBe('Invalid date');
  });

  it('UH2: formatTime returns "--:--" for invalid', () => {
    expect(formatTime('garbage')).toBe('--:--');
  });

  it('UH3: formatRelative says "just now" inside 1 minute', () => {
    vi.setSystemTime(new Date('2026-04-25T12:00:00Z'));
    const fortySecondsAgo = new Date('2026-04-25T11:59:20Z').toISOString();
    expect(formatRelative(fortySecondsAgo)).toBe('just now');
  });

  it('UH4: formatRelative future hours', () => {
    vi.setSystemTime(new Date('2026-04-25T12:00:00Z'));
    const twoHoursLater = new Date('2026-04-25T14:00:00Z').toISOString();
    expect(formatRelative(twoHoursLater)).toBe('in 2h');
  });

  it('UH5: formatRelative past minutes', () => {
    vi.setSystemTime(new Date('2026-04-25T12:00:00Z'));
    const tenMinAgo = new Date('2026-04-25T11:50:00Z').toISOString();
    expect(formatRelative(tenMinAgo)).toBe('10m ago');
  });

  it('UH6: formatRelative falls through to formatDate after a week', () => {
    vi.setSystemTime(new Date('2026-04-25T12:00:00Z'));
    const monthAgo = new Date('2026-03-01T12:00:00Z').toISOString();
    expect(formatRelative(monthAgo)).toMatch(/2026/);
  });

  it('UH7: formatRelative invalid input returns "unknown"', () => {
    expect(formatRelative('not a date')).toBe('unknown');
  });

  it('UH8: isOverdue false for invalid date', () => {
    expect(isOverdue('not a date')).toBe(false);
  });

  it('UH9: getFirstDayOfMonth returns weekday index 0-6', () => {
    const dow = getFirstDayOfMonth(2026, 0);
    expect(dow).toBeGreaterThanOrEqual(0);
    expect(dow).toBeLessThanOrEqual(6);
  });
});
