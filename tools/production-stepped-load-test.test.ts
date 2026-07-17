import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_PRODUCTION_CONCURRENCY,
  PRODUCTION_ORIGIN,
  PRODUCTION_STAGES,
  runProductionLoadTest,
} from "./production-stepped-load-test.js";

test("exports an immutable production-only profile", () => {
  assert.equal(PRODUCTION_ORIGIN, "https://erp.igentechsolutions.com");
  assert.equal(MAX_PRODUCTION_CONCURRENCY, 10);
  assert.deepEqual(PRODUCTION_STAGES, [
    { ratePerSecond: 2, durationMs: 120_000 },
    { ratePerSecond: 5, durationMs: 120_000 },
    { ratePerSecond: 10, durationMs: 120_000 },
    { ratePerSecond: 20, durationMs: 120_000 },
  ]);
});

test("paces stage traffic without exceeding its per-second rate", async () => {
  let now = 0;
  const loginTimes: number[] = [];
  const clock = { now: () => now, sleep: async (ms: number) => { now += ms; } };
  const fetchImpl: typeof fetch = async (input) => {
    if (String(input).endsWith("/health")) return new Response(null, { status: 200 });
    loginTimes.push(now);
    return new Response(null, { status: 401 });
  };

  const report = await runProductionLoadTest(fetchImpl, clock, new AbortController().signal, [
    { ratePerSecond: 2, durationMs: 2_000 },
  ], 0);

  assert.equal(report.stopReason, "completed");
  assert.equal(loginTimes.length, 4);
  assert.equal(loginTimes.filter((time) => time < 1_000).length, 2);
  assert.equal(loginTimes.filter((time) => time >= 1_000).length, 2);
});

test("health-checks at thirty-second boundaries", async () => {
  let now = 0;
  const healthTimes: number[] = [];
  const clock = { now: () => now, sleep: async (ms: number) => { now += ms; } };
  const fetchImpl: typeof fetch = async (input) => {
    if (String(input).endsWith("/health")) {
      healthTimes.push(now);
      return new Response(null, { status: 200 });
    }
    return new Response(null, { status: 429 });
  };

  await runProductionLoadTest(fetchImpl, clock, new AbortController().signal, [
    { ratePerSecond: 2, durationMs: 61_000 },
  ], 0);
  assert.ok(healthTimes.includes(30_000));
  assert.ok(healthTimes.includes(60_000));
});

test("stops on the first server error", async () => {
  let now = 0;
  const clock = { now: () => now, sleep: async (ms: number) => { now += ms; } };
  const fetchImpl: typeof fetch = async (input) => new Response(null, {
    status: String(input).endsWith("/health") ? 200 : 503,
  });
  const report = await runProductionLoadTest(fetchImpl, clock, new AbortController().signal, [
    { ratePerSecond: 2, durationMs: 10_000 },
  ], 0);
  assert.equal(report.stopReason, "5xx");
  assert.equal(report.stages[0]?.summary.serverErrors, 2);
});

test("stops on five consecutive network errors", async () => {
  let now = 0;
  let logins = 0;
  const clock = { now: () => now, sleep: async (ms: number) => { now += ms; } };
  const fetchImpl: typeof fetch = async (input) => {
    if (String(input).endsWith("/health")) return new Response(null, { status: 200 });
    logins += 1;
    throw new Error("simulated");
  };
  const report = await runProductionLoadTest(fetchImpl, clock, new AbortController().signal, [
    { ratePerSecond: 5, durationMs: 10_000 },
  ], 0);
  assert.equal(report.stopReason, "network-error-threshold");
  assert.equal(logins, 5);
});

test("does not start when the operator signal is already aborted", async () => {
  const controller = new AbortController();
  controller.abort();
  let calls = 0;
  const report = await runProductionLoadTest(async () => {
    calls += 1;
    return new Response(null, { status: 200 });
  }, { now: () => 0, sleep: async () => undefined }, controller.signal, [], 0);
  assert.equal(report.stopReason, "operator-abort");
  assert.equal(calls, 0);
});
