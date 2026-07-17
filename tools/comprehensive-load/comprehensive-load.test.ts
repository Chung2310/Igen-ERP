import assert from "node:assert/strict";
import test from "node:test";

import { MAX_VUS, SCENARIOS, STAGES, STAGING_ORIGIN, selectScenario } from "./profile.js";
import { getCircuitReason, summarizeMetrics } from "./metrics.js";
import { createManifest, recordResource, serializeManifest, validateCleanupTarget } from "./manifest.js";
import { runLoadProfile } from "./runner.js";
import { LoadTestApiClient, requireRuntimeCredentials } from "./api-client.js";
import { setupSyntheticUsers } from "./setup.js";
import { cleanupManifest } from "./cleanup.js";

test("defines the immutable staging profile", () => {
  assert.equal(STAGING_ORIGIN, "https://staging-erp.igentechsolutions.com");
  assert.equal(MAX_VUS, 1_000);
  assert.equal(SCENARIOS.reduce((sum, item) => sum + item.weight, 0), 100);
  assert.equal(STAGES.at(-2)?.vus, 1_000);
  assert.equal(selectScenario(0).name, "auth");
  assert.equal(selectScenario(99.9).name, "chat");
});

test("calculates percentiles and circuit reasons", () => {
  const summary = summarizeMetrics(Array.from({ length: 100 }, (_, index) => ({
    status: index === 99 ? 503 : 200,
    latencyMs: index + 1,
    validLogin: false,
  })));
  assert.equal(summary.p50LatencyMs, 50);
  assert.equal(summary.p95LatencyMs, 95);
  assert.equal(summary.p99LatencyMs, 99);
  assert.equal(getCircuitReason(summary), null);
  assert.equal(getCircuitReason({ ...summary, serverErrors: 2 }), "5xx-threshold");
  assert.equal(getCircuitReason({ ...summary, p95LatencyMs: 1_001 }), "latency-threshold");
});

test("serializes a secret-free cleanup manifest", () => {
  const manifest = createManifest("20260716-a");
  recordResource(manifest, "users", "user-1", "LOADTEST-20260716-a-user-1@example.invalid");
  const json = serializeManifest(manifest);
  assert.ok(json.includes("user-1"));
  assert.ok(!json.includes("password"));
  assert.equal(validateCleanupTarget(manifest, "users", "user-1"), true);
  assert.equal(validateCleanupTarget(manifest, "users", "foreign"), false);
});

test("runs bounded virtual users with injected workflows and clock", async () => {
  let now = 0;
  let calls = 0;
  const report = await runLoadProfile({
    clock: { now: () => now, sleep: async (ms) => { now += ms; } },
    random: () => 0,
    health: async () => true,
    executeScenario: async () => {
      calls += 1;
      return { status: 200, latencyMs: 10, validLogin: false };
    },
    signal: new AbortController().signal,
  }, [{ vus: 2, durationMs: 5_000 }]);
  assert.equal(report.stopReason, "completed");
  assert.ok(calls > 0);
  assert.ok(report.maxActiveVus <= 2);
});

test("requires runtime credentials without persisting them", () => {
  assert.throws(() => requireRuntimeCredentials({}), /LOAD_TEST_ADMIN_EMAIL/);
  assert.deepEqual(requireRuntimeCredentials({
    LOAD_TEST_ADMIN_EMAIL: "admin@example.invalid",
    LOAD_TEST_ADMIN_PASSWORD: "secret",
    LOAD_TEST_USER_PASSWORD: "synthetic-secret",
    LOAD_TEST_BYPASS_SECRET: "0123456789abcdef0123456789abcdef",
  }), {
    adminEmail: "admin@example.invalid",
    adminPassword: "secret",
    userPassword: "synthetic-secret",
    bypassSecret: "0123456789abcdef0123456789abcdef",
  });
});

test("API client is locked to staging and sends bearer auth only to allowed paths", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    calls.push({ url: String(input), init });
    if (String(input).endsWith("/auth/login")) {
      return Response.json({ accessToken: "test-token", user: { id: "admin-1" } });
    }
    return Response.json({ data: { id: "user-1" } }, { status: 201 });
  };
  const client = new LoadTestApiClient(fetchImpl);
  await client.login("admin@example.invalid", "secret");
  await client.createUser({ displayName: "LOADTEST-run-user", email: "user@example.invalid", password: "secret" });
  assert.ok(calls.every((call) => call.url.startsWith(STAGING_ORIGIN)));
  assert.equal((calls[1].init?.headers as Record<string, string>).authorization, "Bearer test-token");
  await assert.rejects(() => client.request("POST", "/webhook/payment"), /not allowlisted/);
});

test("setup creates bounded marked users and cleanup deletes only manifest IDs", async () => {
  const created: string[] = [];
  const deleted: string[] = [];
  const client = {
    login: async () => ({ userId: "admin" }),
    createUser: async ({ email }: { email: string }) => {
      created.push(email);
      return { id: `id-${created.length}` };
    },
    deleteUser: async (id: string) => { deleted.push(id); },
  };
  const manifest = await setupSyntheticUsers(client, {
    runId: "run-a", count: 5, adminEmail: "admin@example.invalid", adminPassword: "x", userPassword: "y",
  });
  assert.equal(manifest.resources.users.length, 5);
  assert.ok(created.every((email) => email.includes("LOADTEST-run-a")));
  await cleanupManifest(client, manifest);
  assert.deepEqual(deleted, ["id-5", "id-4", "id-3", "id-2", "id-1"]);
  assert.equal(manifest.state, "cleaned");
});
