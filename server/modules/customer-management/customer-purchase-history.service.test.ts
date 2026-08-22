import assert from "node:assert/strict";
import test from "node:test";
import { CustomerError } from "./customer-errors";
import { createCustomerPurchaseHistoryService } from "./customer-purchase-history.service";

const scope = { companyCode: "IGEN" };
const customerId = "507f1f77bcf86cd799439011";

test("returns a newest-first safe purchase history and calculates only settled-order totals", async () => {
  let receivedFilter: Record<string, unknown> | undefined;
  let receivedSort: Record<string, unknown> | undefined;
  const service = createCustomerPurchaseHistoryService({
    customer: async () => ({ _id: customerId }),
    orders: async (filter, sort) => {
      receivedFilter = filter;
      receivedSort = sort;
      return [
        { _id: "draft", orderCode: "DH-3", status: "draft", businessDate: "2026-08-21", grandTotal: 900, paidAmount: 0, dueAmount: 0, items: [{ quantity: 4 }], salespersonName: "Linh", internalOnly: true },
        { _id: "complete", orderCode: "DH-2", status: "completed", businessDate: "2026-08-20", grandTotal: 300, paidAmount: 300, dueAmount: 0, items: [{ quantity: 1 }, { quantity: 2 }], salespersonName: "An" },
        { _id: "confirmed", orderCode: "DH-1", status: "confirmed", businessDate: "2026-08-19", grandTotal: 200, paidAmount: 50, dueAmount: 150, items: [{ quantity: 2 }], salespersonName: "Binh" },
        { _id: "cancelled", orderCode: "DH-0", status: "cancelled", businessDate: "2026-08-18", grandTotal: 100, paidAmount: 100, dueAmount: 0, items: [{ quantity: 1 }], salespersonName: "Cuong" },
      ];
    },
  });

  const result = await service.get(scope, customerId, "branch-a");

  assert.deepEqual(receivedFilter, { companyCode: "IGEN", branchId: "branch-a", customerId });
  assert.deepEqual(receivedSort, { businessDate: -1, _id: -1 });
  assert.deepEqual(result.summary, { orderCount: 4, totalPurchased: 500, totalPaid: 350, currentDebt: 150, lastPurchaseAt: "2026-08-20" });
  assert.deepEqual(result.items, [
    { _id: "draft", orderCode: "DH-3", status: "draft", businessDate: "2026-08-21", grandTotal: 900, paidAmount: 0, dueAmount: 0, itemCount: 4, salespersonName: "Linh" },
    { _id: "complete", orderCode: "DH-2", status: "completed", businessDate: "2026-08-20", grandTotal: 300, paidAmount: 300, dueAmount: 0, itemCount: 3, salespersonName: "An" },
    { _id: "confirmed", orderCode: "DH-1", status: "confirmed", businessDate: "2026-08-19", grandTotal: 200, paidAmount: 50, dueAmount: 150, itemCount: 2, salespersonName: "Binh" },
    { _id: "cancelled", orderCode: "DH-0", status: "cancelled", businessDate: "2026-08-18", grandTotal: 100, paidAmount: 100, dueAmount: 0, itemCount: 1, salespersonName: "Cuong" },
  ]);
});

test("requires a branch and returns CUSTOMER_NOT_FOUND outside the company scope", async () => {
  const service = createCustomerPurchaseHistoryService({ customer: async () => null, orders: async () => [] });

  await assert.rejects(() => service.get(scope, customerId, ""), (error: unknown) => error instanceof CustomerError && error.code === "CUSTOMER_BRANCH_REQUIRED");
  await assert.rejects(() => service.get(scope, customerId, "branch-a"), (error: unknown) => error instanceof CustomerError && error.code === "CUSTOMER_NOT_FOUND" && error.status === 404);
});

test("rejects malformed customer IDs before repository lookup", async () => {
  let customerLookedUp = false;
  const service = createCustomerPurchaseHistoryService({
    customer: async () => { customerLookedUp = true; return null; },
    orders: async () => [],
  });

  await assert.rejects(() => service.get(scope, "not-an-object-id", "branch-a"), (error: unknown) => error instanceof CustomerError && error.code === "CUSTOMER_ID_INVALID" && error.status === 400);
  assert.equal(customerLookedUp, false);
});

test("uses company-only scope for customer lookup and branch scope only for orders", async () => {
  let customerScope: unknown;
  let orderFilter: unknown;
  const service = createCustomerPurchaseHistoryService({
    customer: async (receivedScope) => { customerScope = receivedScope; return { _id: customerId }; },
    orders: async (filter) => { orderFilter = filter; return []; },
  });

  await service.get({ companyCode: "IGEN" }, customerId, "branch-a");

  assert.deepEqual(customerScope, { companyCode: "IGEN" });
  assert.deepEqual(orderFilter, { companyCode: "IGEN", branchId: "branch-a", customerId });
});
