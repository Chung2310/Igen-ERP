import assert from "node:assert/strict";
import test from "node:test";
import { retailDebtReminderRoutes } from "../routes/retail-debt-reminder.routes";

test("all debt reminder management endpoints require the manager guard", () => {
  const routes = ["/runs", "/runs/:id", "/run", "/deliveries/:id/retry"].map((path) => retailDebtReminderRoutes.stack.find((layer: any) => layer.route?.path === path) as any);
  assert.ok(routes.every((route) => route?.route));
  assert.equal(new Set(routes.map((route) => route.route.stack[0].handle)).size, 1);
  assert.ok(routes[0].route.methods.get && routes[1].route.methods.get && routes[2].route.methods.post && routes[3].route.methods.post);
});
