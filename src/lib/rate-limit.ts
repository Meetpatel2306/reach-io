// Simple sliding-window rate limiter backed by KV.
// Falls back to in-memory if KV not configured (per-instance only).

import { kvGet, kvSet } from "./storage";

const memCounts = new Map<string, { count: number; resetAt: number }>();

interface RateLimitOptions {
  /** Unique key for this limit (e.g. "login:1.2.3.4") */
  key: string;
  /** Max requests in the window */
  max: number;
  /** Window size in milliseconds */
  windowMs: number;
}

interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
}

export async function rateLimit(opts: RateLimitOptions): Promise<RateLimitResult> {
  const now = Date.now();
  const fullKey = `rl:${opts.key}`;

  let record = await kvGet<{ count: number; resetAt: number }>(fullKey);

  // Fall back to memory if KV unavailable
  if (!record) {
    const mem = memCounts.get(fullKey);
    if (mem && mem.resetAt > now) record = mem;
  }

  if (!record || record.resetAt <= now) {
    record = { count: 1, resetAt: now + opts.windowMs };
  } else {
    record.count += 1;
  }

  // Persist
  await kvSet(fullKey, record);
  memCounts.set(fullKey, record);

  if (record.count > opts.max) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSec: Math.ceil((record.resetAt - now) / 1000),
    };
  }
  return {
    ok: true,
    remaining: opts.max - record.count,
    retryAfterSec: 0,
  };
}

// Helper: get client IP from request
export function getClientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}
