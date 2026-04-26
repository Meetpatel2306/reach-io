// Persistent stale-while-revalidate cache.
//
// Pages call `cached(key, ttl, fetcher)` and get whatever is in localStorage
// immediately. If that data is older than `ttl`, a background fetch is fired
// off and the new value is written back; React components subscribe via
// `useCached` and re-render when fresh data arrives.

const PREFIX = "bs-cache:";
const VERSION = 1;
const memSubs = new Map<string, Set<(v: any) => void>>();
const inFlight = new Map<string, Promise<any>>();

interface Entry<T> {
  v: number;
  ts: number;
  data: T;
}

function readEntry<T>(key: string): Entry<T> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const e = JSON.parse(raw) as Entry<T>;
    if (e.v !== VERSION) return null;
    return e;
  } catch { return null; }
}

function writeEntry<T>(key: string, data: T) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({ v: VERSION, ts: Date.now(), data }));
  } catch {
    // storage full — drop oldest entries
    pruneOldest(20);
    try { localStorage.setItem(PREFIX + key, JSON.stringify({ v: VERSION, ts: Date.now(), data })); } catch {}
  }
}

function pruneOldest(n: number) {
  if (typeof window === "undefined") return;
  const entries: { k: string; ts: number }[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k?.startsWith(PREFIX)) continue;
    try {
      const e = JSON.parse(localStorage.getItem(k) || "{}");
      entries.push({ k, ts: e.ts || 0 });
    } catch {}
  }
  entries.sort((a, b) => a.ts - b.ts).slice(0, n).forEach(({ k }) => localStorage.removeItem(k));
}

function notify(key: string, data: any) {
  const subs = memSubs.get(key);
  subs?.forEach((cb) => cb(data));
}

/** Get fresh-or-stale value, kicking off a background refresh if stale. */
export async function cached<T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> {
  const entry = readEntry<T>(key);
  const now = Date.now();
  const fresh = entry && now - entry.ts < ttlMs;

  if (fresh) return entry!.data;

  // If stale or missing, dedupe in-flight requests and fetch
  if (!inFlight.has(key)) {
    const p = fetcher().then((data) => {
      writeEntry(key, data);
      notify(key, data);
      inFlight.delete(key);
      return data;
    }).catch((e) => {
      inFlight.delete(key);
      throw e;
    });
    inFlight.set(key, p);
  }

  // Return stale immediately if we have it; otherwise await the in-flight
  if (entry) return entry.data;
  return inFlight.get(key) as Promise<T>;
}

/** Subscribe to background refreshes for a key. */
export function subscribe<T>(key: string, cb: (v: T) => void): () => void {
  if (!memSubs.has(key)) memSubs.set(key, new Set());
  memSubs.get(key)!.add(cb);
  return () => memSubs.get(key)?.delete(cb);
}

/** Read whatever is currently cached without triggering a fetch. */
export function peek<T>(key: string): T | null {
  return readEntry<T>(key)?.data ?? null;
}

import { useEffect, useState } from "react";

/**
 * React hook: returns the cached value immediately on the *client* (or null),
 * kicks off a background fetch, and re-renders when fresh data lands.
 *
 * Hydration: we deliberately start with `null/isLoading=true` on the first
 * render so the SSR output matches client hydration. On the very next tick
 * (in useEffect) we read localStorage. The result is a single-frame spinner
 * flash on revisits, but no hydration mismatch.
 *
 * - First visit ever: spinner → renders when fetcher resolves
 * - Repeat visits: spinner for ~1 frame → cached data appears instantly
 */
export function useCached<T>(key: string, ttlMs: number, fetcher: () => Promise<T>): { data: T | null; isLoading: boolean; error: unknown } {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let cancelled = false;
    const initial = peek<T>(key);
    if (initial !== null) {
      setData(initial);
      setLoading(false);
    } else {
      setLoading(true);
    }

    const unsub = subscribe<T>(key, (fresh) => { if (!cancelled) setData(fresh); });

    cached(key, ttlMs, fetcher)
      .then((d) => { if (!cancelled) { setData(d); setError(null); } })
      .catch((e) => { if (!cancelled) setError(e); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; unsub(); };
  }, [key, ttlMs]); // intentionally exclude fetcher

  return { data, isLoading, error };
}

export function clearAllCache() {
  if (typeof window === "undefined") return;
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(PREFIX)) keys.push(k);
  }
  keys.forEach((k) => localStorage.removeItem(k));
}

export function cacheBytes(): number {
  if (typeof window === "undefined") return 0;
  let total = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(PREFIX)) total += (localStorage.getItem(k) || "").length * 2;
  }
  return total;
}

// TTLs (in ms)
export const TTL = {
  song: 7 * 24 * 60 * 60 * 1000,        // 7 days — songs don't change
  album: 30 * 24 * 60 * 60 * 1000,      // 30 days
  artist: 30 * 24 * 60 * 60 * 1000,
  playlist: 24 * 60 * 60 * 1000,        // 1 day — community playlists update
  search: 24 * 60 * 60 * 1000,          // 1 day
  trending: 6 * 60 * 60 * 1000,         // 6 hours
  daylist: 6 * 60 * 60 * 1000,
  newReleases: 24 * 60 * 60 * 1000,
  lyrics: 30 * 24 * 60 * 60 * 1000,
};
