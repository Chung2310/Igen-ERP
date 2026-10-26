import assert from "node:assert/strict";
import test from "node:test";
import { cashierShiftRoutes } from "./cashier-shift.routes";

const mountedPaths = () => cashierShiftRoutes.stack
  .map((layer: any) => layer.route?.path)
  .filter(Boolean);

test("cashier shift routes expose assignment, session control and reconciliation", () => {
  const paths = mountedPaths();
  assert.ok(paths.includes("/open"));
  assert.ok(paths.includes("/cashiers"));
  assert.ok(paths.includes("/open-for"));
  assert.ok(paths.includes("/:id/close"));
  assert.ok(paths.includes("/:id/pause"));
  assert.ok(paths.includes("/:id/resume"));
  assert.ok(paths.includes("/:id/movements"));
  assert.ok(paths.includes("/:id/reconcile"));
});
