// Async function test template — promises, timers, retries, race conditions, AbortController.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// import { fetchWithRetry, debouncedSave, withTimeout } from '@/lib/your-async-lib';

// Demo functions so this template runs as-is. Delete and replace.
async function fetchWithRetry(url: string, attempts = 3, delay = 100): Promise<any> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try { return await fetch(url).then((r) => r.json()); }
    catch (e) { lastErr = e; await new Promise((r) => setTimeout(r, delay * (i + 1))); }
  }
  throw lastErr;
}

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)),
  ]);
}

describe('promise basics', () => {
  it('resolves with the expected value', async () => {
    await expect(Promise.resolve(42)).resolves.toBe(42);
  });

  it('rejects with the expected error', async () => {
    await expect(Promise.reject(new Error('nope'))).rejects.toThrow('nope');
  });

  it('can chain rejection assertions', async () => {
    const f = async () => { throw new TypeError('bad arg'); };
    await expect(f()).rejects.toBeInstanceOf(TypeError);
  });
});

describe('fetchWithRetry', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('returns on the first successful attempt', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      json: async () => ({ ok: true }),
    } as any);
    await expect(fetchWithRetry('/x', 3, 50)).resolves.toEqual({ ok: true });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('retries failed attempts and eventually returns', async () => {
    let calls = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      calls++;
      if (calls < 3) throw new Error('flaky');
      return { json: async () => ({ ok: true }) } as any;
    });
    const promise = fetchWithRetry('/x', 5, 10);
    await vi.runAllTimersAsync();
    await expect(promise).resolves.toEqual({ ok: true });
    expect(calls).toBe(3);
  });

  it('throws the final error after exhausting attempts', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('down'));
    const promise = fetchWithRetry('/x', 2, 10);
    await vi.runAllTimersAsync();
    await expect(promise).rejects.toThrow('down');
  });
});

describe('withTimeout', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('resolves if the inner promise wins', async () => {
    const inner = new Promise((r) => setTimeout(() => r('done'), 50));
    const promise = withTimeout(inner, 200);
    await vi.advanceTimersByTimeAsync(60);
    await expect(promise).resolves.toBe('done');
  });

  it('rejects with timeout if the inner promise is too slow', async () => {
    const inner = new Promise((r) => setTimeout(() => r('done'), 1000));
    const promise = withTimeout(inner, 50);
    await vi.advanceTimersByTimeAsync(60);
    await expect(promise).rejects.toThrow('timeout');
  });
});

describe('AbortController patterns', () => {
  it('aborts a fetch in flight', async () => {
    const ac = new AbortController();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_, init: any) => {
      return new Promise((_, rej) => {
        init.signal?.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError')));
      });
    });
    const promise = fetch('/slow', { signal: ac.signal });
    ac.abort();
    await expect(promise).rejects.toThrow(/abort/i);
    expect(fetchSpy).toHaveBeenCalled();
  });
});
