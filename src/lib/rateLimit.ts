// Small in-memory sliding-window rate limiter.
//
// Honest limitation: on serverless hosts (Vercel) each warm instance keeps its own counters, so this
// slows brute-force and spam down a lot but is not a hard global cap. For a production store, swap the
// Map for a shared store (e.g. Upstash Redis) behind the same `rateLimit()` signature.

type Entry = { hits: number[] };

const store = new Map<string, Entry>();
const MAX_KEYS = 5000;

export type RateLimitResult = { ok: boolean; retryAfterSeconds: number };

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const cutoff = now - windowMs;

  if (store.size > MAX_KEYS) {
    for (const [k, v] of store) {
      if (v.hits.every((t) => t <= cutoff)) store.delete(k);
    }
  }

  const entry = store.get(key) ?? { hits: [] };
  entry.hits = entry.hits.filter((t) => t > cutoff);

  if (entry.hits.length >= limit) {
    store.set(key, entry);
    const retryAfterSeconds = Math.max(1, Math.ceil((entry.hits[0] + windowMs - now) / 1000));
    return { ok: false, retryAfterSeconds };
  }

  entry.hits.push(now);
  store.set(key, entry);
  return { ok: true, retryAfterSeconds: 0 };
}

export function resetRateLimit(key: string) {
  store.delete(key);
}

/** Best-effort client IP from standard proxy headers (Vercel sets x-forwarded-for). */
export function clientIp(headers: Headers | Record<string, string | string[] | undefined> | undefined): string {
  if (!headers) return "unknown";
  const read = (name: string): string | undefined => {
    if (typeof (headers as Headers).get === "function") return (headers as Headers).get(name) ?? undefined;
    const v = (headers as Record<string, string | string[] | undefined>)[name];
    return Array.isArray(v) ? v[0] : v;
  };
  const forwarded = read("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return read("x-real-ip") ?? "unknown";
}

export function tooManyRequests(retryAfterSeconds: number, message = "Too many attempts. Please try again later.") {
  return new Response(JSON.stringify({ error: message }), {
    status: 429,
    headers: { "Content-Type": "application/json", "Retry-After": String(retryAfterSeconds) },
  });
}
