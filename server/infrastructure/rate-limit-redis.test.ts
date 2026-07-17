import assert from "node:assert/strict";
import test from "node:test";
import { RedisRateLimitStore, type RateLimitRedisClient } from "./rate-limit-redis";

class FakeRedis implements RateLimitRedisClient {
  values = new Map<string, { count: number; ttl: number }>();
  fail = false;

  async eval(_script: string, _keyCount: number, key: string, windowMs: string) {
    if (this.fail) throw new Error("redis unavailable");
    const current = this.values.get(key) ?? { count: 0, ttl: Number(windowMs) };
    current.count += 1;
    this.values.set(key, current);
    return [current.count, current.ttl];
  }

  async decr(key: string) {
    const current = this.values.get(key);
    if (!current) return 0;
    current.count = Math.max(0, current.count - 1);
    return current.count;
  }

  async del(key: string) {
    return this.values.delete(key) ? 1 : 0;
  }
}

test("increments a namespaced key and returns its reset time", async () => {
  const redis = new FakeRedis();
  const store = new RedisRateLimitStore(redis, "global:");
  store.init({ windowMs: 5000 } as never);

  const first = await store.increment("client-1");
  const second = await store.increment("client-1");

  assert.equal(first.totalHits, 1);
  assert.equal(second.totalHits, 2);
  assert.ok(first.resetTime instanceof Date);
  assert.equal(redis.values.has("global:client-1"), true);
});

test("keeps limiter prefixes independent", async () => {
  const redis = new FakeRedis();
  const globalStore = new RedisRateLimitStore(redis, "global:");
  const publicStore = new RedisRateLimitStore(redis, "public:");
  globalStore.init({ windowMs: 1000 } as never);
  publicStore.init({ windowMs: 1000 } as never);

  assert.equal((await globalStore.increment("ip")).totalHits, 1);
  assert.equal((await publicStore.increment("ip")).totalHits, 1);
});

test("decrements and resets keys", async () => {
  const redis = new FakeRedis();
  const store = new RedisRateLimitStore(redis, "test:");
  store.init({ windowMs: 1000 } as never);
  await store.increment("ip");
  await store.increment("ip");
  await store.decrement("ip");
  assert.equal(redis.values.get("test:ip")?.count, 1);
  await store.resetKey("ip");
  assert.equal(redis.values.has("test:ip"), false);
});

test("propagates Redis failures for passOnStoreError handling", async () => {
  const redis = new FakeRedis();
  redis.fail = true;
  const store = new RedisRateLimitStore(redis, "test:");
  store.init({ windowMs: 1000 } as never);
  await assert.rejects(store.increment("ip"), /redis unavailable/);
});
