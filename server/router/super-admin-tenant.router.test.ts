import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { createTenantRouter } from "./super-admin-tenant.router";

const tenant = { code: "ACME", name: "Acme", ownerEmail: "owner@acme.test", lifecycleStatus: "active" as const, createdAt: new Date() };

async function serve() {
  const calls: any[] = [];
  const service: any = {
    list: async () => [tenant], get: async (code: string) => code === "ACME" ? tenant : null,
    create: async (input: any) => ({ ...tenant, ...input, code: input.code.toUpperCase() }),
    update: async () => tenant, transitionLifecycle: async () => ({ ...tenant, lifecycleStatus: "suspended" }),
    scheduleDeletion: async () => ({ ...tenant, lifecycleStatus: "scheduled-deletion" }), cancelDeletion: async () => tenant,
  };
  const app = express(); app.use(express.json()); app.use((req: any, _res, next) => { req.user = { id: "admin-1", role: "superadmin", sessionId: "s-1" }; next(); });
  app.use(createTenantRouter({ service, execute: async (_context: any, request: any, handler: any) => { if (request.definition.requiresReason && !request.reason?.trim()) throw new Error("A written reason is required"); calls.push(request); return { actionId: "action-1", result: await handler(request.input) }; } }));
  const server = await new Promise<any>((resolve) => { const value = app.listen(0, () => resolve(value)); });
  return { calls, url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise<void>((resolve) => server.close(resolve)) };
}

test("lists, validates, and mutates only the requested tenant with an action id", async () => {
  const api = await serve();
  try {
    const listed = await fetch(`${api.url}/tenants`).then((r) => r.json());
    assert.equal(listed.tenants[0].code, "ACME");
    assert.equal((await fetch(`${api.url}/tenants/OTHER`).then((r) => r)).status, 404);
    assert.equal((await fetch(`${api.url}/tenants`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: "ACME" }) })).status, 400);
    const created = await fetch(`${api.url}/tenants`, { method: "POST", headers: { "content-type": "application/json", "idempotency-key": "k1" }, body: JSON.stringify({ code: "NEW", name: "New", ownerEmail: "new@test" }) }).then((r) => r.json());
    assert.equal(created.actionId, "action-1"); assert.equal(created.result.code, "NEW");
    assert.equal(api.calls[0].definition.type, "tenant.create");
  } finally { await api.close(); }
});

test("requires a written reason for scheduled deletion and links the audited action", async () => {
  const api = await serve();
  try {
    assert.equal((await fetch(`${api.url}/tenants/ACME/deletion`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })).status, 400);
    const response = await fetch(`${api.url}/tenants/ACME/deletion`, { method: "POST", headers: { "content-type": "application/json", "idempotency-key": "delete-1" }, body: JSON.stringify({ reason: "contract ended", password: "pw", token: "123456", step: 1 }) });
    const data = await response.json(); assert.equal(data.actionId, "action-1"); assert.equal(api.calls[0].definition.type, "tenant.deletion.schedule"); assert.equal(api.calls[0].reason, "contract ended");
  } finally { await api.close(); }
});
