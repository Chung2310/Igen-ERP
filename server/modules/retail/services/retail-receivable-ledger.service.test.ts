import assert from "node:assert/strict";
import test from "node:test";
import * as ledger from "./retail-receivable-ledger.service";

test("receivable entry types have deterministic signed amounts", () => {
  const signed = (ledger as any).signedReceivableAmount;
  assert.equal(typeof signed, "function");
  assert.equal(signed("charge", 100_000), 100_000);
  assert.equal(signed("adjustment", 25_000), 25_000);
  assert.equal(signed("payment", 40_000), -40_000);
  assert.equal(signed("reversal", 15_000), -15_000);
});

test("receivable entries require positive integer VND and adjustment reason", () => {
  const normalize = (ledger as any).normalizeReceivableEntryInput;
  assert.equal(typeof normalize, "function");
  for (const amount of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => normalize({ type: "charge", customerId: "c1", amount, idempotencyKey: "key" }));
  }
  assert.throws(() => normalize({ type: "adjustment", customerId: "c1", amount: 1, idempotencyKey: "key" }), /lý do/i);
  assert.deepEqual(normalize({ type: "adjustment", customerId: " c1 ", amount: 1, reason: " Sửa lệch ", idempotencyKey: " key " }), {
    type: "adjustment", customerId: "c1", amount: 1, signedAmount: 1, reason: "Sửa lệch", idempotencyKey: "key",
  });
});

test("receivable model enforces company idempotency and one reversal per entry", async () => {
  const modelModule = await import("../models/retail-receivable-entry.model");
  const model = (modelModule as any).RetailReceivableEntryModel;
  assert.ok(model.schema.indexes().some(([keys, options]: any[]) => keys.companyCode === 1 && keys.idempotencyKey === 1 && options.unique === true));
  assert.ok(model.schema.indexes().some(([keys, options]: any[]) => keys.companyCode === 1 && keys.reversesEntryId === 1 && options.unique === true));
  assert.equal((ledger as any).updateReceivableEntry, undefined);
  assert.equal((ledger as any).deleteReceivableEntry, undefined);
});
