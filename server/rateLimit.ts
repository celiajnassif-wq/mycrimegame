// Simple in-memory per-session limiter: a token bucket plus a daily cap.
const buckets = new Map<string, { tokens: number; at: number; day: string; count: number }>();

const PER_MINUTE = Number(process.env.RATE_PER_MINUTE ?? 12);
const PER_DAY = Number(process.env.RATE_PER_DAY ?? 400);

export function allow(key: string, now = Date.now()): { ok: boolean; retryAfter?: number } {
  const day = new Date(now).toISOString().slice(0, 10);
  let b = buckets.get(key);
  if (!b || b.day !== day) b = { tokens: PER_MINUTE, at: now, day, count: 0 };
  b.tokens = Math.min(PER_MINUTE, b.tokens + ((now - b.at) / 60000) * PER_MINUTE);
  b.at = now;
  if (b.count >= PER_DAY) { buckets.set(key, b); return { ok: false, retryAfter: 3600 }; }
  if (b.tokens < 1) { buckets.set(key, b); return { ok: false, retryAfter: Math.ceil(((1 - b.tokens) * 60) / PER_MINUTE) }; }
  b.tokens -= 1;
  b.count += 1;
  buckets.set(key, b);
  if (buckets.size > 10000) buckets.delete(buckets.keys().next().value!);
  return { ok: true };
}
