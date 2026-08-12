import assert from "node:assert/strict";
import test from "node:test";
import {
  assertReceivableOperation,
  deriveReceivableStatus,
  signedReceivableAmount,
} from "./receivable-rules";

test("ledger entry types produce the documented signed VND amount", () => {
  assert.equal(signedReceivableAmount("charge", 100_000), 100_000);
  assert.equal(signedReceivableAmount("adjustment", 20_000), 20_000);
  assert.equal(signedReceivableAmount("adjustment", 20_000, { direction: "decrease" }), -20_000);
  assert.equal(signedReceivableAmount("payment", 40_000), -40_000);
  assert.equal(signedReceivableAmount("refund", 10_000), -10_000);
  assert.equal(signedReceivableAmount("write_off", 50_000), -50_000);
  assert.equal(signedReceivableAmount("reversal", 100_000, { originalSignedAmount: 70_000 }), -70_000);
  assert.equal(signedReceivableAmount("reversal", 100_000, { originalSignedAmount: -70_000 }), 70_000);
});

test("VND amounts and reversal context are strictly validated", () => {
  for (const amount of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(() => signedReceivableAmount("charge", amount));
  }
  assert.throws(() => signedReceivableAmount("reversal", 1));
  assert.throws(() => signedReceivableAmount("reversal", 1, { originalSignedAmount: 1.5 }));
});

test("operation guard rejects overpayment and requires audit reasons", () => {
  assert.equal(assertReceivableOperation({ type: "payment", balance: 80_000, amount: 80_000 }), -80_000);
  assert.throws(
    () => assertReceivableOperation({ type: "payment", balance: 80_000, amount: 80_001 }),
    /PAYMENT_EXCEEDS_BALANCE/,
  );
  for (const type of ["adjustment", "write_off", "reversal"] as const) {
    assert.throws(() => assertReceivableOperation({ type, balance: 80_000, amount: 1 }), /REASON_REQUIRED/);
  }
});

test("status is derived from balance, payment progress, and terminal operation", () => {
  assert.equal(deriveReceivableStatus({ originalAmount: 100, paidAmount: 0, balance: 100 }), "open");
  assert.equal(deriveReceivableStatus({ originalAmount: 100, paidAmount: 30, balance: 70 }), "partially_paid");
  assert.equal(deriveReceivableStatus({ originalAmount: 100, paidAmount: 100, balance: 0 }), "settled");
  assert.equal(deriveReceivableStatus({ originalAmount: 100, paidAmount: 0, balance: 0, terminal: "void" }), "void");
  assert.equal(deriveReceivableStatus({ originalAmount: 100, paidAmount: 0, balance: 0, terminal: "written_off" }), "written_off");
  assert.throws(() => deriveReceivableStatus({ originalAmount: 100, paidAmount: 0, balance: -1 }));
});
