// Simple in-memory rate limiter.
// Works for single-instance Next.js (dev / small Vercel deployments).
// Replace with Upstash Redis if you need distributed limits.

interface Window {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Window>();

interface RateLimitOptions {
  max: number; // max requests
  windowMs: number; // per window in milliseconds
}

export interface RateLimitResult {
  ok: boolean;
  retryAfterSec: number;
}

export function rateLimit(
  key: string,
  options: RateLimitOptions,
): RateLimitResult {
  const now = Date.now();
  const entry = buckets.get(key);

  if (!entry || entry.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + options.windowMs });
    return { ok: true, retryAfterSec: 0 };
  }

  if (entry.count >= options.max) {
    return {
      ok: false,
      retryAfterSec: Math.ceil((entry.resetAt - now) / 1000),
    };
  }

  entry.count += 1;
  return { ok: true, retryAfterSec: 0 };
}

// Best-effort cleanup so the Map doesn't grow forever on long-running servers.
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of buckets) {
      if (v.resetAt <= now) buckets.delete(k);
    }
  }, 60_000).unref?.();
}
