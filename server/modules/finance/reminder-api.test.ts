import assert from "node:assert/strict";
import test from "node:test";
import { createReminderController } from "./controllers/reminder.controller";
import { financeReminderRoutes, FINANCE_REMINDER_ROUTE_PERMISSIONS } from "./routes/reminder.routes";

test("reminder routes expose history, detail, manual run, and retry with exact permissions", () => {
  assert.deepEqual(FINANCE_REMINDER_ROUTE_PERMISSIONS, {
    "GET /runs": "receivable:read",
    "GET /runs/:id": "receivable:read",
    "POST /runs": "receivable:adjust",
    "POST /deliveries/:id/retry": "receivable:adjust",
  });
  const routes = financeReminderRoutes.stack
    .filter((layer: any) => layer.route)
    .map((layer: any) => `${Object.keys(layer.route.methods)[0].toUpperCase()} ${layer.route.path}`);
  assert.deepEqual(routes, Object.keys(FINANCE_REMINDER_ROUTE_PERMISSIONS));
  assert.equal(financeReminderRoutes.stack.filter((layer: any) => layer.route).every((layer: any) => layer.route.stack.length === 2), true);
});

test("controller derives scope, ignores body scope, and passes actor to manual commands", async () => {
  const calls: any[] = [];
  const dependencies = Object.fromEntries(["list", "detail", "run", "retry"].map((name) => [name, async (...args: any[]) => {
    calls.push([name, ...args]);
    return { name };
  }]));
  const controller: any = createReminderController(dependencies);
  const response = { json(value: any) { return value; } } as any;
  const actor = { id: "u1", role: "user", companyCode: "ACME", branchId: "B1" };

  await controller.run({ user: actor, query: {}, params: {}, body: { companyCode: "EVIL", branchId: "B9" } }, response, assert.fail);
  await controller.retry({ user: actor, query: {}, params: { id: "d1" }, body: { branchId: "B9" } }, response, assert.fail);

  assert.deepEqual(calls[0], ["run", { companyCode: "ACME", branchId: "B1" }, actor]);
  assert.deepEqual(calls[1], ["retry", { companyCode: "ACME", branchId: "B1" }, "d1", actor]);
});

test("controller scopes history and forwards dependency errors", async () => {
  const calls: any[] = [];
  const error = new Error("boom");
  const controller: any = createReminderController({
    list: async (...args: any[]) => { calls.push(args); return []; },
    detail: async () => { throw error; },
    run: async () => ({}),
    retry: async () => ({}),
  });
  const response = { json(value: any) { return value; } } as any;
  const request: any = { user: { role: "superadmin" }, query: { companyCode: "acme", branchId: "B1", limit: "20" }, params: {}, body: {} };
  await controller.list(request, response, assert.fail);
  assert.deepEqual(calls[0], [{ companyCode: "ACME", branchId: "B1" }, request.query]);
  let forwarded: unknown;
  await controller.detail({ ...request, params: { id: "r1" } }, response, (value: unknown) => { forwarded = value; });
  assert.equal(forwarded, error);
});
