import type { Response } from "express";
import type { AuthenticatedRequest } from "../../../middleware/auth";
import { getEffectivePermissions } from "../../../middleware/auth";
import { evaluateWorkingDate } from "../../../service/company-work-calendar.service";
import { PayrollRunModel } from "../models/payroll-run.model";
import { PayrollAuditModel } from "../models/payroll-audit.model";
import { PayrollOperationError } from "../services/payroll-run-operations.service";

export const tenant = (req: AuthenticatedRequest) => req.user?.companyCode || "";

export const PAYROLL_TIME_ZONE = "Asia/Ho_Chi_Minh";
export const timeToMinutes = (value: string) => { const [h, m] = value.split(":").map(Number); return h * 60 + m; };
export const formatInPayrollTimeZone = (value: Date | string, kind: "date" | "time") => {
  const options: Intl.DateTimeFormatOptions = kind === "date"
    ? { timeZone: PAYROLL_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }
    : { timeZone: PAYROLL_TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" };
  const parts = new Intl.DateTimeFormat("en-CA", options).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value || "";
  return kind === "date" ? `${part("year")}-${part("month")}-${part("day")}` : `${part("hour")}:${part("minute")}`;
};
export const normalizePayrollLogDate = (value: unknown): string | null => {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  if (!(value instanceof Date) && typeof value !== "string") return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return formatInPayrollTimeZone(parsed, "date");
};
export const computeStandardDailyMinutes = (checkInLimit?: string, checkOutLimit?: string, lunchBreakStart?: string, lunchBreakEnd?: string) => {
  if (!checkInLimit || !checkOutLimit) return 480;
  const gross = timeToMinutes(checkOutLimit) - timeToMinutes(checkInLimit);
  const lunch = lunchBreakStart && lunchBreakEnd ? Math.max(0, timeToMinutes(lunchBreakEnd) - timeToMinutes(lunchBreakStart)) : 0;
  const net = gross - lunch;
  return net > 0 ? net : 480;
};
export const countStandardDays = (period: string, workingDays: number[], calendarRules: Map<string, any[]>) => {
  const [year, month] = period.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  let count = 0;
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = `${period}-${String(day).padStart(2, "0")}`;
    if (evaluateWorkingDate(date, calendarRules.get(date) || [], workingDays)) count += 1;
  }
  return count;
};
export const canManagePayroll = async (req: AuthenticatedRequest) => {
  const { id: userId, role, companyCode } = req.user!;
  const permissions = await getEffectivePermissions(userId, role, companyCode);
  return permissions.has("*") || permissions.has("payroll-period:manage");
};
export const legacyPeriodScope = (req: AuthenticatedRequest) => ({
  companyCode: tenant(req),
  branchId: req.user?.branchId || "",
  periodKey: req.params.periodKey,
});
export const legacyRegularRunFilter = (req: AuthenticatedRequest) => ({
  ...legacyPeriodScope(req),
  type: "regular" as const,
});
export const LEGACY_RUN_ORDER = { createdAt: 1 as const, _id: 1 as const };

export const runPayrollControllerStep = async (
  handler: (req: AuthenticatedRequest, res: Response) => Promise<unknown>,
  req: AuthenticatedRequest,
) => {
  let statusCode = 200;
  let body: any;
  const stepResponse = {
    status(code: number) { statusCode = code; return this; },
    json(payload: unknown) { body = payload; return this; },
  } as unknown as Response;
  await handler(req, stepResponse);
  if (statusCode >= 400) {
    throw Object.assign(new Error(body?.message || "Payroll processing step failed"), { status: statusCode });
  }
  return body?.data ?? body;
};
// Revision-backed runs must go through the operational workflow so approval and
// close stay behind the checksum, separation-of-duties, and audit guarantees.
export const LEGACY_RUN_ONLY = { activeRevisionId: { $exists: false } };
export const hasRevisionBackedRun = async (req: AuthenticatedRequest) => Boolean(
  await PayrollRunModel.exists({ ...legacyRegularRunFilter(req), activeRevisionId: { $exists: true } }),
);
export const revisionBackedRunFailure = (res: Response) => res.status(409).json({
  status: "error",
  code: "PAYROLL_OPERATIONAL_RUN",
  message: "This payroll run is revision-backed; use the run workflow endpoints",
});
export const audit = (req: AuthenticatedRequest, periodKey: string, action: any, metadata?: Record<string, unknown>) => PayrollAuditModel.create({ companyCode: tenant(req), branchId: req.user?.branchId || "", periodKey, action, actorId: req.user!.id, metadata });
export const snapshotPayrollPayment = (profile: any) => profile ? ({
  method: profile.paymentMethod ?? "transfer",
  ...(profile.bankName ? { bankName: profile.bankName } : {}),
  ...(profile.bankCode ? { bankCode: profile.bankCode } : {}),
  ...(profile.bankAccountNumber ? { bankAccountNumber: profile.bankAccountNumber } : {}),
  ...(profile.bankAccountHolder ? { bankAccountHolder: profile.bankAccountHolder } : {}),
}) : undefined;
export const operationalScope = (req: AuthenticatedRequest) => {
  const companyCode = tenant(req);
  const branchId = req.user?.branchId || "";
  return companyCode && branchId ? { companyCode, branchId } : null;
};
export const runWithEffectiveChecksum = (run: any, checksum: string) => ({
  ...run,
  activeRevisionChecksum: checksum,
});
export const publicationMatchesEffectivePayroll = (
  publicationChecksum: string,
  run: any,
  effective: any,
) => publicationChecksum === effective.effectiveChecksum
  || (
    effective.legacyUnpinned === true
    && (
      publicationChecksum === effective.sourceRevisionChecksum
      || (!run.activeRevisionId && publicationChecksum === "legacy")
    )
  );
export const validationFailure = (res: Response, message: string) => res.status(400).json({
  status: "error", code: "PAYROLL_VALIDATION_ERROR", message,
});
export const operationFailure = (res: Response, error: unknown) => {
  const payrollError = error instanceof PayrollOperationError
    || (
      error instanceof Error
      && typeof (error as any).code === "string"
      && (error as any).code.startsWith("PAYROLL_")
      && Number.isInteger((error as any).status)
    );
  if (payrollError) {
    const typed = error as PayrollOperationError;
    return res.status(typed.status).json({
      status: "error",
      code: typed.code,
      message: typed.message,
      ...(typed.currentVersion !== undefined ? { currentVersion: typed.currentVersion } : {}),
    });
  }
  console.error("[payroll.operations] Unexpected error:", error);
  return res.status(500).json({ status: "error", code: "PAYROLL_OPERATION_FAILED", message: "Payroll operation failed" });
};
