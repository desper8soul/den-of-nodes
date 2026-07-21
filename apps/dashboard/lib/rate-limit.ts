interface RateLimitState {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, RateLimitState>();

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterMs: 0 };
  }

  if (existing.count >= limit) {
    return { allowed: false, retryAfterMs: existing.resetAt - now };
  }

  existing.count += 1;
  return { allowed: true, retryAfterMs: 0 };
}

export function resetRateLimit(key: string): void {
  buckets.delete(key);
}

export type FailedLoginState = {
  consecutiveFailures: number;
  firstFailureAt: number;
  lastFailureAt: number;
  lastAlertSentAt: number | null;
};

const failedLogins = new Map<string, FailedLoginState>();

export function recordFailedLogin(ip: string): FailedLoginState {
  const now = Date.now();
  const existing = failedLogins.get(ip);

  if (!existing) {
    const state: FailedLoginState = {
      consecutiveFailures: 1,
      firstFailureAt: now,
      lastFailureAt: now,
      lastAlertSentAt: null,
    };
    failedLogins.set(ip, state);
    return state;
  }

  existing.consecutiveFailures += 1;
  existing.lastFailureAt = now;
  return existing;
}

export function resetFailedLogin(ip: string): void {
  failedLogins.delete(ip);
}

export function shouldSendLoginAlert(
  state: FailedLoginState,
  cooldownMs: number,
): boolean {
  if (state.consecutiveFailures < 3) {
    return false;
  }

  if (!state.lastAlertSentAt) {
    return true;
  }

  return Date.now() - state.lastAlertSentAt >= cooldownMs;
}

export function markLoginAlertSent(ip: string): void {
  const state = failedLogins.get(ip);
  if (state) {
    state.lastAlertSentAt = Date.now();
  }
}

const wakeRateLimits = new Map<string, number>();

export function checkWakeCooldown(
  sessionId: string,
  deviceId: string,
  cooldownMs: number,
): boolean {
  const key = `${sessionId}:${deviceId}`;
  const last = wakeRateLimits.get(key) ?? 0;
  if (Date.now() - last < cooldownMs) {
    return false;
  }
  wakeRateLimits.set(key, Date.now());
  return true;
}
