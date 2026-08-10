import assert from "node:assert/strict";
import test from "node:test";
import { formatRetailDocumentCode, normalizePayments, paymentStatusFor, serializeRetailOrder } from "./retail-order.service";

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
