/**
 * Small fixed-window rate limiter kept in memory.
 *
 * Limitation: each server instance keeps its own counters, so on serverless
 * hosting (e.g. Vercel) limits are per instance, not global. For strict
 * global limits, swap this for a shared store such as Redis/Upstash.
 */
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const MAX_KEYS = 10_000;

export type RateLimitResult = { allowed: boolean; remaining: number; retryAfterSeconds: number };

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
): RateLimitResult {
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    if (buckets.size >= MAX_KEYS) prune(now);
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  if (bucket.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }

  bucket.count += 1;
  return { allowed: true, remaining: limit - bucket.count, retryAfterSeconds: 0 };
}

function prune(now: number) {
  for (const [key, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key);
  if (buckets.size >= MAX_KEYS) buckets.clear();
}

export function resetRateLimits() {
  buckets.clear();
}

/** Named limits for mutation endpoints. */
export const LIMITS = {
  postWrite: { limit: 30, windowMs: 60 * 60 * 1000 },
  comment: { limit: 10, windowMs: 60 * 1000 },
  reaction: { limit: 60, windowMs: 60 * 1000 },
  upload: { limit: 20, windowMs: 60 * 60 * 1000 },
  profile: { limit: 20, windowMs: 60 * 60 * 1000 },
} as const;
