import { Types } from "mongoose";
import type { WorkerScope } from "../contracts";

export type LaborPartnerScope = WorkerScope;
export type CommissionScheme = "official_monthly" | "seasonal_hourly";
export type TierMode = "flat" | "progressive";
export type AggregationScope = "partner_period" | "partner_project_period";
export type RoundingMode = "floor" | "nearest" | "ceil";
export type PolicyStatus = "draft" | "active" | "retired";
export type ReferralStatus = "pending" | "active" | "ended" | "rejected";
export type SettlementStatus = "draft" | "calculated" | "approved" | "partially_paid" | "paid" | "void";

export class LaborPartnerError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "LaborPartnerError";
  }
}

export function requiredObjectId(value: unknown, code = "INVALID_ID"): Types.ObjectId {
  const normalized = String(value || "").trim();
  if (!Types.ObjectId.isValid(normalized)) {
    throw new LaborPartnerError(code, "Định dạng ID không hợp lệ.");
  }
  return new Types.ObjectId(normalized);
}

export function normalizeVnd(value: unknown, fieldLabel = "Số tiền", allowZero = true): number {
  const numberValue = Number(value);
  if (!Number.isSafeInteger(numberValue) || numberValue < 0 || (!allowZero && numberValue === 0)) {
    throw new LaborPartnerError("INVALID_MONEY", `${fieldLabel} phải là số tiền VND nguyên hợp lệ.`);
  }
  return numberValue;
}

export function normalizeDate(value: unknown, fieldLabel = "Ngày"): string {
  const date = String(value || "").trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw new LaborPartnerError("INVALID_DATE", `${fieldLabel} phải theo định dạng YYYY-MM-DD.`);
  const parsed = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (parsed.getUTCFullYear() !== Number(match[1]) || parsed.getUTCMonth() !== Number(match[2]) - 1 || parsed.getUTCDate() !== Number(match[3])) {
    throw new LaborPartnerError("INVALID_DATE", `${fieldLabel} không hợp lệ.`);
  }
  return date;
}

export function normalizeText(value: unknown): string {
  return String(value ?? "").trim();
}

export function scopeQuery(scope: LaborPartnerScope) {
  return { companyCode: scope.companyCode, ...(scope.branchId ? { branchId: scope.branchId } : {}) };
}

export function actorSnapshot(actor: Record<string, unknown> | undefined) {
  return {
    id: normalizeText(actor?.id || actor?.uid || actor?._id),
    name: normalizeText(actor?.displayName || actor?.name || actor?.email),
    email: normalizeText(actor?.email),
  };
}
