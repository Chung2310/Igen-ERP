import type { RetailBranchScope } from "../contracts";
import type { IRetailSettings, RetailSettingsValues } from "../interfaces/retail-settings.interface";
import { RetailSettingsModel } from "../models/retail-settings.model";

export const DEFAULT_RETAIL_SETTINGS: RetailSettingsValues = Object.freeze({
  customerTiers: [
    { code: "standard", name: "Thành viên", minSpend: 0 },
    { code: "silver", name: "Bạc", minSpend: 5_000_000 },
    { code: "gold", name: "Vàng", minSpend: 20_000_000 },
    { code: "vip", name: "VIP", minSpend: 50_000_000 },
  ],
  tierEvaluationWindow: { type: "lifetime" as const },
  allowNegativeStock: false,
  maxDiscountPercent: 0,
  defaultTaxRate: 0,
  varianceReasonThreshold: 0,
  orderPrefix: "DH",
  invoicePrefix: "HD",
  invoicePaperSize: "A4",
  invoiceTemplate: "standard",
  debtReminders: { enabled: false, frequencyHours: 24, overdueDays: 0, recipientUserIds: [], recipientRoles: ["admin", "manager"], emailEnabled: false, maxAttempts: 3 },
});

const percent = (value: unknown, field: string): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100 || Math.round(parsed * 100) !== parsed * 100) {
    throw new Error(`${field} must be between 0 and 100 with at most two decimals`);
  }
  return parsed;
};

const prefix = (value: unknown, field: string): string => {
  const parsed = String(value || "").trim().toUpperCase();
  if (!/^[A-Z0-9]{1,8}$/.test(parsed)) throw new Error(`${field} is invalid`);
  return parsed;
};

export function validateRetailSettingsInput(input: Partial<RetailSettingsValues>): Partial<RetailSettingsValues> {
  const output: Partial<RetailSettingsValues> = {};
  if (input.debtReminders !== undefined) {
    const value = input.debtReminders;
    const frequencyHours = Number(value.frequencyHours), overdueDays = Number(value.overdueDays), maxAttempts = Number(value.maxAttempts);
    if (typeof value.enabled !== "boolean" || typeof value.emailEnabled !== "boolean" || !Number.isSafeInteger(frequencyHours) || frequencyHours < 1 || frequencyHours > 24 || !Number.isSafeInteger(overdueDays) || overdueDays < 0 || overdueDays > 365 || !Number.isSafeInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 10 || !Array.isArray(value.recipientUserIds) || !Array.isArray(value.recipientRoles)) throw new Error("debtReminders is invalid");
    const recipientUserIds = [...new Set(value.recipientUserIds.map((item) => String(item).trim()).filter(Boolean))].sort();
    const recipientRoles = [...new Set(value.recipientRoles.map((item) => String(item).trim().toLowerCase()).filter(Boolean))].sort();
    if (recipientUserIds.length > 100 || recipientRoles.length > 20 || recipientRoles.some((role) => !/^[a-z0-9:_-]{1,50}$/.test(role))) throw new Error("debtReminders recipients are invalid");
    output.debtReminders = { enabled: value.enabled, frequencyHours, overdueDays, recipientUserIds, recipientRoles, emailEnabled: value.emailEnabled, maxAttempts };
  }
  if (input.tierEvaluationWindow !== undefined) {
    const window = input.tierEvaluationWindow;
    if (window.type === "lifetime" || window.type === "rolling12Months") output.tierEvaluationWindow = { type: window.type };
    else if (window.type === "custom" && /^\d{4}-\d{2}-\d{2}$/.test(window.from) && /^\d{4}-\d{2}-\d{2}$/.test(window.to) && window.from <= window.to) output.tierEvaluationWindow = { type: "custom", from: window.from, to: window.to };
    else throw new Error("tierEvaluationWindow is invalid");
  }
  if (input.customerTiers !== undefined) {
    if (!Array.isArray(input.customerTiers) || input.customerTiers.length < 1 || input.customerTiers.length > 10) throw new Error("customerTiers must contain 1 to 10 tiers");
    const seen = new Set<string>();
    output.customerTiers = input.customerTiers.map((tier) => {
      const code = String(tier.code || "").trim().toLowerCase();
      const name = String(tier.name || "").trim();
      const minSpend = Number(tier.minSpend);
      if (!/^[a-z0-9-]{1,30}$/.test(code) || seen.has(code) || !name || name.length > 50 || !Number.isSafeInteger(minSpend) || minSpend < 0) throw new Error("customerTiers is invalid");
      seen.add(code);
      return { code, name, minSpend };
    }).sort((left, right) => left.minSpend - right.minSpend);
    if (output.customerTiers[0].minSpend !== 0) throw new Error("customerTiers must start at zero");
  }
  if (input.allowNegativeStock !== undefined) {
    if (typeof input.allowNegativeStock !== "boolean") throw new Error("allowNegativeStock must be boolean");
    output.allowNegativeStock = input.allowNegativeStock;
  }
  if (input.maxDiscountPercent !== undefined) output.maxDiscountPercent = percent(input.maxDiscountPercent, "maxDiscountPercent");
  if (input.defaultTaxRate !== undefined) output.defaultTaxRate = percent(input.defaultTaxRate, "defaultTaxRate");
  if (input.varianceReasonThreshold !== undefined) {
    const parsed = Number(input.varianceReasonThreshold);
    if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error("varianceReasonThreshold must be non-negative integer VND");
    output.varianceReasonThreshold = parsed;
  }
  if (input.orderPrefix !== undefined) output.orderPrefix = prefix(input.orderPrefix, "orderPrefix");
  if (input.invoicePrefix !== undefined) output.invoicePrefix = prefix(input.invoicePrefix, "invoicePrefix");
  if (input.invoicePaperSize !== undefined) {
    if (!["A4", "A5", "80mm"].includes(input.invoicePaperSize)) throw new Error("invoicePaperSize is invalid");
    output.invoicePaperSize = input.invoicePaperSize;
  }
  if (input.invoiceTemplate !== undefined) {
    if (input.invoiceTemplate !== "standard") throw new Error("invoiceTemplate is invalid");
    output.invoiceTemplate = input.invoiceTemplate;
  }
  return output;
}

export function resolveRetailSettings(
  scope: RetailBranchScope,
  stored: Partial<RetailSettingsValues> | null | undefined,
): IRetailSettings {
  return { ...scope, ...DEFAULT_RETAIL_SETTINGS, ...(stored || {}) };
}

export async function getResolvedRetailSettings(scope: RetailBranchScope): Promise<IRetailSettings> {
  const stored = await RetailSettingsModel.findOne(scope).lean();
  return resolveRetailSettings(scope, stored || null);
}

export async function updateRetailSettings(
  scope: RetailBranchScope,
  input: Partial<RetailSettingsValues>,
): Promise<IRetailSettings> {
  const values = validateRetailSettingsInput(input);
  const stored = await RetailSettingsModel.findOneAndUpdate(
    scope,
    { $set: values, $setOnInsert: scope },
    { new: true, upsert: true, runValidators: true },
  ).lean();
  return resolveRetailSettings(scope, stored);
}
