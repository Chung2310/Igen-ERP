import assert from "node:assert/strict";
import test from "node:test";
import {
  createRetailFinanceSettlementContract,
  requireRetailBranch,
  RetailScopeError,
  retailScopeFromRequest,
} from "./contracts";

test("normal users derive retail scope from their actor identity", () => {
  assert.deepEqual(
    retailScopeFromRequest(
      { role: "user", companyCode: " acme ", branchId: " b1 " },
      {},
    ),
    { companyCode: "ACME", branchId: "b1" },
  );
});

test("normal users cannot request another company or branch", () => {
  assert.throws(
    () => retailScopeFromRequest(
      { role: "user", companyCode: "ACME", branchId: "B1" },
      { companyCode: "OTHER" },
    ),
    (error) => error instanceof RetailScopeError && error.status === 403,
  );
  assert.throws(
    () => retailScopeFromRequest(
      { role: "user", companyCode: "ACME", branchId: "B1" },
      { branchId: "B2" },
    ),
    (error) => error instanceof RetailScopeError && error.status === 403,
  );
});

test("superadmin must provide explicit company and branch scope", () => {
  assert.throws(
    () => retailScopeFromRequest({ role: "superadmin" }, { branchId: "B1" }),
    (error) => error instanceof RetailScopeError && error.status === 400,
  );
  assert.throws(
    () => requireRetailBranch(retailScopeFromRequest(
      { role: "superadmin" },
      { companyCode: "ACME" },
    )),
    (error) => error instanceof RetailScopeError && error.status === 400,
  );
  assert.deepEqual(
    requireRetailBranch(retailScopeFromRequest(
      { role: "superadmin" },
      { companyCode: " acme ", branchId: "B1" },
    )),
    { companyCode: "ACME", branchId: "B1" },
  );
});

test("Finance settlement updates Retail snapshot once by event id", async () => {
  const orders = [{ _id: "o1", companyCode: "ACME", branchId: "B1", dueAmount: 50, status: "confirmed", version: 2 }];
  const contract = createRetailFinanceSettlementContract({
    async settle(filter, values) {
      const order: any = orders.find((item: any) => item._id === filter._id && item.companyCode === filter.companyCode && item.branchId === filter.branchId && (item as any).financeSettlementEventId !== filter.financeSettlementEventId.$ne);
      if (!order) return null;
      Object.assign(order, values, { version: order.version + 1 }); return order;
    },
  });
  const event = { eventId: "settled-1", companyCode: "ACME", branchId: "B1", payload: { sourceType: "retail_order", sourceId: "o1", settledAt: "2026-08-12T05:00:00.000Z" } };
  assert.equal((await contract(event))?.dueAmount, 0);
  assert.equal(await contract(event), null);
  assert.deepEqual(orders[0], { _id: "o1", companyCode: "ACME", branchId: "B1", dueAmount: 0, status: "completed", version: 3, paymentStatus: "paid", completedAt: new Date("2026-08-12T05:00:00.000Z"), financeSettlementEventId: "settled-1" });
});
