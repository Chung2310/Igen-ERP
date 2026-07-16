import Redis from "ioredis";
import type { Options, Store } from "express-rate-limit";

export interface RateLimitRedisClient {
  eval(script: string, keyCount: number, ...args: string[]): Promise<unknown>;
  decr(key: string): Promise<number>;
  del(key: string): Promise<number>;
}

const INCREMENT_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('PTTL', KEYS[1])
return { count, ttl }
`;

let sharedClient: Redis | null = null;
let lastRedisWarningAt = 0;

export function getRateLimitRedisClient(): Redis {
  if (sharedClient) return sharedClient;

  sharedClient = new Redis({
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    retryStrategy: (times) => Math.min(times * 250, 5000),
  });

  sharedClient.on("error", (error) => {
    const now = Date.now();
    if (now - lastRedisWarningAt >= 60_000) {
      lastRedisWarningAt = now;
      console.warn(`[DDoS] Redis rate-limit unavailable; application limiters fail open: ${error.message}`);
    }
  });

  return sharedClient;
}

export class RedisRateLimitStore implements Store {
  readonly localKeys = false;
  readonly prefix: string;
  private windowMs = 60_000;

  constructor(
    private readonly client: RateLimitRedisClient,
    prefix: string,
  ) {
    this.prefix = prefix;
  }

  init(options: Options): void {
    this.windowMs = options.windowMs;
  }

  async increment(key: string) {
    const result = await this.client.eval(
      INCREMENT_SCRIPT,
      1,
      this.prefixed(key),
      String(this.windowMs),
    );
    if (!Array.isArray(result) || result.length < 2) {
      throw new Error("Invalid Redis rate-limit response");
    }
    const totalHits = Number(result[0]);
    const ttl = Math.max(0, Number(result[1]));
    if (!Number.isInteger(totalHits) || totalHits < 1) {
      throw new Error("Invalid Redis rate-limit hit count");
    }
    return { totalHits, resetTime: new Date(Date.now() + ttl) };
  }

  async decrement(key: string): Promise<void> {
    await this.client.decr(this.prefixed(key));
  }

  async resetKey(key: string): Promise<void> {
    await this.client.del(this.prefixed(key));
  }

  private prefixed(key: string): string {
    return `${this.prefix}${key}`;
  }
}
