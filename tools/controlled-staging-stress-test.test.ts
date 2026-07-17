import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_CONCURRENCY,
  MAX_DURATION_MS,
  MAX_RATE_PER_SECOND,
  MAX_REQUESTS,
  STAGING_ORIGIN,
  getCircuitReason,
  parseOptions,
  runStressTest,
  summarize,
} from "./controlled-staging-stress-test.js";

test("exports immutable staging safety limits", () => {
  assert.equal(STAGING_ORIGIN, "https://staging-erp.igentechsolutions.com");
  assert.equal(MAX_REQUESTS, 10_000);
  assert.equal(MAX_CONCURRENCY, 10);
  assert.equal(MAX_RATE_PER_SECOND, 20);
  assert.equal(MAX_DURATION_MS, 600_000);
});

test("uses safe defaults and accepts bounded positive integers", () => {
  assert.deepEqual(parseOptions([]), { requests: 50, concurrency: 5 });
  assert.deepEqual(parseOptions(["--requests", "24", "--concurrency", "4"]), {
    requests: 24,
    concurrency: 4,
  });
});

test("clamps excessive values and rejects invalid values", () => {
  assert.deepEqual(parseOptions(["--requests", "99999", "--concurrency", "999"]), {
    requests: MAX_REQUESTS,
    concurrency: MAX_CONCURRENCY,
  });

  for (const invalid of ["0", "-1", "1.5", "NaN", "", "--target"]) {
    assert.deepEqual(
      parseOptions(["--requests", invalid, "--concurrency", invalid]),
      { requests: 50, concurrency: 5 },
    );
  }
});

test("ignores unsupported target overrides", () => {
  assert.deepEqual(
    parseOptions(["--target", "https://example.com", "--requests", "12"]),
    { requests: 12, concurrency: 5 },
  );
});

test("summarizes statuses and latency", () => {
  const summary = summarize([
    { status: 401, latencyMs: 10 },
    { status: 429, latencyMs: 30 },
    { status: 503, latencyMs: 50 },
    { latencyMs: 70 },
  ]);
  assert.deepEqual(summary, {
    completed: 4,
    statusCounts: { "401": 1, "429": 1, "503": 1 },
    networkErrors: 1,
    averageLatencyMs: 40,
    p95LatencyMs: 70,
    serverErrors: 1,
  });
});

test("trips only above five percent 5xx after twenty completions", () => {
  assert.equal(getCircuitReason(summarize(Array.from({ length: 19 }, () => ({ status: 503, latencyMs: 1 })))), null);
  assert.equal(getCircuitReason(summarize(Array.from({ length: 20 }, () => ({ status: 429, latencyMs: 1 })))), null);
  assert.equal(getCircuitReason(summarize([
    ...Array.from({ length: 18 }, () => ({ status: 401, latencyMs: 1 })),
    { status: 503, latencyMs: 1 },
    { status: 503, latencyMs: 1 },
  ])), "5xx-threshold");
});

test("aborts before login traffic when initial health check is unhealthy", async () => {
  const calls: string[] = [];
  const fakeFetch: typeof fetch = async (input) => {
    calls.push(String(input));
    return new Response(null, { status: 503 });
  };

  const report = await runStressTest({ requests: 10, concurrency: 5 }, fakeFetch);
  assert.equal(report.stopReason, "health-failure");
  assert.equal(report.summary.completed, 0);
  assert.deepEqual(calls, [`${STAGING_ORIGIN}/api/v1/health`]);
});

test("bounds concurrency and health-checks every batch", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  let active = 0;
  let peak = 0;
  const fakeFetch: typeof fetch = async (input, init) => {
    calls.push({ url: String(input), init });
    if (String(input).endsWith("/health")) return new Response(null, { status: 200 });
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 2));
    active -= 1;
    return new Response(null, { status: 401 });
  };

  const report = await runStressTest({ requests: 7, concurrency: 3 }, fakeFetch);
  const healthCalls = calls.filter(({ url }) => url.endsWith("/health"));
  const loginCalls = calls.filter(({ url }) => url.endsWith("/auth/login"));
  assert.equal(report.stopReason, "completed");
  assert.equal(peak, 3);
  assert.equal(healthCalls.length, 2);
  assert.equal(loginCalls.length, 7);
  assert.ok(calls.every(({ url }) => url.startsWith(STAGING_ORIGIN)));
  assert.ok(loginCalls.every(({ init }) => init?.method === "POST"));
  assert.ok(loginCalls.every(({ init }) => String(init?.body).includes("@example.invalid")));
  assert.ok(loginCalls.every(({ init }) => !String(init?.body).includes("abc@gmail.com")));
});

test("stops additional batches when the 5xx circuit trips", async () => {
  let loginCount = 0;
  const fakeFetch: typeof fetch = async (input) => {
    if (String(input).endsWith("/health")) return new Response(null, { status: 200 });
    loginCount += 1;
    return new Response(null, { status: loginCount > 18 ? 503 : 401 });
  };

  const report = await runStressTest({ requests: 30, concurrency: 10 }, fakeFetch);
  assert.equal(report.stopReason, "5xx-threshold");
  assert.equal(report.summary.completed, 20);
  assert.equal(loginCount, 20);
});

test("issues no more than twenty login attempts per one-second window", async () => {
  let now = 0;
  const issuedAt: number[] = [];
  const clock = {
    now: () => now,
    sleep: async (ms: number) => { now += ms; },
  };
  const fakeFetch: typeof fetch = async (input) => {
    if (String(input).endsWith("/health")) return new Response(null, { status: 200 });
    issuedAt.push(now);
    return new Response(null, { status: 401 });
  };

  const report = await runStressTest({ requests: 40, concurrency: 10 }, fakeFetch, clock);
  assert.equal(report.stopReason, "completed");
  assert.equal(issuedAt.length, 40);
  assert.equal(issuedAt.filter((time) => time < 1_000).length, 20);
  assert.equal(issuedAt.filter((time) => time >= 1_000 && time < 2_000).length, 20);
  assert.ok(report.durationMs >= 1_000);
});

test("health-checks before traffic, each hundred completions, and after the final group", async () => {
  let now = 0;
  let healthCalls = 0;
  const clock = { now: () => now, sleep: async (ms: number) => { now += ms; } };
  const fakeFetch: typeof fetch = async (input) => {
    if (String(input).endsWith("/health")) {
      healthCalls += 1;
      return new Response(null, { status: 200 });
    }
    return new Response(null, { status: 401 });
  };

  const report = await runStressTest({ requests: 250, concurrency: 10 }, fakeFetch, clock);
  assert.equal(report.stopReason, "completed");
  assert.equal(healthCalls, 4);
});

test("stops after ten consecutive login network errors", async () => {
  let loginCalls = 0;
  let now = 0;
  const clock = { now: () => now, sleep: async (ms: number) => { now += ms; } };
  const fakeFetch: typeof fetch = async (input) => {
    if (String(input).endsWith("/health")) return new Response(null, { status: 200 });
    loginCalls += 1;
    throw new Error("simulated network failure");
  };

  const report = await runStressTest({ requests: 100, concurrency: 10 }, fakeFetch, clock);
  assert.equal(report.stopReason, "network-error-threshold");
  assert.equal(loginCalls, 10);
});
