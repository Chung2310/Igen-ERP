import { ValidationError } from "../../../errors/app-error";
import { FIXED_ASSET_STATUSES } from "../interfaces/asset.interface";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const PERIOD = /^\d{4}-(?:0[1-9]|1[0-2])$/;

function text(value: unknown, code: string) {
  const result = String(value ?? "").trim();
  if (!result) throw new ValidationError("VALIDATION_FAILED", code);
  return result;
}

function optionalText(value: unknown) {
  const result = String(value ?? "").trim();
  return result || undefined;
}

function vnd(value: unknown, code: string, { allowZero = true } = {}) {
  const amount = Number(value);
  if (!Number.isSafeInteger(amount) || amount < 0 || (!allowZero && amount === 0)) throw new ValidationError("VALIDATION_FAILED", code);
  return amount;
}

function isoDate(value: unknown, code: string) {
  const raw = String(value ?? "");
  if (!ISO_DATE.test(raw)) throw new ValidationError("VALIDATION_FAILED", code);
  const date = new Date(raw);
  const normalized = raw.includes(".") ? raw : raw.replace("Z", ".000Z");
  if (Number.isNaN(date.valueOf()) || date.toISOString() !== normalized) throw new ValidationError("VALIDATION_FAILED", code);
  return date;
}

export function validatePeriod(value: unknown) {
  const period = String(value ?? "").trim();
  if (!PERIOD.test(period)) throw new ValidationError("VALIDATION_FAILED", "INVALID_PERIOD");
  return period;
}

export function validateAssetCreation(input: any) {
  const originalCost = vnd(input?.originalCost, "INVALID_VND_AMOUNT", { allowZero: false });
  const salvageValue = vnd(input?.salvageValue ?? 0, "INVALID_VND_AMOUNT");
  if (salvageValue > originalCost) throw new ValidationError("VALIDATION_FAILED", "SALVAGE_EXCEEDS_COST");
  const usefulLifeMonths = Number(input?.usefulLifeMonths);
  if (!Number.isSafeInteger(usefulLifeMonths) || usefulLifeMonths < 1) throw new ValidationError("VALIDATION_FAILED", "INVALID_USEFUL_LIFE");
  return {
    assetCode: text(input?.assetCode, "ASSET_CODE_REQUIRED"),
    barcode: text(input?.barcode, "BARCODE_REQUIRED"),
    name: text(input?.name, "ASSET_NAME_REQUIRED"),
    group: text(input?.group, "ASSET_GROUP_REQUIRED"),
    originalCost,
    salvageValue,
    ...(input?.purchaseDate ? { purchaseDate: isoDate(input.purchaseDate, "INVALID_DATE") } : {}),
    inServiceDate: isoDate(input?.inServiceDate, "INVALID_DATE"),
    usefulLifeMonths,
    ...(optionalText(input?.location) ? { location: optionalText(input?.location)! } : {}),
    ...(optionalText(input?.custodianId) ? { custodianId: optionalText(input?.custodianId)! } : {}),
    ...(optionalText(input?.custodianName) ? { custodianName: optionalText(input?.custodianName)! } : {}),
  };
}

export function validateAssetUpdate(input: any) {
  const patch: Record<string, unknown> = {};
  for (const field of ["name", "group", "location", "custodianId", "custodianName"] as const) {
    if (input?.[field] !== undefined) patch[field] = optionalText(input[field]) ?? "";
  }
  if (input?.status !== undefined) {
    const status = String(input.status);
    if (status === "disposed" || !(FIXED_ASSET_STATUSES as readonly string[]).includes(status)) throw new ValidationError("VALIDATION_FAILED", "INVALID_ASSET_STATUS");
    patch.status = status;
  }
  if (!Object.keys(patch).length) throw new ValidationError("VALIDATION_FAILED", "EMPTY_UPDATE");
  return { patch, note: optionalText(input?.note) };
}

export function validateAssetTransfer(input: any) {
  return {
    branchId: text(input?.branchId, "BRANCH_REQUIRED"),
    ...(optionalText(input?.location) ? { location: optionalText(input?.location)! } : {}),
    ...(optionalText(input?.custodianId) ? { custodianId: optionalText(input?.custodianId)! } : {}),
    ...(optionalText(input?.custodianName) ? { custodianName: optionalText(input?.custodianName)! } : {}),
    reason: text(input?.reason, "REASON_REQUIRED"),
  };
}

export function validateAssetDisposal(input: any) {
  return {
    disposedAt: isoDate(input?.disposedAt, "INVALID_DATE"),
    disposalAmount: vnd(input?.disposalAmount ?? 0, "INVALID_VND_AMOUNT"),
    reason: text(input?.reason, "REASON_REQUIRED"),
  };
}
