// Generic test data factories — callable as makeX(overrides).
// Use freely; copy and adapt to your project's domain types.

let idCounter = 0;
export function nextId(prefix = 'id'): string {
  return `${prefix}-${++idCounter}`;
}

export function resetIdCounter(): void { idCounter = 0; }

/** Build an ISO timestamp at an offset (ms) from a base. */
export function isoOffset(baseMs: number, offsetMs: number): string {
  return new Date(baseMs + offsetMs).toISOString();
}

/** Stable "now" for tests — a known UTC date you can pin via vi.setSystemTime. */
export const FIXED_NOW = new Date('2026-04-25T12:00:00.000Z').getTime();

/** Build N items with a per-index transform. */
export function buildMany<T>(n: number, build: (i: number) => T): T[] {
  return Array.from({ length: n }, (_, i) => build(i));
}

/** Pick one item from an array based on an index (mod). Useful for cycling priorities/categories. */
export function cycle<T>(arr: readonly T[], i: number): T {
  return arr[i % arr.length];
}

/** Deep merge for plain objects/arrays — used inside factories for partial overrides. */
export function deepMerge<T>(base: T, over: any): T {
  if (over === undefined || over === null) return base;
  if (Array.isArray(base) || Array.isArray(over) || typeof base !== 'object') return over as T;
  const out: any = { ...base };
  for (const k of Object.keys(over)) {
    out[k] = deepMerge((base as any)[k], over[k]);
  }
  return out as T;
}

/** Snapshot a Zustand-ish store length object — useful in "tour does not pollute store" tests. */
export function snapshotLengths(state: Record<string, unknown>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const k of Object.keys(state)) {
    const v = (state as any)[k];
    if (Array.isArray(v)) out[k] = v.length;
  }
  return out;
}

/** Wait for a predicate without polling-busywait. */
export async function waitFor(predicate: () => boolean, timeoutMs = 1000, intervalMs = 10): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error('waitFor timed out');
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}
