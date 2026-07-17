import assert from "node:assert/strict";
import test from "node:test";
import { SocketProtection, type SocketProtectionCounter } from "./socket-protection";

class FakeCounter implements SocketProtectionCounter {
  counts = new Map<string, number>();
  failAcquireKey: string | null = null;

  async incrementWindow(key: string) {
    const count = (this.counts.get(key) ?? 0) + 1;
    this.counts.set(key, count);
    return { count, retryAfterMs: 1000 };
  }

  async acquire(key: string, limit: number) {
    if (key === this.failAcquireKey) throw new Error("redis acquire failed");
    const count = (this.counts.get(key) ?? 0) + 1;
    if (count > limit) return false;
    this.counts.set(key, count);
    return true;
  }

  async release(key: string) {
    this.counts.set(key, Math.max(0, (this.counts.get(key) ?? 0) - 1));
  }
}

const config = {
  handshakeWindowMs: 60_000,
  handshakeLimit: 2,
  maxPerUser: 2,
  maxPerIp: 3,
  eventWindowMs: 60_000,
  eventLimit: 2,
  violationLimit: 2,
};

test("rejects handshake attempts above the IP limit", async () => {
  const protection = new SocketProtection(new FakeCounter(), config);
  assert.equal((await protection.checkHandshake("1.2.3.4")).allowed, true);
  assert.equal((await protection.checkHandshake("1.2.3.4")).allowed, true);
  const rejected = await protection.checkHandshake("1.2.3.4");
  assert.equal(rejected.allowed, false);
  assert.equal(rejected.retryAfterMs, 1000);
});

test("enforces user and IP connection limits and rolls back partial acquisition", async () => {
  const counter = new FakeCounter();
  const protection = new SocketProtection(counter, config);
  assert.equal(await protection.acquireConnection("user-1", "ip-1"), true);
  assert.equal(await protection.acquireConnection("user-1", "ip-1"), true);
  assert.equal(await protection.acquireConnection("user-1", "ip-1"), false);
  assert.equal(counter.counts.get("connections:user:user-1"), 2);
  assert.equal(counter.counts.get("connections:ip:ip-1"), 2);
});

test("releases user and IP counters on disconnect", async () => {
  const counter = new FakeCounter();
  const protection = new SocketProtection(counter, config);
  await protection.acquireConnection("user-1", "ip-1");
  await protection.releaseConnection("user-1", "ip-1");
  assert.equal(counter.counts.get("connections:user:user-1"), 0);
  assert.equal(counter.counts.get("connections:ip:ip-1"), 0);
});

test("rolls back the user counter when IP acquisition throws", async () => {
  const counter = new FakeCounter();
  counter.failAcquireKey = "connections:ip:ip-1";
  const protection = new SocketProtection(counter, config);
  await assert.rejects(protection.acquireConnection("user-1", "ip-1"), /redis acquire failed/);
  assert.equal(counter.counts.get("connections:user:user-1"), 0);
});

test("limits event tokens and disconnects after repeated violations", async () => {
  const protection = new SocketProtection(new FakeCounter(), config);
  assert.equal((await protection.consumeEvent("user-1", "socket-1")).allowed, true);
  assert.equal((await protection.consumeEvent("user-1", "socket-1")).allowed, true);
  const firstViolation = await protection.consumeEvent("user-1", "socket-1");
  assert.equal(firstViolation.allowed, false);
  assert.equal(firstViolation.disconnect, false);
  const secondViolation = await protection.consumeEvent("user-1", "socket-1");
  assert.equal(secondViolation.disconnect, true);

  assert.equal((await protection.consumeEvent("user-2", "socket-2")).allowed, true);
});

test("allows one connection for one hundred users sharing an IP", async () => {
  const protection = new SocketProtection(new FakeCounter(), { ...config, maxPerIp: 500 });
  for (let index = 0; index < 100; index++) {
    assert.equal(await protection.acquireConnection(`user-${index}`, "shared-ip"), true);
  }
});

test("shares the event quota across sockets owned by one user", async () => {
  const protection = new SocketProtection(new FakeCounter(), config);
  assert.equal((await protection.consumeEvent("user-1", "socket-1")).allowed, true);
  assert.equal((await protection.consumeEvent("user-1", "socket-2")).allowed, true);
  assert.equal((await protection.consumeEvent("user-1", "socket-3")).allowed, false);
});
