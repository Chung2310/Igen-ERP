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

test("unit barcode tracking requires one unique barcode per received unit", () => {
  assert.doesNotThrow(() => validateReceivingSerialLines([{ sku: "RAM-1", quantity: 2, trackingMode: "unit_barcode", unitDetails: [{ internalBarcode: "IG-1" }, { internalBarcode: "IG-2" }] }]));
  assert.throws(() => validateReceivingSerialLines([{ sku: "RAM-1", quantity: 2, trackingMode: "unit_barcode", unitDetails: [{ internalBarcode: "IG-1" }] }]), /bằng số lượng/);
  assert.throws(() => validateReceivingSerialLines([{ sku: "RAM-1", quantity: 2, trackingMode: "unit_barcode", unitDetails: [{ internalBarcode: "IG-1" }, { internalBarcode: "ig-1" }] }]), /trùng/);
});
