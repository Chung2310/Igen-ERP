import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_RETAIL_SETTINGS,
  resolveRetailSettings,
  validateRetailSettingsInput,
} from "./retail-settings.service";

test("missing branch settings resolve to safe defaults", () => {
  assert.deepEqual(resolveRetailSettings({ companyCode: "ACME", branchId: "B1" }, null), {
    companyCode: "ACME",
    branchId: "B1",
    ...DEFAULT_RETAIL_SETTINGS,
  });
});

test("stored settings override defaults without dropping missing values", () => {
  assert.deepEqual(
    resolveRetailSettings(
      { companyCode: "ACME", branchId: "B1" },
      { allowNegativeStock: true, maxDiscountPercent: 12.5, orderPrefix: "BL" },
    ),
    {
      companyCode: "ACME",
      branchId: "B1",
      ...DEFAULT_RETAIL_SETTINGS,
      allowNegativeStock: true,
      maxDiscountPercent: 12.5,
      orderPrefix: "BL",
    },
  );
});

test("settings validation accepts approved boundaries and normalizes prefixes", () => {
  assert.deepEqual(validateRetailSettingsInput({
    allowNegativeStock: true,
    maxDiscountPercent: 100,
    defaultTaxRate: 8.5,
    varianceReasonThreshold: 0,
    orderPrefix: " dh ",
    invoicePrefix: "hd",
  }), {
    allowNegativeStock: true,
    maxDiscountPercent: 100,
    defaultTaxRate: 8.5,
    varianceReasonThreshold: 0,
    orderPrefix: "DH",
    invoicePrefix: "HD",
  });
});

test("settings validation rejects unsafe values", () => {
  for (const input of [
    { maxDiscountPercent: 100.01 },
    { defaultTaxRate: 8.555 },
    { varianceReasonThreshold: -1 },
    { varianceReasonThreshold: 1.2 },
    { orderPrefix: "D H" },
    { invoicePrefix: "TOO-LONG-PREFIX" },
  ]) {
    assert.throws(() => validateRetailSettingsInput(input));
  }
});
