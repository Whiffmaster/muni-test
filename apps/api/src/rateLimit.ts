/**
 * A small limiter for the login.
 *
 * The panel has one password for everybody, so guessing it has to be as
 * unpleasant as possible: after a few wrong tries the address is put on hold
 * for a while.
 *
 * The counters live in the memory - one server, one list of tries.
 */

/** How many wrong tries are allowed in one window. */
export const MAX_FAILURES = 10;

/** How long the window lasts. */
export const WINDOW_MS = 5 * 60 * 1000;

export interface LimitState {
  /** May the person try again? */
  allowed: boolean;
  /** How many seconds are left of the hold. */
  retryAfterSeconds: number;
  /** How many tries are left in the window. */
  remaining: number;
}

interface Bucket {
  failures: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/** Is this address (or anything else) allowed to try? */
export function checkLimit(key: string, max = MAX_FAILURES): LimitState {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket) {
    return { allowed: true, retryAfterSeconds: 0, remaining: max };
  }

  if (bucket.resetAt <= now) {
    buckets.delete(key);
    return { allowed: true, retryAfterSeconds: 0, remaining: max };
  }

  if (bucket.failures >= max) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
      remaining: 0,
    };
  }

  return { allowed: true, retryAfterSeconds: 0, remaining: max - bucket.failures };
}

/** A wrong try - the counter goes up. */
export function noteFailure(key: string, windowMs = WINDOW_MS): void {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { failures: 1, resetAt: now + windowMs });
    return;
  }

  bucket.failures += 1;
}

/** A good try - the counter is thrown away. */
export function noteSuccess(key: string): void {
  buckets.delete(key);
}

/** Forgets all the counters - used by the tests. */
export function resetLimits(): void {
  buckets.clear();
}

/** Throws away the counters of the addresses that are done. */
function prune(now: number): void {
  if (buckets.size < 1000) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

/** The key the counter of the visitor is kept under. */
export function limitKeyOf(parts: {
  ip?: string | undefined;
  remoteAddress?: string | undefined;
}): string {
  const ip = parts.ip ?? parts.remoteAddress ?? "unknown";
  prune(Date.now());
  return ip;
}
