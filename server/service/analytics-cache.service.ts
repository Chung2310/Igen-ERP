import { getRateLimitRedisClient } from "../infrastructure/rate-limit-redis";

const PREFIX = "igen:analytics";
const TTL_SECONDS = Number(process.env.ANALYTICS_CACHE_TTL_SECONDS) || 120;

export async function withAnalyticsCache<T>(companyCode: string | undefined, key: string, producer: () => Promise<T>): Promise<T> {
  if (!companyCode || process.env.NODE_ENV === "test") return producer();
  const redis = getRateLimitRedisClient();
  try {
    const version = await redis.get(`${PREFIX}:version:${companyCode}`) || "1";
    const cacheKey = `${PREFIX}:${companyCode}:v${version}:${key}`;
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached) as T;
    const value = await producer();
    await redis.set(cacheKey, JSON.stringify(value), "EX", TTL_SECONDS);
    return value;
  } catch {
    return producer();
  }
}

export async function invalidateAnalyticsCache(companyCode?: string): Promise<void> {
  if (!companyCode) return;
  try {
    await getRateLimitRedisClient().incr(`${PREFIX}:version:${companyCode}`);
  } catch {
    // Cache is an optimization; writes must not fail when Redis is unavailable.
  }
}
