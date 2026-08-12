import assert from "node:assert/strict";
import test from "node:test";
import * as controllerModule from "../controllers/retail-receivable.controller";
import { retailReceivableRoutes } from "../routes/retail-receivable.routes";

test("receivable controller derives scope and actor for history and adjustment", async () => {
  const create = (controllerModule as any).createRetailReceivableController;
  assert.equal(typeof create, "function");
  const calls: any[] = [];
  const controller = create({
    history: async (...args: any[]) => { calls.push(["history", ...args]); return { items: [] }; },
    adjust: async (...args: any[]) => { calls.push(["adjust", ...args]); return { _id: "e1" }; },
    reverse: async (...args: any[]) => { calls.push(["reverse", ...args]); return { _id: "e2" }; },
  });
  const actor = { id: "u1", companyCode: "ACME", branchId: "B1" };
  const response = () => ({ json(value: unknown) { return value; } });
  await controller.history({ user: actor, query: { type: "payment" }, params: { customerId: "c1" } } as any, response() as any, () => undefined);
  await controller.adjustment({ user: actor, query: {}, body: { customerId: "c1", amount: 10, reason: "Sửa" } } as any, response() as any, () => undefined);
  await controller.reversal({ user: actor, query: {}, body: { reason: "Đảo" }, params: { entryId: "e1" } } as any, response() as any, () => undefined);
  assert.deepEqual(calls[0], ["history", { companyCode: "ACME", branchId: "B1" }, "c1", { type: "payment" }]);
  assert.deepEqual(calls[1], ["adjust", { companyCode: "ACME", branchId: "B1" }, { customerId: "c1", amount: 10, reason: "Sửa" }, actor]);
  assert.deepEqual(calls[2], ["reverse", { companyCode: "ACME", branchId: "B1" }, "e1", "Đảo", actor]);
});

test("receivable routes guard mutations separately from history", () => {
  const history = retailReceivableRoutes.stack.find((layer: any) => layer.route?.path === "/customers/:customerId") as any;
  const adjustment = retailReceivableRoutes.stack.find((layer: any) => layer.route?.path === "/adjustments") as any;
  const reversal = retailReceivableRoutes.stack.find((layer: any) => layer.route?.path === "/:entryId/reversal") as any;
  assert.equal(history.route.stack.length, 2);
  assert.equal(adjustment.route.stack.length, 2);
  assert.equal(reversal.route.stack.length, 2);
  assert.notEqual(history.route.stack[0].handle, adjustment.route.stack[0].handle);
});
