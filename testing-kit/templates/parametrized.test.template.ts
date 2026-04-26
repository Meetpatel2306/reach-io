// Parametrized / table-driven test template — vitest's it.each.
// Best for pure functions where you want to enumerate cases instead of writing N tests.

import { describe, it, expect } from 'vitest';

// import { slugify, parseDuration, formatBytes } from '@/lib/your-utils';

// Demo functions so this template runs as-is. Delete and replace.
function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(1)} GB`;
}

function parseDuration(s: string): number | null {
  const m = s.match(/^(\d+)\s*(s|m|h|d)$/);
  if (!m) return null;
  const [, num, unit] = m;
  const mult = { s: 1, m: 60, h: 3600, d: 86400 }[unit as 's' | 'm' | 'h' | 'd'];
  return Number(num) * mult * 1000;
}

describe('slugify', () => {
  it.each([
    ['Hello World', 'hello-world'],
    ['  spaced  ', 'spaced'],
    ['Already-slug', 'already-slug'],
    ['mixed_under-and dash', 'mixed-under-and-dash'],
    ['UPPER CASE', 'upper-case'],
    ['emoji 🎉 in title', 'emoji-in-title'],
    ['multi    spaces', 'multi-spaces'],
    ['', ''],
    ['---leading---trailing---', 'leading-trailing'],
  ])('slugify(%j) → %j', (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });
});

describe('formatBytes', () => {
  it.each<[number, string]>([
    [0, '0 B'],
    [512, '512 B'],
    [1023, '1023 B'],
    [1024, '1.0 KB'],
    [1536, '1.5 KB'],
    [1024 * 1024, '1.0 MB'],
    [1024 * 1024 * 1024, '1.0 GB'],
    [10 * 1024 ** 3, '10.0 GB'],
  ])('formatBytes(%d) → %s', (input, expected) => {
    expect(formatBytes(input)).toBe(expected);
  });
});

describe('parseDuration — table with object cases', () => {
  it.each([
    { input: '30s', expected: 30_000 },
    { input: '5m', expected: 300_000 },
    { input: '2h', expected: 7_200_000 },
    { input: '1d', expected: 86_400_000 },
  ])('$input → $expected ms', ({ input, expected }) => {
    expect(parseDuration(input)).toBe(expected);
  });

  it.each(['', 'abc', '5x', '5', 'm5', '5 m extra'])('returns null for invalid input %j', (bad) => {
    expect(parseDuration(bad)).toBeNull();
  });
});

describe('boundary fuzzing — quick property check via for-loop', () => {
  it('slugify is idempotent: slugify(slugify(x)) === slugify(x)', () => {
    const samples = ['hello world', 'A B C', '  spaces  ', 'multi---dashes'];
    for (const s of samples) {
      expect(slugify(slugify(s))).toBe(slugify(s));
    }
  });
});
