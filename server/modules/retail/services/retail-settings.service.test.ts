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
    invoicePaperSize: "80mm",
    invoiceTemplate: "standard",
  }), {
    allowNegativeStock: true,
    maxDiscountPercent: 100,
    defaultTaxRate: 8.5,
    varianceReasonThreshold: 0,
    orderPrefix: "DH",
    invoicePrefix: "HD",
    invoicePaperSize: "80mm",
    invoiceTemplate: "standard",
  });
});

test("invoice print settings default to A4 and the standard template", () => {
  assert.equal(DEFAULT_RETAIL_SETTINGS.invoicePaperSize, "A4");
  assert.equal(DEFAULT_RETAIL_SETTINGS.invoiceTemplate, "standard");
});

test("settings validation rejects unsafe values", () => {
  for (const input of [
    { maxDiscountPercent: 100.01 },
    { defaultTaxRate: 8.555 },
    { varianceReasonThreshold: -1 },
    { varianceReasonThreshold: 1.2 },
    { orderPrefix: "D H" },
    { invoicePrefix: "TOO-LONG-PREFIX" },
    { invoicePaperSize: "letter" },
    { invoiceTemplate: "compact" },
  ]) {
    assert.throws(() => validateRetailSettingsInput(input as any));
  }
});

test("tier settings normalize order and reject duplicate or non-zero starting tiers", () => {
  assert.deepEqual(validateRetailSettingsInput({ customerTiers: [
    { code: "VIP", name: "VIP", minSpend: 50_000_000 },
    { code: "member", name: "Thành viên", minSpend: 0 },
  ] }).customerTiers?.map((tier) => tier.code), ["member", "vip"]);
  assert.throws(() => validateRetailSettingsInput({ customerTiers: [{ code: "vip", name: "VIP", minSpend: 1 }] }));
  assert.throws(() => validateRetailSettingsInput({ customerTiers: [{ code: "vip", name: "VIP", minSpend: 0 }, { code: "VIP", name: "Khác", minSpend: 1 }] }));
});

test("tier evaluation settings accept lifetime, rolling 12 months and valid custom ranges", () => {
  assert.deepEqual(validateRetailSettingsInput({ tierEvaluationWindow: { type: "lifetime" } } as any).tierEvaluationWindow, { type: "lifetime" });
  assert.deepEqual(validateRetailSettingsInput({ tierEvaluationWindow: { type: "rolling12Months" } } as any).tierEvaluationWindow, { type: "rolling12Months" });
  assert.deepEqual(validateRetailSettingsInput({ tierEvaluationWindow: { type: "custom", from: "2026-01-01", to: "2026-12-31" } } as any).tierEvaluationWindow, { type: "custom", from: "2026-01-01", to: "2026-12-31" });
  assert.throws(() => validateRetailSettingsInput({ tierEvaluationWindow: { type: "custom", from: "2026-12-31", to: "2026-01-01" } } as any));
});

test("debt reminder settings normalize recipients and reject unsafe schedules", () => {
  assert.deepEqual(validateRetailSettingsInput({ debtReminders: {
    enabled: true, frequencyHours: 6, overdueDays: 2,
    recipientUserIds: [" u2 ", "u1", "u1"], recipientRoles: ["manager", "admin", "manager"],
    emailEnabled: true, maxAttempts: 4,
  } } as any).debtReminders, {
    enabled: true, frequencyHours: 6, overdueDays: 2,
    recipientUserIds: ["u1", "u2"], recipientRoles: ["admin", "manager"],
    emailEnabled: true, maxAttempts: 4,
  });
  for (const frequencyHours of [0, 25, 1.5]) assert.throws(() => validateRetailSettingsInput({ debtReminders: { enabled: true, frequencyHours, overdueDays: 0, recipientUserIds: [], recipientRoles: [], emailEnabled: false, maxAttempts: 3 } } as any));
});
