// Timing helpers — make timer-based code easier to test deterministically.

import { vi } from 'vitest';

/** Run `fn` with fake timers, advance them, and restore real timers afterwards. */
export async function withFakeTimers<T>(fn: () => Promise<T> | T, advanceMs = 0): Promise<T> {
  vi.useFakeTimers();
  try {
    const result = await fn();
    if (advanceMs > 0) await vi.advanceTimersByTimeAsync(advanceMs);
    return result;
  } finally {
    vi.useRealTimers();
  }
}

/** Wait until `predicate()` is true; throws after `timeoutMs`. Real-time, no fake clock needed. */
export async function until(
  predicate: () => boolean | Promise<boolean>,
  { timeoutMs = 1000, intervalMs = 10 }: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<void> {
  const start = Date.now();
  while (true) {
    if (await predicate()) return;
    if (Date.now() - start > timeoutMs) throw new Error(`until() timed out after ${timeoutMs}ms`);
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

/** A controllable promise — resolve/reject from outside. Useful for testing pending states. */
export function deferred<T = void>(): {
  promise: Promise<T>;
  resolve: (v: T) => void;
  reject: (e: unknown) => void;
} {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

/** Sleep for `ms` real-time milliseconds. */
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Pin Date.now() and `new Date()` to a fixed instant. Returns a restore function. */
export function freezeTime(at: Date | number): () => void {
  const ms = typeof at === 'number' ? at : at.getTime();
  vi.useFakeTimers({ now: ms });
  return () => vi.useRealTimers();
}
