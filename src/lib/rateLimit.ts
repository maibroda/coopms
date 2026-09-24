/**
 * Simple in-memory rate limiter — sufficient for this app's scale (single Node process, no
 * horizontal scaling). Keyed by whatever the caller chooses (typically the email/membership
 * number being attempted), not IP, since the threat this guards against is brute-forcing or
 * enumerating a specific account, not a specific network address.
 */
const attempts = new Map<string, { count: number; resetAt: number }>();

function cleanup(now: number) {
  if (attempts.size < 5000) return;
  for (const [key, entry] of attempts) {
    if (now > entry.resetAt) attempts.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
}

export function checkRateLimit(key: string, maxAttempts: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  cleanup(now);
  const entry = attempts.get(key);
  if (!entry || now > entry.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }
  if (entry.count >= maxAttempts) {
    return { allowed: false, retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000) };
  }
  entry.count += 1;
  return { allowed: true };
}

/** Called on a successful attempt so a prior run of failures doesn't linger and penalize a legitimate user. */
export function resetRateLimit(key: string) {
  attempts.delete(key);
}
