import assert from "node:assert/strict";
import test from "node:test";
import {
  assertHeldDraftAccess,
  assertHeldDraftCapacity,
  formatRetailDocumentCode,
  isHeldDraftExpired,
  normalizePayments,
  paymentStatusFor,
  serializeRetailOrder,
} from "./retail-order.service";
import * as orderService from "./retail-order.service";
import { readFileSync } from "node:fs";

test("order debt ledger inputs use deterministic keys for the same transaction", () => {
  const receivableEntriesForOrderChange = (orderService as any).receivableEntriesForOrderChange;
  assert.equal(typeof receivableEntriesForOrderChange, "function");
  assert.deepEqual(receivableEntriesForOrderChange("confirm", { _id: "o1", customerId: "c1", dueAmount: 70_000 }, 0), [{
    type: "charge", customerId: "c1", orderId: "o1", amount: 70_000, idempotencyKey: "retail-order:o1:debt-charge",
  }]);
  assert.deepEqual(receivableEntriesForOrderChange("collect", { _id: "o1", customerId: "c1", dueAmount: 20_000 }, 50_000), [{
    type: "payment", customerId: "c1", orderId: "o1", amount: 50_000, idempotencyKey: "retail-order:o1:debt-payment:50000:20000",
  }]);
  assert.deepEqual(receivableEntriesForOrderChange("cancel", { _id: "o1", customerId: "c1", dueAmount: 20_000 }, 0), [{
    type: "reversal", customerId: "c1", orderId: "o1", amount: 20_000, reason: "Hủy số dư công nợ của đơn", idempotencyKey: "retail-order:o1:debt-cancel",
  }]);
  assert.deepEqual(receivableEntriesForOrderChange("confirm", { _id: "o2", dueAmount: 0 }, 0), []);
});

test("new Retail order flow publishes Finance events instead of dual-writing the legacy ledger", () => {
  const source = readFileSync(new URL("./retail-order.service.ts", import.meta.url), "utf8");
  assert.equal(source.includes("postReceivableEntry"), false);
  assert.match(source, /publishRetailOrderEvent\("confirmed"/);
  assert.match(source, /publishRetailOrderEvent\("paid"/);
  assert.match(source, /publishRetailOrderEvent\("cancelled"/);
});

test("order item snapshots keep brand and normalized category", () => {
  const snapshot = (orderService as any).snapshotRetailProductForPricing;
  assert.equal(typeof snapshot, "function");
  assert.deepEqual(snapshot({ _id: "p1", sku: " S-1 ", name: " Tea ", unit: " bottle ", category: "  Drinks  ", brand: " North " }, { productId: "p1", quantity: 2 }), {
    productId: "p1", sku: "S-1", productName: "Tea", unit: "bottle", category: "Drinks", brand: "North", quantity: 2, unitPrice: 0, unitCost: 0, discount: undefined, note: undefined,
  });
});

test("tier refresh inputs are deterministic for sale and cancellation", () => {
  const refresh = (orderService as any).tierRefreshForOrderChange;
  assert.deepEqual(refresh("confirm", { _id: "o1", customerId: "c1" }), { customerId: "c1", sourceKey: "retail-order:o1:tier-confirm" });
  assert.deepEqual(refresh("cancel", { _id: "o1", customerId: "c1" }), { customerId: "c1", sourceKey: "retail-order:o1:tier-cancel" });
  assert.equal(refresh("confirm", { _id: "o2" }), null);
});

test("tier refresh is processed asynchronously after an order commit", async () => {
  const calls: any[] = [];
  const scheduled = (orderService as any).scheduleOrderTierRefreshAfterCommit(
    { companyCode: "ACME", branchId: "B1" }, "confirm", { _id: "o1", customerId: "c1" },
    async (...args: any[]) => { calls.push(args); },
  );
  assert.equal(scheduled, true);
  assert.deepEqual(calls, []);
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.deepEqual(calls, [["ACME", "retail-order:o1:tier-confirm"]]);
});
test("split payments apply only real collected amounts", () => {
  const result = normalizePayments([
    { method: "cash", amount: 300_000, tenderedAmount: 350_000 },
    { method: "transfer", amount: 200_000, reference: "TX1" },
  ], 500_000);
  assert.equal(result.total, 500_000);
  assert.equal(result.payments[0].changeAmount, 50_000);
  assert.equal(result.payments[1].changeAmount, undefined);
});

test("debt and applied overpayment are rejected", () => {
  assert.throws(() => normalizePayments([{ method: "debt", amount: 1 }], 100));
  assert.throws(() => normalizePayments([{ method: "cash", amount: 101, tenderedAmount: 101 }], 100), /vượt/i);
});

test("cash tender cannot be lower than applied amount and non-cash cannot tender", () => {
  assert.throws(() => normalizePayments([{ method: "cash", amount: 100, tenderedAmount: 99 }], 100));
  assert.throws(() => normalizePayments([{ method: "card", amount: 100, tenderedAmount: 100 }], 100));
});

test("payment status derives only from net collected and total", () => {
  assert.equal(paymentStatusFor(0, 100, 0), "unpaid");
  assert.equal(paymentStatusFor(50, 100, 0), "partial");
  assert.equal(paymentStatusFor(100, 100, 0), "paid");
  assert.equal(paymentStatusFor(100, 100, 100), "refunded");
});

test("operators never receive unit cost while managers do", () => {
  const order = { items: [{ sku: "A", unitCost: 60_000, unitPrice: 100_000 }], totalCost: 60_000 } as any;
  assert.deepEqual(serializeRetailOrder(order, false), { items: [{ sku: "A", unitPrice: 100_000 }] });
  assert.equal((serializeRetailOrder(order, true) as any).items[0].unitCost, 60_000);
});

test("document codes use branch code rather than Mongo branch id", () => {
  assert.equal(formatRetailDocumentCode("dh", "cn01", "202608", 12), "DH-CN01-202608-000012");
});

test("cashier can hold at most five active drafts", () => {
  assert.doesNotThrow(() => assertHeldDraftCapacity(4));
  assert.throws(() => assertHeldDraftCapacity(5), (error: any) => error.code === "HELD_DRAFT_LIMIT");
});

test("only creator or manager can edit a held draft", () => {
  assert.doesNotThrow(() => assertHeldDraftAccess("cashier-1", "cashier-1", false));
  assert.doesNotThrow(() => assertHeldDraftAccess("cashier-1", "cashier-2", true));
  assert.throws(
    () => assertHeldDraftAccess("cashier-1", "cashier-2", false),
    (error: any) => error.code === "HELD_DRAFT_FORBIDDEN",
  );
});

test("held draft expires after its business date", () => {
  assert.equal(isHeldDraftExpired("2026-08-10", "2026-08-10"), false);
  assert.equal(isHeldDraftExpired("2026-08-09", "2026-08-10"), true);
});

test("selected customer lookup is always company-wide, including fully paid orders", () => {
  const customerLookupFilter = (orderService as any).customerLookupFilter;
  assert.equal(typeof customerLookupFilter, "function");
  assert.deepEqual(customerLookupFilter({ companyCode: "ACME", branchId: "branch-1" }, "customer-1"), {
    _id: "customer-1",
    companyCode: "ACME",
  });
});
