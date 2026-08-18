import assert from "node:assert/strict";
import test from "node:test";
import { validateRetailSerialItems } from "./retail-order.service";

test("serial products require exactly one serial per quantity", () => {
  assert.doesNotThrow(() => validateRetailSerialItems([{ quantity: 2, trackingMode: "serial", serialNumbers: ["A", "B"] }]));
  assert.throws(() => validateRetailSerialItems([{ quantity: 2, trackingMode: "serial", serialNumbers: ["A"] }]), /đủ mã/);
});

test("non-serial products reject serial payloads and duplicates", () => {
  assert.throws(() => validateRetailSerialItems([{ quantity: 1, trackingMode: "none", serialNumbers: ["A"] }]), /không hỗ trợ/);
  assert.throws(() => validateRetailSerialItems([{ quantity: 2, trackingMode: "serial", serialNumbers: ["a", "A"] }]), /không được trùng/);
});

test("unit barcode products require one unique barcode per quantity", () => {
  assert.doesNotThrow(() => validateRetailSerialItems([{ quantity: 2, trackingMode: "unit_barcode", internalBarcodes: ["IG-1", "IG-2"] }]));
  assert.throws(() => validateRetailSerialItems([{ quantity: 2, trackingMode: "unit_barcode", internalBarcodes: ["IG-1"] }]), /số lượng/);
  assert.throws(() => validateRetailSerialItems([{ quantity: 2, trackingMode: "unit_barcode", internalBarcodes: ["IG-1", "ig-1"] }]), /trùng/);
});
