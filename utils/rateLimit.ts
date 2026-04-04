import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

type LimitResult = { success: boolean; limit?: number; remaining?: number; reset?: number };

const WINDOW_MS = 60_000;
const MAX_REQUESTS_MEMORY = 120;
const MAX_REQUESTS_UPSTASH = 60;

const memoryBuckets = new Map<string, { count: number; resetAt: number }>();

function memoryLimit(identifier: string): LimitResult {
  const now = Date.now();
  let bucket = memoryBuckets.get(identifier);
  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + WINDOW_MS };
    memoryBuckets.set(identifier, bucket);
  }
  bucket.count += 1;
  if (bucket.count > MAX_REQUESTS_MEMORY) {
    return { success: false, limit: MAX_REQUESTS_MEMORY, remaining: 0, reset: bucket.resetAt };
  }
  return {
    success: true,
    limit: MAX_REQUESTS_MEMORY,
    remaining: MAX_REQUESTS_MEMORY - bucket.count,
    reset: bucket.resetAt,
  };
}

let upstashRatelimit: Ratelimit | null = null;

function getUpstashRatelimit(): Ratelimit | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  if (!upstashRatelimit) {
    upstashRatelimit = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(MAX_REQUESTS_UPSTASH, "1 m"),
      analytics: false,
      prefix: "sarkarikhoj",
    });
  }
  return upstashRatelimit;
}

/**
 * Rate limit by client identifier (e.g. IP). Uses Upstash on Vercel when env is set;
 * otherwise falls back to in-memory sliding window (best-effort per instance).
 */
export async function rateLimit(identifier: string): Promise<LimitResult> {
  const ratelimit = getUpstashRatelimit();
  if (ratelimit) {
    const result = await ratelimit.limit(identifier);
    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
    };
  }
  return memoryLimit(identifier);
}

export function getClientIdentifier(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "anonymous";
}
