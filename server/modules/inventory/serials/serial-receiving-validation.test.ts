import assert from "node:assert/strict";
import test from "node:test";
import { validateReceivingSerialLines } from "./serial-receiving-validation";

test("receiving serial line requires one code per unit", () => {
  assert.doesNotThrow(() => validateReceivingSerialLines([{ sku: "PHONE-1", quantity: 2, trackingMode: "serial", serialNumbers: ["A", "B"] }]));
  assert.throws(() => validateReceivingSerialLines([{ sku: "PHONE-1", quantity: 2, trackingMode: "serial", serialNumbers: ["A"] }]), /bằng số lượng/);
});

test("receiving non-serial line rejects serial payload", () => {
  assert.throws(() => validateReceivingSerialLines([{ sku: "CABLE-1", quantity: 1, trackingMode: "quantity", serialNumbers: ["A"] }]), /không theo dõi/);
});
