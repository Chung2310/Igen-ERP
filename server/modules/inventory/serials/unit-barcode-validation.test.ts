import assert from "node:assert/strict";
import test from "node:test";
import { generateInternalBarcode, normalizeInternalBarcode, validateUniqueUnitBarcodes } from "./unit-barcode-validation";

test("normalizes internal barcodes and rejects empty values", () => {
  assert.equal(normalizeInternalBarcode("  ig-ram-001 "), "IG-RAM-001");
  assert.throws(() => normalizeInternalBarcode("   "), /mã vạch/i);
});

test("rejects duplicate unit barcodes in one receipt", () => {
  assert.throws(() => validateUniqueUnitBarcodes(["IG-001", "ig-001"]), /trùng/i);
});

test("generates deterministic internal barcode format", () => {
  assert.equal(generateInternalBarcode("RAM DDR5 16GB", "20260817", 12), "IG-RAM-DDR5-16GB-20260817-000012");
});
