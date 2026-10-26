import assert from "node:assert/strict";
import test from "node:test";
import { cashierShiftRoutes } from "./cashier-shift.routes";

const mountedPaths = () => cashierShiftRoutes.stack
  .map((layer: any) => layer.route?.path)
  .filter(Boolean);

test("cashier shift routes protect session, drawer and settlement operations", () => {
  const paths = mountedPaths();
  assert.ok(paths.includes("/open"));
  assert.ok(paths.includes("/cashiers"));
  assert.equal(paths.includes("/open-for"), false, "assigned cashier sessions use the manager-only open route");
  assert.ok(paths.includes("/:id/close"));
  for (const path of ["/:id/resume", "/:id/pause", "/:id/cash-movements", "/:id/drawer", "/:id/reconcile", "/settlements"]) assert.ok(paths.includes(path));
  assert.ok(cashierShiftRoutes.stack.filter((layer: any) => layer.route).every((layer: any) => layer.route.stack.length >= 2));
  assert.equal(paths.includes("/:id/approve"), false);
});
