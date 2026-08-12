import assert from "node:assert/strict";
import test from "node:test";
import { retailCustomerRoutes } from "../routes/retail-customer.routes";

test("tier history is operational while override and summary require manager", () => {
  const route = (path: string) => retailCustomerRoutes.stack.find((layer: any) => layer.route?.path === path) as any;
  const history = route("/:id/tier-history"); const override = route("/:id/tier-overrides"); const summary = route("/tier-summary");
  assert.ok(history.route.methods.get && override.route.methods.post && summary.route.methods.get);
  assert.notEqual(history.route.stack[0].handle, override.route.stack[0].handle);
  assert.equal(override.route.stack[0].handle, summary.route.stack[0].handle);
});
