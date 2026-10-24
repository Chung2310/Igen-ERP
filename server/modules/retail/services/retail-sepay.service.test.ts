import assert from "node:assert/strict";
import test from "node:test";
import { canonicalPaymentCode, extractPaymentCode, parseSePayTransactionDate, retailQrAmount, sePayTransactionKey } from "./retail-sepay.service";

test("installment QR requests only the pending upfront transfer", () => {
  assert.equal(retailQrAmount({ dueAmount: 900_000, pendingTransferAmount: 100_000 }), 100_000);
  assert.equal(retailQrAmount({ dueAmount: 800_000, pendingTransferAmount: 0 }), 800_000);
});

test("canonicalizes retail order codes for bank transfer content", () => {
  assert.equal(canonicalPaymentCode("dh-hcm-202608-000001"), "DHHCM202608000001");
});

test("prefers SePay parsed payment code and falls back to transfer content", () => {
  assert.equal(extractPaymentCode({ code: "DH-HCM-202608-000001" }), "DHHCM202608000001");
  assert.equal(extractPaymentCode({ content: "Thanh toan DHHCM202608000001" }), "DHHCM202608000001");
});

test("requires a stable SePay transaction identifier", () => {
  assert.equal(sePayTransactionKey({ id: 92704, referenceCode: "FT1" }), "id:92704");
  assert.equal(sePayTransactionKey({ referenceCode: "FT1" }), "ref:FT1");
  assert.throws(() => sePayTransactionKey({}), /thiếu id\/referenceCode/);
});

test("parses SePay Vietnam local timestamps without corrupting ISO timestamps", () => {
  assert.equal(parseSePayTransactionDate("2026-08-22 12:00:00").toISOString(), "2026-08-22T05:00:00.000Z");
  assert.equal(parseSePayTransactionDate("2026-08-22T05:00:00Z").toISOString(), "2026-08-22T05:00:00.000Z");
});
