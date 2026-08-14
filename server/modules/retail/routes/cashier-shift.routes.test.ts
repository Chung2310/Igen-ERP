import assert from "node:assert/strict";
import test from "node:test";
import { cashierShiftRoutes } from "./cashier-shift.routes";

const mountedPaths = () => cashierShiftRoutes.stack
  .map((layer: any) => layer.route?.path)
  .filter(Boolean);

test("cashier shift routes expose only opening and closing mutations", () => {
  const paths = mountedPaths();
  assert.ok(paths.includes("/open"));
  assert.ok(paths.includes("/:id/close"));
  assert.equal(paths.includes("/:id/cash-movements"), false);
  assert.equal(paths.includes("/:id/approve"), false);
});
