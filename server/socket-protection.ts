import type { RateLimitRedisClient } from "./infrastructure/rate-limit-redis";

export interface SocketProtectionCounter {
  incrementWindow(key: string, windowMs: number): Promise<{ count: number; retryAfterMs: number }>;
  acquire(key: string, limit: number): Promise<boolean>;
  release(key: string): Promise<void>;
}

interface SocketProtectionConfig {
  handshakeWindowMs: number;
  handshakeLimit: number;
  maxPerUser: number;
  maxPerIp: number;
  eventWindowMs: number;
  eventLimit: number;
  violationLimit: number;
}

interface EventBucket {
  tokens: number;
  updatedAt: number;
  violations: number;
}

const WINDOW_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
return { count, redis.call('PTTL', KEYS[1]) }
`;

const ACQUIRE_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[2]) end
if count > tonumber(ARGV[1]) then
  redis.call('DECR', KEYS[1])
  return 0
end
return 1
`;

const RELEASE_SCRIPT = `
local count = tonumber(redis.call('GET', KEYS[1]) or '0')
if count <= 1 then redis.call('DEL', KEYS[1]) else redis.call('DECR', KEYS[1]) end
return 1
`;

export class RedisSocketProtectionCounter implements SocketProtectionCounter {
  constructor(
    private readonly redis: RateLimitRedisClient,
    private readonly prefix: string,
  ) {}

  async incrementWindow(key: string, windowMs: number) {
    const result = await this.redis.eval(
      WINDOW_SCRIPT,
      1,
      this.key(key),
      String(windowMs),
    );
    if (!Array.isArray(result) || result.length < 2) throw new Error("Invalid Socket rate-limit response");
    return { count: Number(result[0]), retryAfterMs: Math.max(0, Number(result[1])) };
  }

  async acquire(key: string, limit: number): Promise<boolean> {
    const result = await this.redis.eval(
      ACQUIRE_SCRIPT,
      1,
      this.key(key),
      String(limit),
      String(24 * 60 * 60 * 1000),
    );
    return Number(result) === 1;
  }

  async release(key: string): Promise<void> {
    await this.redis.eval(RELEASE_SCRIPT, 1, this.key(key));
  }

  private key(key: string): string {
    return `${this.prefix}${key}`;
  }
}

export class SocketProtection {
  private readonly buckets = new Map<string, EventBucket>();

  constructor(
    private readonly counter: SocketProtectionCounter,
    private readonly config: SocketProtectionConfig,
    private readonly now: () => number = Date.now,
  ) {}

  async checkHandshake(ip: string) {
    const result = await this.counter.incrementWindow(`handshake:${ip}`, this.config.handshakeWindowMs);
    return {
      allowed: result.count <= this.config.handshakeLimit,
      retryAfterMs: result.retryAfterMs,
    };
  }

  async acquireConnection(userId: string, ip: string): Promise<boolean> {
    const userKey = `connections:user:${userId}`;
    const ipKey = `connections:ip:${ip}`;
    if (!await this.counter.acquire(userKey, this.config.maxPerUser)) return false;
    try {
      if (await this.counter.acquire(ipKey, this.config.maxPerIp)) return true;
      await this.counter.release(userKey);
      return false;
    } catch (error) {
      await this.counter.release(userKey);
      throw error;
    }
  }

  async releaseConnection(userId: string, ip: string): Promise<void> {
    await Promise.all([
      this.counter.release(`connections:user:${userId}`),
      this.counter.release(`connections:ip:${ip}`),
    ]);
  }

  consumeEvent(socketId: string) {
    const now = this.now();
    const refillRate = this.config.eventLimit / this.config.eventWindowMs;
    const bucket = this.buckets.get(socketId) ?? {
      tokens: this.config.eventLimit,
      updatedAt: now,
      violations: 0,
    };
    const elapsed = Math.max(0, now - bucket.updatedAt);
    bucket.tokens = Math.min(this.config.eventLimit, bucket.tokens + elapsed * refillRate);
    bucket.updatedAt = now;

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      this.buckets.set(socketId, bucket);
      return { allowed: true, disconnect: false, retryAfterMs: 0 };
    }

    bucket.violations += 1;
    this.buckets.set(socketId, bucket);
    return {
      allowed: false,
      disconnect: bucket.violations >= this.config.violationLimit,
      retryAfterMs: Math.ceil((1 - bucket.tokens) / refillRate),
    };
  }

  clearSocket(socketId: string): void {
    this.buckets.delete(socketId);
  }
}
