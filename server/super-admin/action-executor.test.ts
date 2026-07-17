import assert from "node:assert/strict";
import test from "node:test";
import { createActionExecutor } from "./action-executor";

test("dangerous actions require reason and step-up before invoking handler", async () => {
  let invoked = false;
  const execute = createActionExecutor({ reserve: async () => ({ fresh: true }), complete: async () => undefined, audit: async () => undefined, stepUp: async () => true, hash: () => "hash", id: () => "a1" });
  await assert.rejects(() => execute({ actorId: "u1", sessionId: "s1" }, { definition: { type: "security.session.revoke", risk: "dangerous", requiresReason: true, requiresStepUp: true, parse: (v: any) => v }, input: {}, idempotencyKey: "k1" }, async () => { invoked = true; }), /reason/i);
  assert.equal(invoked, false);
});

test("exact duplicate returns its stored result without running twice", async () => {
  let calls = 0;
  const execute = createActionExecutor({ reserve: async () => ({ fresh: false, result: { ok: true }, requestHash: "hash" }), complete: async () => undefined, audit: async () => undefined, stepUp: async () => true, hash: () => "hash", id: () => "a1" });
  const result = await execute({ actorId: "u1", sessionId: "s1" }, { definition: { type: "x", risk: "standard", requiresReason: false, requiresStepUp: false, parse: (v: any) => v }, input: {}, idempotencyKey: "k1" }, async () => { calls++; });
  assert.deepEqual(result, { ok: true }); assert.equal(calls, 0);
});
