import type { RetailBranchScope } from "../contracts";
import type { IRetailSettings, RetailSettingsValues } from "../interfaces/retail-settings.interface";
import { RetailSettingsModel } from "../models/retail-settings.model";

export const DEFAULT_RETAIL_SETTINGS: RetailSettingsValues = Object.freeze({
  allowNegativeStock: false,
  maxDiscountPercent: 0,
  defaultTaxRate: 0,
  varianceReasonThreshold: 0,
  orderPrefix: "DH",
  invoicePrefix: "HD",
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
