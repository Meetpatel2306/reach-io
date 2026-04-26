// React hook test template — uses renderHook from @testing-library/react.
// Copy into tests/, rename, swap the import for your hook.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
// import { useYourHook } from '@/hooks/useYourHook';

// Demo hook so this file works as-is. Delete and replace with your real one.
import { useState, useEffect, useCallback } from 'react';
function useCounter(initial = 0) {
  const [n, setN] = useState(initial);
  const increment = useCallback(() => setN((v) => v + 1), []);
  const decrement = useCallback(() => setN((v) => v - 1), []);
  const reset = useCallback(() => setN(initial), [initial]);
  return { n, increment, decrement, reset };
}

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

describe('useCounter — happy path', () => {
  it('initializes to the provided value', () => {
    const { result } = renderHook(() => useCounter(5));
    expect(result.current.n).toBe(5);
  });

  it('increments and decrements', () => {
    const { result } = renderHook(() => useCounter(0));
    act(() => result.current.increment());
    act(() => result.current.increment());
    expect(result.current.n).toBe(2);
    act(() => result.current.decrement());
    expect(result.current.n).toBe(1);
  });

  it('reset returns to the initial value', () => {
    const { result } = renderHook(() => useCounter(10));
    act(() => result.current.increment());
    act(() => result.current.reset());
    expect(result.current.n).toBe(10);
  });
});

describe('useCounter — re-render and prop changes', () => {
  it('reset uses the latest initial value when props change', () => {
    const { result, rerender } = renderHook(({ start }) => useCounter(start), {
      initialProps: { start: 0 },
    });
    act(() => result.current.increment());
    rerender({ start: 100 });
    act(() => result.current.reset());
    expect(result.current.n).toBe(100);
  });
});

describe('useDebouncedValue — fake timers', () => {
  beforeEach(() => vi.useFakeTimers());

  it('returns the previous value until the delay elapses', () => {
    const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v, 200), {
      initialProps: { v: 'a' },
    });
    expect(result.current).toBe('a');
    rerender({ v: 'b' });
    expect(result.current).toBe('a');
    act(() => { vi.advanceTimersByTime(199); });
    expect(result.current).toBe('a');
    act(() => { vi.advanceTimersByTime(1); });
    expect(result.current).toBe('b');
  });

  it('cancels the previous timeout when the value changes again', () => {
    const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v, 200), {
      initialProps: { v: 'a' },
    });
    rerender({ v: 'b' });
    act(() => { vi.advanceTimersByTime(150); });
    rerender({ v: 'c' });
    act(() => { vi.advanceTimersByTime(199); });
    expect(result.current).toBe('a');
    act(() => { vi.advanceTimersByTime(1); });
    expect(result.current).toBe('c');
  });
});

describe('async hook patterns', () => {
  function useFetched(url: string) {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
      let cancelled = false;
      fetch(url).then((r) => r.json()).then((j) => {
        if (!cancelled) { setData(j); setLoading(false); }
      });
      return () => { cancelled = true; };
    }, [url]);
    return { data, loading };
  }

  it('updates state once the promise resolves', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      json: async () => ({ ok: true }),
    } as any);
    const { result } = renderHook(() => useFetched('/api/x'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual({ ok: true });
    expect(fetchSpy).toHaveBeenCalledWith('/api/x');
  });
});
