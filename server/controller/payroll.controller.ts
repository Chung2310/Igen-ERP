import type { Response } from "express";
import { AttendancePeriodResultModel } from "../model/attendance-period-result.model";
import { TimekeepingLogModel } from "../model/timekeeping.model";
import { HRLeaveApplicationModel } from "../model/hr-leave-application.model";
import { summarizeAttendanceForPayroll } from "../service/attendance-payroll.service";
import { resolveShift } from "../service/work-shift.service";
import { UserModel } from "../model/user.model";
import { CompanyModel } from "../model/company.model";
import { PayrollRunModel } from "../model/payroll-run.model";
import { PayrollAdjustmentModel } from "../model/payroll-adjustment.model";
import { PayrollAuditModel } from "../model/payroll-audit.model";
import { PayrollPaymentModel } from "../model/payroll-payment.model";
import { PayslipPublicationModel } from "../model/payslip-publication.model";
import { PayrollExportJobModel } from "../model/payroll-export-job.model";
import { CompanyWorkCalendarDayModel } from "../model/company-work-calendar.model";
import { calculatePayroll } from "../service/payroll-calculation.service";
import { calculateVietnamPayroll } from "../service/payroll-vietnam.service";
import { resolvePersistedPayrollPolicy } from "../config/payroll-default-policy";
import { PayrollPolicyModel } from "../model/payroll-policy.model";
import { PayrollFormulaModel } from "../model/payroll-formula.model";
import { evaluatePayrollFormulas } from "../service/payroll-formula-engine.service";
import { PAYROLL_FORMULA_LIBRARY_ENABLED, emptyPayrollFormulaLibraryResult } from "../../src/config/payrollFeatureFlags";
import { PayrollPeriodInputModel } from "../model/payroll-period-input.model";
import { PayrollCustomVariableModel } from "../model/payroll-custom-variable.model";
import { resolvePayrollPeriodInputs } from "../service/payroll-period-input-resolver.service";
import { PayrollDependentModel, PayrollProfileModel } from "../model/payroll-profile.model";
import { countDependents, resolveTaxMethod, selectProfileForPeriod } from "../service/payroll-employee-input.service";
import { evaluateWorkingDate } from "../service/company-work-calendar.service";
import type { AuthenticatedRequest } from "../middleware/auth";
import { getEffectivePermissions } from "../middleware/auth";
import {
  createRun as createOperationalPayrollRun,
  listIssues as listOperationalPayrollIssues,
  lockAttendance as lockOperationalPayrollAttendance,
  PayrollOperationError,
  syncAttendance as syncOperationalPayrollAttendance,
} from "../service/payroll-run-operations.service";
import { calculateOperationalRun, projectPayrollLinesWithStoredOverrides } from "../service/payroll-run-calculate-operations.service";
import { createPayrollPayment, transitionPayrollPayment } from "../service/payroll-payment-operations.service";
import type { PayrollPaymentAction } from "../service/payroll-payment.service";
import {
  activatePayrollPolicy,
  createPayrollPolicy,
  listPayrollPolicies,
  retirePayrollPolicy,
  updatePayrollPolicy,
  clonePayrollPolicy,
  deletePayrollPolicy,
} from "../service/payroll-policy-operations.service";
import { runPayrollWorkflowAction } from "../service/payroll-run-workflow-operations.service";
import { buildPayslip } from "../service/payroll-payslip.service";
import { buildPayrollWorkbook, workbookBuffer } from "../service/payroll-export.service";
import { calculatePayrollChecksum } from "../service/payroll-checksum.service";
import {
  createEffectivePayrollSnapshot,
  loadAuthoritativePayrollLines,
  verifyEffectivePayrollSnapshot,
} from "../service/payroll-effective-line.service";
import { repairReviewEffectivePayrollSnapshot } from "../service/payroll-effective-snapshot-repair.service";
import type { PayrollWorkflowAction } from "../service/payroll-run-workflow.service";
import { PayrollPeriodProcessingError, processPayrollPeriod } from "../service/payroll-period-processing.service";
import { resetPayrollPeriod } from "../service/payroll-period-reset.service";
import { runPayrollAtomicTransaction } from "../service/payroll-transaction.service";
import {
  auditQuerySchema,
  calculateRunSchema,
  createOperationalRunSchema,
  createPaymentSchema,
  createPolicySchema,
  updatePolicySchema,
  activatePolicySchema,
  clonePolicySchema,
  paymentTransitionSchema,
  reopenRunSchema,
  workflowTransitionSchema,
  lockAttendanceSchema,
  syncAttendanceHeadersSchema,
  syncAttendanceSchema,
} from "../validation/payroll-run.validation";

const tenant = (req: AuthenticatedRequest) => req.user?.companyCode || "";
const PAYROLL_TIME_ZONE = "Asia/Ho_Chi_Minh";
const timeToMinutes = (value: string) => { const [h, m] = value.split(":").map(Number); return h * 60 + m; };
const formatInPayrollTimeZone = (value: Date | string, kind: "date" | "time") => {
  const options: Intl.DateTimeFormatOptions = kind === "date"
    ? { timeZone: PAYROLL_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }
    : { timeZone: PAYROLL_TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" };
  const parts = new Intl.DateTimeFormat("en-CA", options).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value || "";
  return kind === "date" ? `${part("year")}-${part("month")}-${part("day")}` : `${part("hour")}:${part("minute")}`;
};
const normalizePayrollLogDate = (value: unknown): string | null => {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  if (!(value instanceof Date) && typeof value !== "string") return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return formatInPayrollTimeZone(parsed, "date");
};
const computeStandardDailyMinutes = (checkInLimit?: string, checkOutLimit?: string, lunchBreakStart?: string, lunchBreakEnd?: string) => {
  if (!checkInLimit || !checkOutLimit) return 480;
  const gross = timeToMinutes(checkOutLimit) - timeToMinutes(checkInLimit);
  const lunch = lunchBreakStart && lunchBreakEnd ? Math.max(0, timeToMinutes(lunchBreakEnd) - timeToMinutes(lunchBreakStart)) : 0;
  const net = gross - lunch;
  return net > 0 ? net : 480;
};
const countStandardDays = (period: string, workingDays: number[], calendarRules: Map<string, any[]>) => {
  const [year, month] = period.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  let count = 0;
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = `${period}-${String(day).padStart(2, "0")}`;
    if (evaluateWorkingDate(date, calendarRules.get(date) || [], workingDays)) count += 1;
  }
  return count;
};
const canManagePayroll = async (req: AuthenticatedRequest) => {
  const { id: userId, role, companyCode } = req.user!;
  const permissions = await getEffectivePermissions(userId, role, companyCode);
  return permissions.has("*") || permissions.has("payroll-period:manage");
};
const legacyPeriodScope = (req: AuthenticatedRequest) => ({
  companyCode: tenant(req),
  branchId: req.user?.branchId || "",
  periodKey: req.params.periodKey,
});
const legacyRegularRunFilter = (req: AuthenticatedRequest) => ({
  ...legacyPeriodScope(req),
  type: "regular" as const,
});
const LEGACY_RUN_ORDER = { createdAt: 1 as const, _id: 1 as const };

const runPayrollControllerStep = async (
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
const LEGACY_RUN_ONLY = { activeRevisionId: { $exists: false } };
const hasRevisionBackedRun = async (req: AuthenticatedRequest) => Boolean(
  await PayrollRunModel.exists({ ...legacyRegularRunFilter(req), activeRevisionId: { $exists: true } }),
);
const revisionBackedRunFailure = (res: Response) => res.status(409).json({
  status: "error",
  code: "PAYROLL_OPERATIONAL_RUN",
  message: "This payroll run is revision-backed; use the run workflow endpoints",
});
const audit = (req: AuthenticatedRequest, periodKey: string, action: any, metadata?: Record<string, unknown>) => PayrollAuditModel.create({ companyCode: tenant(req), branchId: req.user?.branchId || "", periodKey, action, actorId: req.user!.id, metadata });
const snapshotPayrollPayment = (profile: any) => profile ? ({
  method: profile.paymentMethod ?? "transfer",
  ...(profile.bankName ? { bankName: profile.bankName } : {}),
  ...(profile.bankCode ? { bankCode: profile.bankCode } : {}),
  ...(profile.bankAccountNumber ? { bankAccountNumber: profile.bankAccountNumber } : {}),
  ...(profile.bankAccountHolder ? { bankAccountHolder: profile.bankAccountHolder } : {}),
}) : undefined;
const operationalScope = (req: AuthenticatedRequest) => {
  const companyCode = tenant(req);
  const branchId = req.user?.branchId || "";
  return companyCode && branchId ? { companyCode, branchId } : null;
};
const runWithEffectiveChecksum = (run: any, checksum: string) => ({
  ...run,
  activeRevisionChecksum: checksum,
});
const publicationMatchesEffectivePayroll = (
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
const paymentTransitionHandler = (action: PayrollPaymentAction) => async (req: AuthenticatedRequest, res: Response) => {
  const scope = operationalScope(req);
  if (!scope) return validationFailure(res, "Authenticated company and branch are required");
  const { error, value } = paymentTransitionSchema.validate(req.body ?? {}, { abortEarly: false, stripUnknown: true });
  if (error) return validationFailure(res, error.message);
  try {
    const result = await transitionPayrollPayment(scope, req.params.id, req.user!.id, action, {
      ...value,
      correlationId: value.correlationId ?? (req.headers["x-correlation-id"] as string | undefined),
    });
    return res.json({ status: "success", data: result.payment, runStatus: result.runStatus });
  } catch (operationError) {
    return operationFailure(res, operationError);
  }
};
const workflowHandler = (action: PayrollWorkflowAction) => async (req: AuthenticatedRequest, res: Response) => {
  const scope = operationalScope(req);
  if (!scope) return validationFailure(res, "Authenticated company and branch are required");
  const schema = action === "reopen" ? reopenRunSchema : workflowTransitionSchema;
  const { error, value } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
  if (error) return validationFailure(res, error.message);
  try {
    const run = await runPayrollWorkflowAction(scope, req.params.id, req.user!.id, action, {
      expectedVersion: value.expectedVersion,
      reason: value.reason,
      correlationId: value.correlationId ?? (req.headers["x-correlation-id"] as string | undefined),
    });
    return res.json({ status: "success", data: run });
  } catch (operationError) {
    return operationFailure(res, operationError);
  }
};
const validationFailure = (res: Response, message: string) => res.status(400).json({
  status: "error", code: "PAYROLL_VALIDATION_ERROR", message,
});
const operationFailure = (res: Response, error: unknown) => {
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

export const payrollController = {
  async processPeriod(req: AuthenticatedRequest, res: Response) {
    const existing = await PayrollRunModel.findOne(legacyRegularRunFilter(req)).sort(LEGACY_RUN_ORDER).lean();
    if (existing && existing.status !== "draft") {
      return res.status(409).json({
        status: "error",
        code: "PAYROLL_INVALID_TRANSITION",
        message: "Chỉ có thể cập nhật bảng lương khi kỳ đang ở trạng thái Nháp.",
      });
    }
    const periodKey = req.params.periodKey;
    const periodEnd = new Date(Date.UTC(Number(periodKey.slice(0, 4)), Number(periodKey.slice(5, 7)), 0)).toISOString().slice(0, 10);
    const policies: any[] = await PayrollPolicyModel.find({ companyCode: tenant(req), status: "active" }).lean();
    if (!resolvePersistedPayrollPolicy(policies as any[], periodEnd)) {
      return res.status(409).json({ status: "error", code: "PAYROLL_POLICY_REQUIRED", message: "Cần áp dụng công thức lương cho kỳ này" });
    }
    try {
      const run = await processPayrollPeriod({
        syncAttendance: () => runPayrollControllerStep(payrollController.createSnapshot, req),
        lockAttendance: () => runPayrollControllerStep(payrollController.lockResults, req),
        calculatePayroll: () => runPayrollControllerStep(payrollController.createRun, req),
      });
      return res.json({ status: "success", data: run });
    } catch (error) {
      if (error instanceof PayrollPeriodProcessingError) {
        return res.status(error.status).json({
          status: "error",
          code: "PAYROLL_PROCESSING_FAILED",
          stage: error.stage,
          message: error.message,
        });
      }
      return operationFailure(res, error);
    }
  },
  async createOperationalRun(req: AuthenticatedRequest, res: Response) {
    const scope = operationalScope(req);
    if (!scope) return validationFailure(res, "Authenticated company and branch are required");
    const { error, value } = createOperationalRunSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) return validationFailure(res, error.message);
    try {
      const run = await createOperationalPayrollRun(scope, req.user!.id, value);
      return res.status(201).json({ status: "success", data: run });
    } catch (operationError) {
      return operationFailure(res, operationError);
    }
  },
  async syncAttendance(req: AuthenticatedRequest, res: Response) {
    const scope = operationalScope(req);
    if (!scope) return validationFailure(res, "Authenticated company and branch are required");
    const body = syncAttendanceSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (body.error) return validationFailure(res, body.error.message);
    const headers = syncAttendanceHeadersSchema.validate(req.headers, { abortEarly: false });
    if (headers.error) return validationFailure(res, headers.error.message);
    try {
      const result = await syncOperationalPayrollAttendance(
        scope,
        req.params.id,
        req.user!.id,
        body.value.expectedVersion,
        headers.value["idempotency-key"],
      );
      return res.json({ status: "success", data: result });
    } catch (operationError) {
      return operationFailure(res, operationError);
    }
  },
  async listRunIssues(req: AuthenticatedRequest, res: Response) {
    const scope = operationalScope(req);
    if (!scope) return validationFailure(res, "Authenticated company and branch are required");
    try {
      const issues = await listOperationalPayrollIssues(scope, req.params.id);
      return res.json({ status: "success", data: issues });
    } catch (operationError) {
      return operationFailure(res, operationError);
    }
  },
  async lockAttendance(req: AuthenticatedRequest, res: Response) {
    const scope = operationalScope(req);
    if (!scope) return validationFailure(res, "Authenticated company and branch are required");
    const { error, value } = lockAttendanceSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) return validationFailure(res, error.message);
    try {
      const result = await lockOperationalPayrollAttendance(scope, req.params.id, req.user!.id, value.expectedVersion);
      return res.json({ status: "success", data: result });
    } catch (operationError) {
      return operationFailure(res, operationError);
    }
  },
  async calculateRun(req: AuthenticatedRequest, res: Response) {
    const scope = operationalScope(req);
    if (!scope) return validationFailure(res, "Authenticated company and branch are required");
    const body = calculateRunSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (body.error) return validationFailure(res, body.error.message);
    const headers = syncAttendanceHeadersSchema.validate(req.headers, { abortEarly: false });
    if (headers.error) return validationFailure(res, headers.error.message);
    try {
      const result = await calculateOperationalRun(
        scope,
        req.params.id,
        req.user!.id,
        body.value.expectedVersion,
        headers.value["idempotency-key"],
      );
      return res.json({ status: "success", data: result });
    } catch (operationError) {
      return operationFailure(res, operationError);
    }
  },
  async listPolicies(req: AuthenticatedRequest, res: Response) {
    return res.json({ status: "success", data: await listPayrollPolicies(tenant(req)) });
  },
  async createPolicy(req: AuthenticatedRequest, res: Response) {
    const { error, value } = createPolicySchema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) return validationFailure(res, error.message);
    try {
      return res.status(201).json({ status: "success", data: await createPayrollPolicy(tenant(req), req.user!.id, value) });
    } catch (operationError) {
      return operationFailure(res, operationError);
    }
  },
  async activatePolicy(req: AuthenticatedRequest, res: Response) {
    const { error, value } = activatePolicySchema.validate(req.body ?? {}, { abortEarly: false, stripUnknown: true });
    if (error) return validationFailure(res, error.message);
    try {
      return res.json({ status: "success", data: await activatePayrollPolicy(tenant(req), req.params.id, req.user!.id, value) });
    } catch (operationError) {
      return operationFailure(res, operationError);
    }
  },
  async retirePolicy(req: AuthenticatedRequest, res: Response) {
    try {
      return res.json({ status: "success", data: await retirePayrollPolicy(tenant(req), req.params.id, req.user!.id) });
    } catch (operationError) {
      return operationFailure(res, operationError);
    }
  },
  async updatePolicy(req: AuthenticatedRequest, res: Response) {
    const { error, value } = updatePolicySchema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) return validationFailure(res, error.message);
    const { expectedVersion, ...definition } = value;
    try { return res.json({ status: "success", data: await updatePayrollPolicy(tenant(req), req.params.id, req.user!.id, expectedVersion, definition) }); }
    catch (operationError) { return operationFailure(res, operationError); }
  },
  async clonePolicy(req: AuthenticatedRequest, res: Response) {
    const { error, value } = clonePolicySchema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) return validationFailure(res, error.message);
    try { return res.status(201).json({ status: "success", data: await clonePayrollPolicy(tenant(req), req.params.id, req.user!.id, value) }); }
    catch (operationError) { return operationFailure(res, operationError); }
  },
  async deletePolicy(req: AuthenticatedRequest, res: Response) {
    try { return res.json({ status: "success", data: await deletePayrollPolicy(tenant(req), req.params.id, req.user!.id) }); }
    catch (operationError) { return operationFailure(res, operationError); }
  },
  reviewOperationalRun: workflowHandler("review"),
  closeOperationalRun: workflowHandler("close"),
  reopenOperationalRun: workflowHandler("reopen"),
  markOperationalRunPaid: workflowHandler("markPaid"),
  async listRunAudit(req: AuthenticatedRequest, res: Response) {
    const scope = operationalScope(req);
    if (!scope) return validationFailure(res, "Authenticated company and branch are required");
    const { error, value } = auditQuerySchema.validate(req.query, { abortEarly: false });
    if (error) return validationFailure(res, error.message);
    const run: any = await PayrollRunModel.findOne({ _id: req.params.id, ...scope }).select("periodKey").lean();
    if (!run) return res.status(404).json({ status: "error", code: "PAYROLL_RUN_NOT_FOUND", message: "Payroll run not found" });
    const filter = { ...scope, periodKey: run.periodKey, ...(value.action ? { action: value.action } : {}) };
    const [items, total] = await Promise.all([
      PayrollAuditModel.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((value.page - 1) * value.limit)
        .limit(value.limit)
        .lean(),
      PayrollAuditModel.countDocuments(filter),
    ]);
    return res.json({
      status: "success",
      data: items,
      pagination: { page: value.page, limit: value.limit, total, totalPages: Math.ceil(total / value.limit) },
    });
  },
  async createSnapshot(req: AuthenticatedRequest, res: Response) {
    const requestedEmployees = req.body?.employees as { employeeId: string; employeeName?: string; monthlySalary: number }[] | undefined;
    const period = req.params.periodKey;
    if (!/^\d{4}-\d{2}$/.test(period)) return res.status(400).json({ status: "error", message: "Ky luong phai co dang YYYY-MM." });
    const periodScope = legacyPeriodScope(req);
    const existingRun = await PayrollRunModel.findOne(legacyRegularRunFilter(req)).sort(LEGACY_RUN_ORDER).lean();
    if (existingRun?.status === "closed") return res.status(409).json({ status: "error", message: "Ky luong da chot. Hay reset ky truoc khi dong bo lai cham cong." });
    const company = await CompanyModel.findOne({ code: tenant(req) }).select("locationConfig").lean();
    const companyWorkingDays = Array.isArray(company?.locationConfig?.workingDays) && company.locationConfig.workingDays.length ? company.locationConfig.workingDays : [1, 2, 3, 4, 5];
    const companyDailyMinutes = computeStandardDailyMinutes(company?.locationConfig?.checkInLimit, company?.locationConfig?.checkOutLimit, company?.locationConfig?.lunchBreakStart, company?.locationConfig?.lunchBreakEnd);
    const employees = requestedEmployees?.length
      ? requestedEmployees.map((employee) => ({ ...employee, workingDays: companyWorkingDays, standardDailyMinutes: companyDailyMinutes, checkInLimit: company?.locationConfig?.checkInLimit || "08:30", checkOutLimit: company?.locationConfig?.checkOutLimit || "17:30", lunchBreakStart: company?.locationConfig?.lunchBreakStart, lunchBreakEnd: company?.locationConfig?.lunchBreakEnd }))
      : await Promise.all((await UserModel.find({ companyCode: tenant(req), branchId: periodScope.branchId, isActive: { $ne: false }, monthlySalary: { $gte: 0 } }).select("_id displayName monthlySalary workHoursConfig").lean()).map(async (user) => {
          const resolved = await resolveShift(tenant(req), String(user._id), `${period}-01`);
          const shift = resolved.shift;
          const unpaidBreak = shift.breakPeriods?.find((item: any) => !item.paid);
          return {
            employeeId: String(user._id),
            employeeName: user.displayName,
            monthlySalary: user.monthlySalary || 0,
            workingDays: shift.workingDays,
            standardDailyMinutes: shift.standardMinutes,
            checkInLimit: shift.startTime,
            checkOutLimit: shift.endTime,
            lunchBreakStart: unpaidBreak?.startTime,
            lunchBreakEnd: unpaidBreak?.endTime,
          };
        }));
    if (!employees.length) return res.status(400).json({ status: "error", message: "Chưa có nhân viên được cấu hình lương." });
    const start = `${period}-01`; const endDate = new Date(Number(period.slice(0, 4)), Number(period.slice(5, 7)), 0); const end = `${period}-${String(endDate.getDate()).padStart(2, "0")}`;
    const logBranchFilter = periodScope.branchId ? { $in: [periodScope.branchId, null, undefined] } : { $in: [null, undefined, ""] };
    const logs = await TimekeepingLogModel.find({ companyCode: tenant(req), branchId: logBranchFilter, date: { $gte: start, $lte: end } }).lean();
    const calendarDays = await CompanyWorkCalendarDayModel.find({ companyCode: tenant(req), branchId: logBranchFilter, date: { $gte: start, $lte: end }, isApplied: true }).lean();
    const calendarRules = new Map<string, any[]>();
    for (const rule of calendarDays) calendarRules.set(rule.date, [...(calendarRules.get(rule.date) || []), rule]);
    const leaves = await HRLeaveApplicationModel.find({ companyCode: tenant(req), branchId: logBranchFilter, status: "approved", startDate: { $lte: new Date(`${end}T23:59:59`) }, endDate: { $gte: new Date(`${start}T00:00:00`) } }).lean();
    const today = formatInPayrollTimeZone(new Date(), "date");
    const results = [];
    for (const employee of employees) {
      const standardDays = countStandardDays(period, employee.workingDays, calendarRules);
      const standardHours = (employee.standardDailyMinutes * standardDays) / 60;
      const employeeLogs = logs
        .map((log) => ({ ...log, payrollDate: normalizePayrollLogDate(log.date) }))
        .filter((log) => log.uid === employee.employeeId && log.payrollDate && evaluateWorkingDate(log.payrollDate, calendarRules.get(log.payrollDate) || [], employee.workingDays))
        .map((log) => ({ date: log.payrollDate!, status: log.status, checkIn: log.checkIn?.time ? formatInPayrollTimeZone(log.checkIn.time, "time") : undefined, checkOut: log.checkOut?.time ? formatInPayrollTimeZone(log.checkOut.time, "time") : undefined }));
      const loggedDates = new Set(employeeLogs.map((log) => log.date));
      const leaveDates = new Set<string>();
      for (const leave of leaves) {
        if (leave.employeeId !== employee.employeeId) continue;
        const leaveStart = new Date(leave.startDate);
        const leaveEnd = new Date(leave.endDate);
        for (let d = new Date(leaveStart); d <= leaveEnd; d.setDate(d.getDate() + 1)) {
          leaveDates.add(formatInPayrollTimeZone(d, "date"));
        }
      }
      for (let day = 1; day <= endDate.getDate(); day += 1) {
        const date = `${period}-${String(day).padStart(2, "0")}`;
        if (date > today) continue;
        if (!evaluateWorkingDate(date, calendarRules.get(date) || [], employee.workingDays) || loggedDates.has(date)) continue;
        if (leaveDates.has(date)) { employeeLogs.push({ date, status: "Present", checkIn: employee.checkInLimit, checkOut: employee.checkOutLimit }); continue; }
        employeeLogs.push({ date, status: "Absent", checkIn: "", checkOut: "" });
      }
      const summary = summarizeAttendanceForPayroll({ standardDailyMinutes: employee.standardDailyMinutes, lunchBreakStart: employee.lunchBreakStart, lunchBreakEnd: employee.lunchBreakEnd, logs: employeeLogs, paidLeaves: [], overtime: [] });
      results.push(await AttendancePeriodResultModel.findOneAndUpdate({ ...periodScope, employeeId: employee.employeeId }, { $set: { ...periodScope, employeeId: employee.employeeId, employeeName: employee.employeeName || "", monthlySalary: employee.monthlySalary, standardHours, standardDays, workedMinutes: summary.workedMinutes, shortageMinutes: summary.shortageMinutes, workedDays: summary.workedDays, shortageDays: summary.shortageDays, paidLeaveMinutesByRate: summary.paidLeaveMinutesByRate, overtime: summary.overtime, status: "draft", needsRecalculation: false } }, { upsert: true, new: true, setDefaultsOnInsert: true }));
      console.log(`[payroll.snapshot] ${employee.employeeName} (${employee.employeeId}) rawLogsMatched=${logs.filter((log) => log.uid === employee.employeeId).length} totalLogsInPeriod=${logs.length} presentDays=${employeeLogs.filter((l) => l.status !== "Absent").length} absentGenerated=${employeeLogs.filter((l) => l.status === "Absent").length} standardDailyMinutes=${employee.standardDailyMinutes} workingDays=${JSON.stringify(employee.workingDays)} workedMinutes=${summary.workedMinutes} shortageMinutes=${summary.shortageMinutes}`);
    }
    await audit(req, period, "snapshot", { count: results.length });
    return res.status(201).json({ status: "success", data: results });
  },
  async listAudit(req: AuthenticatedRequest, res: Response) { const data = await PayrollAuditModel.find(legacyPeriodScope(req)).sort({ createdAt: -1 }).lean(); return res.json({ status: "success", data }); },
  async listResults(req: AuthenticatedRequest, res: Response) {
    if (!(await canManagePayroll(req))) {
      const run = await PayrollRunModel.findOne(legacyRegularRunFilter(req)).sort(LEGACY_RUN_ORDER).lean();
      if (!run) return res.json({ status: "success", data: [] });
    }
    const data = await AttendancePeriodResultModel.find(legacyPeriodScope(req)).lean();
    return res.json({ status: "success", data });
  },
  async lockResults(req: AuthenticatedRequest, res: Response) {
    const periodScope = legacyPeriodScope(req);
    const existingRun = await PayrollRunModel.findOne(legacyRegularRunFilter(req)).sort(LEGACY_RUN_ORDER).lean();
    if (existingRun?.status === "closed") return res.status(409).json({ status: "error", message: "Ky luong da chot. Hay reset ky truoc khi khoa lai cham cong." });
    const stale = await AttendancePeriodResultModel.exists({ ...periodScope, needsRecalculation: true });
    if (stale) return res.status(409).json({ status: "error", message: "Lịch sử chấm công đã thay đổi. Hãy đồng bộ công trước khi khóa." });
    const result = await AttendancePeriodResultModel.updateMany(
      { ...periodScope, status: "draft" },
      { $set: { status: "locked", lockedAt: new Date(), lockedBy: req.user!.id } },
    );
    await audit(req, req.params.periodKey, "lock", { count: result.modifiedCount });
    return res.json({ status: "success", lockedCount: result.modifiedCount });
  },
  async createRun(req: AuthenticatedRequest, res: Response) {
    const branchId = req.user?.branchId;
    if (!branchId) return res.status(400).json({ status: "error", message: "Cannot create payroll run: the authenticated user has no branch." });
    const rows = await AttendancePeriodResultModel.find({ companyCode: tenant(req), branchId, periodKey: req.params.periodKey, status: "locked" }).lean();
    if (!rows.length) return res.status(409).json({ status: "error", message: "Chua co ket qua cong da khoa." });
    if (rows.some((row) => row.needsRecalculation)) return res.status(409).json({ status: "error", message: "Dữ liệu công đã thay đổi. Hãy đồng bộ và khóa công lại." });
    const existing = await PayrollRunModel.findOne(legacyRegularRunFilter(req)).sort(LEGACY_RUN_ORDER).lean();
    // Kỳ đã tính nhưng chưa duyệt thì cho tính lại, để điều chỉnh phát sinh sau
    // khi bấm tính lương vẫn được cộng vào bảng lương.
    if (existing && existing.status !== "draft") {
      return res.status(409).json({
        status: "error",
        message: existing.status === "closed" ? "Kỳ lương đã chốt. Hãy reset kỳ trước khi tính lại." : "Bảng lương đã được duyệt. Hãy mở lại bảng lương trước khi tính lại.",
      });
    }
    // Bảo hiểm và thuế TNCN cần chính sách lương + hồ sơ payroll của từng nhân viên.
    // Thiếu bước này thì mọi khoản khấu trừ ra 0 đ dù lương bao nhiêu.
    const periodKey = req.params.periodKey;
    const period = { start: `${periodKey}-01`, end: new Date(Date.UTC(Number(periodKey.slice(0, 4)), Number(periodKey.slice(5, 7)), 0)).toISOString().slice(0, 10) };
    const employeeIds = rows.map((row) => row.employeeId);
    const [policies, profiles, dependents, adjustmentsData, formulas, periodInputs, customVariables] = await Promise.all([
      PayrollPolicyModel.find({ companyCode: tenant(req), status: "active" }).lean(),
      PayrollProfileModel.find({ companyCode: tenant(req), employeeId: { $in: employeeIds } }).lean(),
      PayrollDependentModel.find({ companyCode: tenant(req), employeeId: { $in: employeeIds } }).lean(),
      PayrollAdjustmentModel.find({ companyCode: tenant(req), branchId, periodKey, status: { $in: ["pending", "approved", "snapshotted"] } }).lean(),
      PAYROLL_FORMULA_LIBRARY_ENABLED ? PayrollFormulaModel.find({ companyCode: tenant(req), status: "active", effectiveFrom: { $lte: new Date(period.end) }, $or: [{ effectiveTo: { $exists: false } }, { effectiveTo: null }, { effectiveTo: { $gte: new Date(period.end) } }] }).sort({ priority: 1, code: 1 }).lean() : Promise.resolve([]),
      PayrollPeriodInputModel.find({ companyCode: tenant(req), branchId, periodKey, employeeId: { $in: employeeIds } }).lean(),
      PayrollCustomVariableModel.find({ companyCode: tenant(req), status: "active" }).lean(),
    ]);
    const policy = resolvePersistedPayrollPolicy(policies as any[], period.end);
    if (!policy) return res.status(409).json({ status: "error", code: "PAYROLL_POLICY_REQUIRED", message: "Cần áp dụng công thức lương cho kỳ này" });
    const byEmployee = <T extends { employeeId: unknown }>(items: T[]) => items.reduce((map, item) => {
      const key = String(item.employeeId);
      map.set(key, [...(map.get(key) ?? []), item]);
      return map;
    }, new Map<string, T[]>());
    const profilesByEmployee = byEmployee(profiles as any[]);
    const dependentsByEmployee = byEmployee(dependents as any[]);

    const adjustmentsMap = new Map<string, { allowances: number; bonuses: number; deductions: number; adjustments: number }>();
    const periodInputMap = new Map((periodInputs as any[]).map((item:any)=>[String(item.employeeId),item]));
    for (const adj of adjustmentsData) {
      const empId = String(adj.employeeId);
      const cur = adjustmentsMap.get(empId) ?? { allowances: 0, bonuses: 0, deductions: 0, adjustments: 0 };
      if (adj.kind === "bonus") cur.bonuses += Number(adj.amount || 0);
      else if (adj.kind === "deduction") cur.deductions += Number(adj.amount || 0);
      else if (adj.kind === "allowance") cur.allowances += Number(adj.amount || 0);
      else cur.adjustments += Number(adj.amount || 0);
      adjustmentsMap.set(empId, cur);
    }

    const lines = rows.map((row) => {
      const workedMinutes = row.workedMinutes ?? ((row.workedDays || 0) * row.standardHours * 60) / row.standardDays;
      const empAdjustments = adjustmentsMap.get(String(row.employeeId)) ?? { allowances: 0, bonuses: 0, deductions: 0, adjustments: 0 };
      const periodInput:any=periodInputMap.get(String(row.employeeId));
      const sourceDays=(row.workedDays??(row.standardDays>0?workedMinutes/(row.standardHours*60/row.standardDays):0));
      const resolvedPeriod=resolvePayrollPeriodInputs({agreedSalary:row.monthlySalary,reconciledDays:sourceDays,reconciledHours:workedMinutes/60,allowance:empAdjustments.allowances,bonus:empAdjustments.bonuses,deduction:empAdjustments.deductions},periodInput,customVariables as any[]);
      const effectiveSalary=resolvedPeriod.values.agreedSalary,effectiveWorkedMinutes=resolvedPeriod.values.reconciledHours*60;
      const dailyMinutes = row.standardDays > 0 ? row.standardHours * 60 / row.standardDays : 0;
      const overtimeHours = (category: string) => (row.overtime ?? []).filter((item: any) => item.category === category).reduce((sum: number, item: any) => sum + Number(item.minutes || 0), 0) / 60;
      const customContext=Object.fromEntries(Object.entries(resolvedPeriod.customValues).map(([key,item])=>[key,item.value]));
      const formulaContext = { monthlySalary: effectiveSalary, attendanceSalary: row.standardDays > 0 ? effectiveSalary * resolvedPeriod.values.reconciledDays / row.standardDays : 0, standardWorkDays: row.standardDays, actualWorkDays: resolvedPeriod.values.reconciledDays, standardWorkHours: row.standardHours, actualWorkHours: resolvedPeriod.values.reconciledHours, shortageMinutes: row.shortageMinutes ?? 0, lateMinutes: Number((row as any).lateMinutes || 0), earlyLeaveMinutes: Number((row as any).earlyLeaveMinutes || 0), paidLeaveDays: (row.paidLeaveMinutesByRate ?? []).reduce((sum: number, item: any) => sum + Number(item.minutes || 0), 0) / Math.max(1, dailyMinutes), weekdayOvertimeHours: overtimeHours("weekday"), restDayOvertimeHours: overtimeHours("restDay"), holidayOvertimeHours: overtimeHours("holiday"), tenureMonths: 0,...customContext };
      const library = PAYROLL_FORMULA_LIBRARY_ENABLED ? evaluatePayrollFormulas(formulas as any[], formulaContext) : emptyPayrollFormulaLibraryResult();
      const appliedAdjustments = { allowances: resolvedPeriod.values.allowance + library.totals.allowance, bonuses: resolvedPeriod.values.bonus + library.totals.bonus, deductions: resolvedPeriod.values.deduction + library.totals.deduction, adjustments: empAdjustments.adjustments + library.totals.adjustment };
      const calculation = calculatePayroll({
        monthlySalary: effectiveSalary,
        standardDays: row.standardDays,
        standardHours: row.standardHours,
        workedMinutes:effectiveWorkedMinutes,
        shortageMinutes: row.shortageMinutes,
        paidLeaveMinutesByRate: row.paidLeaveMinutesByRate,
        overtime: row.overtime,
        allowances: appliedAdjustments.allowances,
        bonuses: appliedAdjustments.bonuses,
        deductions: appliedAdjustments.deductions,
        adjustments: appliedAdjustments.adjustments,
      });
      const profile = selectProfileForPeriod(profilesByEmployee.get(String(row.employeeId)) ?? [], period);
      const payment = snapshotPayrollPayment(profile);
      const vietnam = calculateVietnamPayroll(policy, {
        workPay: calculation.adjustedBase,
        hourlyRate: calculation.hourlyRate,
        overtime: (row.overtime ?? []) as any,
        taxableAllowances: appliedAdjustments.allowances,
        bonuses: appliedAdjustments.bonuses + (appliedAdjustments.adjustments > 0 ? appliedAdjustments.adjustments : 0),
        otherDeductions: appliedAdjustments.deductions + (appliedAdjustments.adjustments < 0 ? -appliedAdjustments.adjustments : 0),
        // Chưa khai báo mức đóng riêng thì lấy lương tháng; trần đóng vẫn được áp.
        insuranceSalary: effectiveSalary,
        participatesInsurance: profile?.participatesInsurance ?? true,
        taxMethod: resolveTaxMethod(profile),
        dependentCount: countDependents(dependentsByEmployee.get(String(row.employeeId)) ?? [], period),
        hasWithholdingCommitment: Boolean(profile?.hasWithholdingCommitment),
      });
      return {
        employeeId: row.employeeId,
        employeeName: row.employeeName,
        calculation: {
          ...calculation,
          // Lưu lại các khoản điều chỉnh để bảng lương hiển thị cột thưởng/phạt.
          allowances: appliedAdjustments.allowances,
          bonuses: appliedAdjustments.bonuses,
          otherDeductions: appliedAdjustments.deductions,
          adjustments: appliedAdjustments.adjustments,
          gross: vietnam.income.totalIncome,
          deductions: vietnam.deductions.total,
          net: vietnam.netPay,
          monthlySalary: effectiveSalary,
          workedMinutes:effectiveWorkedMinutes,
          workedDays: row.workedDays || 0,
          standardHours: row.standardHours,
          standardDays: row.standardDays,
        },
        vietnam,
        formulaVersion: vietnam.formulaVersion,
        policyId: (policy as any)._id ? String((policy as any)._id) : undefined,
        policyVersion: Number((policy as any).version ?? 0), policyCode: policy.code, policyName: policy.name,
        warnings: vietnam.warnings.map((warning) => warning.code),
        formulaApplications: library.applications,
        periodInput:{version:Number(periodInput?.version??0),values:{...resolvedPeriod.values,...customContext},provenance:{...resolvedPeriod.provenance,...Object.fromEntries(Object.entries(resolvedPeriod.customValues).map(([key,item])=>[key,item.provenance]))}},
        ...(payment ? { payment } : {}),
      };
    });
    if (existing) {
      const run = await PayrollRunModel.findOneAndUpdate(
        {
          _id: existing._id,
          ...legacyRegularRunFilter(req),
          ...LEGACY_RUN_ONLY,
          status: "draft",
          version: Number(existing.version ?? 0),
        },
        { $set: { lines }, $inc: { version: 1 } },
        { new: true },
      ).lean();
      if (!run) {
        return res.status(409).json({
          status: "error",
          code: "PAYROLL_VERSION_CONFLICT",
          message: "Payroll run changed while it was being recalculated",
        });
      }
      await audit(req, req.params.periodKey, "calculate", { lineCount: lines.length, recalculated: true });
      const effectiveLines = await projectPayrollLinesWithStoredOverrides(
        { companyCode: tenant(req), branchId },
        { periodKey: req.params.periodKey, type: "regular" },
        lines,
      );
      return res.json({ status: "success", data: { ...run, effectiveLines } });
    }
    const run = await PayrollRunModel.create({ companyCode: tenant(req), branchId, periodKey: req.params.periodKey, type: "regular", status: "draft", createdBy: req.user!.id, lines });
    await audit(req, req.params.periodKey, "calculate", { lineCount: lines.length });
    return res.status(201).json({ status: "success", data: run });
  },
  async listPayments(req: AuthenticatedRequest, res: Response) {
    const scope = operationalScope(req);
    if (!scope) return validationFailure(res, "Authenticated company and branch are required");
    const data = await PayrollPaymentModel.find({ ...scope, runId: req.params.id }).sort({ createdAt: -1 }).lean();
    return res.json({ status: "success", data });
  },
  async createPayment(req: AuthenticatedRequest, res: Response) {
    const scope = operationalScope(req);
    if (!scope) return validationFailure(res, "Authenticated company and branch are required");
    const { error, value } = createPaymentSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) return validationFailure(res, error.message);
    try {
      const { payment, replayed } = await createPayrollPayment(scope, req.params.id, req.user!.id, {
        ...value,
        correlationId: value.correlationId ?? (req.headers["x-correlation-id"] as string | undefined),
      });
      return res.status(replayed ? 200 : 201).json({ status: "success", data: payment });
    } catch (operationError) {
      return operationFailure(res, operationError);
    }
  },
  confirmPayment: paymentTransitionHandler("confirm"),
  cancelPayment: paymentTransitionHandler("cancel"),
  reversePayment: paymentTransitionHandler("reverse"),
  async publishPayslips(req: AuthenticatedRequest, res: Response) {
    const scope = operationalScope(req); if (!scope) return validationFailure(res, "Authenticated company and branch are required");
    const run = await PayrollRunModel.findOne({ _id: req.params.id, ...scope }).lean();
    if (!run || !["closed", "paid"].includes(run.status)) return res.status(409).json({ status: "error", code: "PAYROLL_RUN_NOT_CLOSED" });
    let effective;
    try {
      effective = await loadAuthoritativePayrollLines(scope, run);
    } catch (error) {
      return operationFailure(res, error);
    }
    const eligibleEmployeeIds = new Set(effective.effectiveLines.map((line: any) => String(line.employeeId)));
    const requestedEmployeeIds = Array.isArray(req.body?.employeeIds)
      ? req.body.employeeIds.map(String)
      : [...eligibleEmployeeIds];
    const employeeIds = [...new Set(requestedEmployeeIds.filter((employeeId: string) => eligibleEmployeeIds.has(employeeId)))];
    const revisionChecksum = effective.effectiveChecksum;
    const docs = await Promise.all(employeeIds.map((employeeId: string) => PayslipPublicationModel.findOneAndUpdate({ ...scope, runId: String(run._id), employeeId }, { $set: { ...scope, runId: String(run._id), employeeId, revisionChecksum, status: "published", publishedBy: req.user!.id, publishedAt: new Date() } }, { upsert: true, new: true, setDefaultsOnInsert: true })));
    return res.json({ status: "success", data: docs });
  },
  async withdrawPayslip(req: AuthenticatedRequest, res: Response) {
    const scope = operationalScope(req); if (!scope) return validationFailure(res, "Authenticated company and branch are required");
    const doc = await PayslipPublicationModel.findOneAndUpdate({ ...scope, runId: req.params.id, employeeId: req.params.employeeId, status: "published" }, { $set: { status: "withdrawn", withdrawnBy: req.user!.id, withdrawnAt: new Date() } }, { new: true });
    if (!doc) return res.status(404).json({ status: "error", code: "PAYSLIP_NOT_FOUND" }); return res.json({ status: "success", data: doc });
  },
  async listEmployeePayslips(req: AuthenticatedRequest, res: Response) {
    const scope = operationalScope(req); if (!scope) return validationFailure(res, "Authenticated company and branch are required");
    const publications = await PayslipPublicationModel.find({ ...scope, employeeId: req.user!.id, status: "published" }).lean();
    try {
      const data = await Promise.all(publications.map(async (publication) => {
        const run = await PayrollRunModel.findOne({ _id: publication.runId, ...scope }).lean();
        if (!run || !["closed", "paid"].includes(run.status)) return null;
        const effective = await loadAuthoritativePayrollLines(scope, run);
        // A publication from before reopen/re-review is stale, not a reason to
        // fail the employee's entire payslip list. Hide it until republished.
        if (!publicationMatchesEffectivePayroll(publication.revisionChecksum, run, effective)) return null;
        const line = effective.effectiveLines.find((item: any) => String(item.employeeId) === req.user!.id);
        return line ? buildPayslip(
          runWithEffectiveChecksum(run, effective.effectiveChecksum),
          line as any,
          await PayrollPaymentModel.find({ ...scope, runId: publication.runId }).lean() as any,
        ) : null;
      }));
      return res.json({ status: "success", data: data.filter(Boolean) });
    } catch (error) {
      return operationFailure(res, error);
    }
  },
  async printPayslip(req: AuthenticatedRequest, res: Response) {
    const scope = operationalScope(req); if (!scope) return validationFailure(res, "Authenticated company and branch are required");
    
    // Check permission: must have payroll-period:read/manage, OR be printing their own payslip
    const permissions = await getEffectivePermissions(req.user!.id, req.user!.role, tenant(req));
    const canReadAny = permissions.has("*") || permissions.has("payroll-payment:read") || permissions.has("payroll-payment:manage");
    if (!canReadAny && req.user!.id !== req.params.employeeId) {
      return res.status(403).json({ status: "error", code: "PAYROLL_PERMISSION_DENIED", message: "Bạn chỉ có thể xem phiếu lương của chính mình." });
    }

    const publication = await PayslipPublicationModel.findOne({ ...scope, runId: req.params.id, employeeId: req.params.employeeId, status: "published" }).lean();
    if (!publication) return res.status(404).json({ status: "error", code: "PAYSLIP_NOT_PUBLISHED" });
    const run = await PayrollRunModel.findOne({ _id: req.params.id, ...scope }).lean();
    if (!run) return res.status(404).json({ status: "error", code: "PAYROLL_LINE_NOT_FOUND" });
    if (!["closed", "paid"].includes(run.status)) {
      return res.status(409).json({ status: "error", code: "PAYROLL_RUN_NOT_CLOSED" });
    }
    let effective;
    try {
      effective = await loadAuthoritativePayrollLines(scope, run);
    } catch (error) {
      return operationFailure(res, error);
    }
    const line = effective.effectiveLines.find((item: any) => String(item.employeeId) === req.params.employeeId);
    if (!line) return res.status(404).json({ status: "error", code: "PAYROLL_LINE_NOT_FOUND" });
    if (!publicationMatchesEffectivePayroll(publication.revisionChecksum, run, effective)) return res.status(409).json({ status: "error", code: "PAYROLL_CHECKSUM_MISMATCH" });
    const payslip = buildPayslip(
      runWithEffectiveChecksum(run, effective.effectiveChecksum),
      line as any,
      await PayrollPaymentModel.find({ ...scope, runId: req.params.id }).lean() as any,
    );
    const esc = (value: unknown) => String(value ?? "").replace(/[&<>\"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[char] || char));
    res.type("html").set("Content-Disposition", `inline; filename=payslip-${run.periodKey}-${payslip.employeeId}.html`); return res.send(`<!doctype html><html><head><meta charset="utf-8"><title>Payslip ${esc(run.periodKey)}</title><style>body{font:14px Arial;max-width:760px;margin:40px auto;color:#172033}h1{font-size:24px;border-bottom:2px solid #172033;padding-bottom:12px}.row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #ddd}.total{font-size:18px;font-weight:bold}@media print{body{margin:0}}</style></head><body><h1>Payslip ${esc(run.periodKey)}</h1><div class="row"><b>Nhân viên</b><span>${esc(payslip.employeeName || payslip.employeeId)}</span></div><div class="row"><b>Tổng thu nhập</b><span>${payslip.calculation.gross ?? 0}</span></div><div class="row"><b>Các khoản khấu trừ</b><span>${payslip.calculation.deductions ?? 0}</span></div><div class="row total"><b>Thực nhận</b><span>${payslip.netPay}</span></div><div class="row"><b>Đã thanh toán</b><span>${payslip.paidAmount}</span></div><div class="row"><b>Còn lại</b><span>${payslip.balance}</span></div><p>Mã kiểm tra: ${esc(payslip.checksum)}</p><script>window.print()</script></body></html>`);
  },  async exportPayroll(req: AuthenticatedRequest, res: Response) {
    const scope = operationalScope(req); if (!scope) return validationFailure(res, "Authenticated company and branch are required");
    const type = req.body?.type; if (!["detailed", "insurance", "pit", "bank_transfer"].includes(type)) return validationFailure(res, "Invalid export type");
    if (type === "bank_transfer") { const permissions = await getEffectivePermissions(req.user!.id, req.user!.role, tenant(req)); if (!permissions.has("*") && !permissions.has("payroll-payment:manage")) return res.status(403).json({ status: "error", code: "PAYROLL_PERMISSION_DENIED", message: "Bank transfer export requires payroll-payment:manage" }); }
    const run = await PayrollRunModel.findOne({ _id: req.params.id, ...scope }).lean();
    if (!run || !["closed", "paid"].includes(run.status)) return res.status(409).json({ status: "error", code: "PAYROLL_RUN_NOT_CLOSED" });
    let effective;
    try {
      effective = await loadAuthoritativePayrollLines(scope, run);
    } catch (error) {
      return operationFailure(res, error);
    }
    const revisionChecksum = effective.effectiveChecksum;
    const buffer = workbookBuffer(buildPayrollWorkbook(type, effective.effectiveLines as any)); const checksum = calculatePayrollChecksum(buffer.toString("base64"));
    const job = await PayrollExportJobModel.create({ ...scope, runId: String(run._id), type, revisionChecksum, status: "completed", createdBy: req.user!.id, output: { contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", size: buffer.length, checksum }, completedAt: new Date() });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"); res.setHeader("Content-Disposition", `attachment; filename=payroll-${run.periodKey}-${type}.xlsx`); return res.send(buffer);
  },  async listAdjustments(req: AuthenticatedRequest, res: Response) {
    const data = await PayrollAdjustmentModel.find(legacyPeriodScope(req)).sort({ createdAt: -1 }).lean();
    const employeeIds = Array.from(new Set(data.map((item) => item.employeeId)));
    const users = await UserModel.find({ _id: { $in: employeeIds } }).select("displayName email").lean();
    const userMap = new Map(users.map((u) => [String(u._id), u.displayName || u.email]));
    const enriched = data.map((item) => ({
      ...item,
      employeeName: userMap.get(item.employeeId) || item.employeeId,
    }));
    return res.json({ status: "success", data: enriched });
  },  async createAdjustment(req: AuthenticatedRequest, res: Response) {
    const { employeeId, kind, amount, reason } = req.body;
    if (!employeeId || !kind || !Number.isFinite(amount) || amount < 0 || !String(reason || "").trim()) return res.status(400).json({ status: "error", message: "Du lieu dieu chinh khong hop le." });
    const adjustment = await PayrollAdjustmentModel.create({ ...legacyPeriodScope(req), employeeId, kind, amount, reason, createdBy: req.user!.id });
    return res.status(201).json({ status: "success", data: adjustment });
  },
  async approveAdjustment(req: AuthenticatedRequest, res: Response) {
    const adjustment = await PayrollAdjustmentModel.findOneAndUpdate(
      { _id: req.params.adjustmentId, ...legacyPeriodScope(req), status: "pending" },
      { $set: { status: "approved", approvedBy: req.user!.id }, $inc: { version: 1 } },
      { new: true },
    );
    if (!adjustment) return res.status(409).json({ status: "error", message: "Dieu chinh khong ton tai hoac da duoc xu ly." });
    
    // Automatically recalculate the legacy run if it exists in calculated status
    const run = await PayrollRunModel.findOne(legacyRegularRunFilter(req)).sort(LEGACY_RUN_ORDER);
    if (run && run.status === "draft" && !run.activeRevisionId && run.lines?.length) {
      try {
        const periodKey = run.periodKey;
        const branchId = run.branchId;
        const companyCode = run.companyCode;
        const rows = await AttendancePeriodResultModel.find({ companyCode, branchId, periodKey, status: "locked" }).lean();
        if (rows.length > 0) {
          const employeeIds = rows.map((row) => row.employeeId);
          const [policies, profiles, dependents, adjustmentsData] = await Promise.all([
            PayrollPolicyModel.find({ companyCode, status: "active" }).lean(),
            PayrollProfileModel.find({ companyCode, employeeId: { $in: employeeIds } }).lean(),
            PayrollDependentModel.find({ companyCode, employeeId: { $in: employeeIds } }).lean(),
            PayrollAdjustmentModel.find({ companyCode, branchId, periodKey, status: { $in: ["pending", "approved", "snapshotted"] } }).lean()
          ]);
          const period = { start: `${periodKey}-01`, end: new Date(Date.UTC(Number(periodKey.slice(0, 4)), Number(periodKey.slice(5, 7)), 0)).toISOString().slice(0, 10) };
          const policy = resolvePersistedPayrollPolicy(policies as any[], period.end);
          if (!policy) throw new PayrollOperationError("PAYROLL_POLICY_REQUIRED", "Cần áp dụng công thức lương cho kỳ này", 409);
          const byEmployee = <T extends { employeeId: unknown }>(items: T[]) => items.reduce((map, item) => {
            const key = String(item.employeeId);
            map.set(key, [...(map.get(key) ?? []), item]);
            return map;
          }, new Map<string, T[]>());
          const profilesByEmployee = byEmployee(profiles as any[]);
          const dependentsByEmployee = byEmployee(dependents as any[]);
          const adjustmentsMap = new Map<string, { allowances: number; bonuses: number; deductions: number; adjustments: number }>();
          for (const adj of adjustmentsData) {
            const empId = String(adj.employeeId);
            const cur = adjustmentsMap.get(empId) ?? { allowances: 0, bonuses: 0, deductions: 0, adjustments: 0 };
            if (adj.kind === "bonus") cur.bonuses += Number(adj.amount || 0);
            else if (adj.kind === "deduction") cur.deductions += Number(adj.amount || 0);
            else if (adj.kind === "allowance") cur.allowances += Number(adj.amount || 0);
            else cur.adjustments += Number(adj.amount || 0);
            adjustmentsMap.set(empId, cur);
          }
          const lines = rows.map((row) => {
            const workedMinutes = row.workedMinutes ?? ((row.workedDays || 0) * row.standardHours * 60) / row.standardDays;
            const empAdjustments = adjustmentsMap.get(String(row.employeeId)) ?? { allowances: 0, bonuses: 0, deductions: 0, adjustments: 0 };
            const calculation = calculatePayroll({
              monthlySalary: row.monthlySalary,
              standardDays: row.standardDays,
              standardHours: row.standardHours,
              workedMinutes,
              shortageMinutes: row.shortageMinutes,
              paidLeaveMinutesByRate: row.paidLeaveMinutesByRate,
              overtime: row.overtime,
              allowances: empAdjustments.allowances,
              bonuses: empAdjustments.bonuses,
              deductions: empAdjustments.deductions,
              adjustments: empAdjustments.adjustments,
            });
            const profile = selectProfileForPeriod(profilesByEmployee.get(String(row.employeeId)) ?? [], period);
            const payment = snapshotPayrollPayment(profile);
            const vietnam = calculateVietnamPayroll(policy, {
              workPay: calculation.adjustedBase,
              hourlyRate: calculation.hourlyRate,
              overtime: (row.overtime ?? []) as any,
              taxableAllowances: empAdjustments.allowances,
              bonuses: empAdjustments.bonuses + (empAdjustments.adjustments > 0 ? empAdjustments.adjustments : 0),
              otherDeductions: empAdjustments.deductions + (empAdjustments.adjustments < 0 ? -empAdjustments.adjustments : 0),
              insuranceSalary: row.monthlySalary,
              participatesInsurance: profile?.participatesInsurance ?? true,
              taxMethod: resolveTaxMethod(profile),
              dependentCount: countDependents(dependentsByEmployee.get(String(row.employeeId)) ?? [], period),
              hasWithholdingCommitment: Boolean(profile?.hasWithholdingCommitment),
            });
            return {
              employeeId: row.employeeId,
              employeeName: row.employeeName,
              calculation: {
                ...calculation,
                // Lưu lại các khoản điều chỉnh để bảng lương hiển thị cột thưởng/phạt.
                allowances: empAdjustments.allowances,
                bonuses: empAdjustments.bonuses,
                otherDeductions: empAdjustments.deductions,
                adjustments: empAdjustments.adjustments,
                gross: vietnam.income.totalIncome,
                deductions: vietnam.deductions.total,
                net: vietnam.netPay,
                monthlySalary: row.monthlySalary,
                workedMinutes,
                workedDays: row.workedDays || 0,
                standardHours: row.standardHours,
                standardDays: row.standardDays,
              },
              vietnam,
              formulaVersion: vietnam.formulaVersion,
              policyId: (policy as any)._id ? String((policy as any)._id) : undefined,
              policyVersion: Number((policy as any).version ?? 0), policyCode: policy.code, policyName: policy.name,
              warnings: vietnam.warnings.map((warning) => warning.code),
              ...(payment ? { payment } : {}),
            };
          });
          const updated = await PayrollRunModel.findOneAndUpdate(
            {
              _id: run._id,
              ...legacyRegularRunFilter(req),
              ...LEGACY_RUN_ONLY,
              status: "draft",
              version: Number(run.version ?? 0),
            },
            { $set: { lines }, $inc: { version: 1 } },
            { new: true },
          ).lean();
          if (!updated) throw new PayrollOperationError(
            "PAYROLL_VERSION_CONFLICT",
            "Payroll run changed while its adjustment was being recalculated",
            409,
          );
        }
      } catch (err) {
        console.error("Recalculation error on approveAdjustment:", err);
      }
    }

    await audit(req, req.params.periodKey, "adjustment", { adjustmentId: String(adjustment._id) });
    return res.json({ status: "success", data: adjustment });
  },
  async rejectAdjustment(req: AuthenticatedRequest, res: Response) {
    const adjustment = await PayrollAdjustmentModel.findOneAndUpdate(
      { _id: req.params.adjustmentId, ...legacyPeriodScope(req), status: "pending" },
      { $set: { status: "rejected", approvedBy: req.user!.id }, $inc: { version: 1 } },
      { new: true },
    );
    if (!adjustment) return res.status(409).json({ status: "error", message: "Dieu chinh khong ton tai hoac da duoc xu ly." });
    
    // Automatically recalculate the legacy run if it exists in calculated status
    const run = await PayrollRunModel.findOne(legacyRegularRunFilter(req)).sort(LEGACY_RUN_ORDER);
    if (run && run.status === "draft" && !run.activeRevisionId && run.lines?.length) {
      try {
        const periodKey = run.periodKey;
        const branchId = run.branchId;
        const companyCode = run.companyCode;
        const rows = await AttendancePeriodResultModel.find({ companyCode, branchId, periodKey, status: "locked" }).lean();
        if (rows.length > 0) {
          const employeeIds = rows.map((row) => row.employeeId);
          const [policies, profiles, dependents, adjustmentsData] = await Promise.all([
            PayrollPolicyModel.find({ companyCode, status: "active" }).lean(),
            PayrollProfileModel.find({ companyCode, employeeId: { $in: employeeIds } }).lean(),
            PayrollDependentModel.find({ companyCode, employeeId: { $in: employeeIds } }).lean(),
            PayrollAdjustmentModel.find({ companyCode, branchId, periodKey, status: { $in: ["pending", "approved", "snapshotted"] } }).lean()
          ]);
          const period = { start: `${periodKey}-01`, end: new Date(Date.UTC(Number(periodKey.slice(0, 4)), Number(periodKey.slice(5, 7)), 0)).toISOString().slice(0, 10) };
          const policy = resolvePersistedPayrollPolicy(policies as any[], period.end);
          if (!policy) throw new PayrollOperationError("PAYROLL_POLICY_REQUIRED", "Cần áp dụng công thức lương cho kỳ này", 409);
          const byEmployee = <T extends { employeeId: unknown }>(items: T[]) => items.reduce((map, item) => {
            const key = String(item.employeeId);
            map.set(key, [...(map.get(key) ?? []), item]);
            return map;
          }, new Map<string, T[]>());
          const profilesByEmployee = byEmployee(profiles as any[]);
          const dependentsByEmployee = byEmployee(dependents as any[]);
          const adjustmentsMap = new Map<string, { allowances: number; bonuses: number; deductions: number; adjustments: number }>();
          for (const adj of adjustmentsData) {
            const empId = String(adj.employeeId);
            const cur = adjustmentsMap.get(empId) ?? { allowances: 0, bonuses: 0, deductions: 0, adjustments: 0 };
            if (adj.kind === "bonus") cur.bonuses += Number(adj.amount || 0);
            else if (adj.kind === "deduction") cur.deductions += Number(adj.amount || 0);
            else if (adj.kind === "allowance") cur.allowances += Number(adj.amount || 0);
            else cur.adjustments += Number(adj.amount || 0);
            adjustmentsMap.set(empId, cur);
          }
          const lines = rows.map((row) => {
            const workedMinutes = row.workedMinutes ?? ((row.workedDays || 0) * row.standardHours * 60) / row.standardDays;
            const empAdjustments = adjustmentsMap.get(String(row.employeeId)) ?? { allowances: 0, bonuses: 0, deductions: 0, adjustments: 0 };
            const calculation = calculatePayroll({
              monthlySalary: row.monthlySalary,
              standardDays: row.standardDays,
              standardHours: row.standardHours,
              workedMinutes,
              shortageMinutes: row.shortageMinutes,
              paidLeaveMinutesByRate: row.paidLeaveMinutesByRate,
              overtime: row.overtime,
              allowances: empAdjustments.allowances,
              bonuses: empAdjustments.bonuses,
              deductions: empAdjustments.deductions,
              adjustments: empAdjustments.adjustments,
            });
            const profile = selectProfileForPeriod(profilesByEmployee.get(String(row.employeeId)) ?? [], period);
            const payment = snapshotPayrollPayment(profile);
            const vietnam = calculateVietnamPayroll(policy, {
              workPay: calculation.adjustedBase,
              hourlyRate: calculation.hourlyRate,
              overtime: (row.overtime ?? []) as any,
              taxableAllowances: empAdjustments.allowances,
              bonuses: empAdjustments.bonuses + (empAdjustments.adjustments > 0 ? empAdjustments.adjustments : 0),
              otherDeductions: empAdjustments.deductions + (empAdjustments.adjustments < 0 ? -empAdjustments.adjustments : 0),
              insuranceSalary: row.monthlySalary,
              participatesInsurance: profile?.participatesInsurance ?? true,
              taxMethod: resolveTaxMethod(profile),
              dependentCount: countDependents(dependentsByEmployee.get(String(row.employeeId)) ?? [], period),
              hasWithholdingCommitment: Boolean(profile?.hasWithholdingCommitment),
            });
            return {
              employeeId: row.employeeId,
              employeeName: row.employeeName,
              calculation: {
                ...calculation,
                // Lưu lại các khoản điều chỉnh để bảng lương hiển thị cột thưởng/phạt.
                allowances: empAdjustments.allowances,
                bonuses: empAdjustments.bonuses,
                otherDeductions: empAdjustments.deductions,
                adjustments: empAdjustments.adjustments,
                gross: vietnam.income.totalIncome,
                deductions: vietnam.deductions.total,
                net: vietnam.netPay,
                monthlySalary: row.monthlySalary,
                workedMinutes,
                workedDays: row.workedDays || 0,
                standardHours: row.standardHours,
                standardDays: row.standardDays,
              },
              vietnam,
              formulaVersion: vietnam.formulaVersion,
              policyId: (policy as any)._id ? String((policy as any)._id) : undefined,
              policyVersion: Number((policy as any).version ?? 0), policyCode: policy.code, policyName: policy.name,
              warnings: vietnam.warnings.map((warning) => warning.code),
              ...(payment ? { payment } : {}),
            };
          });
          const updated = await PayrollRunModel.findOneAndUpdate(
            {
              _id: run._id,
              ...legacyRegularRunFilter(req),
              ...LEGACY_RUN_ONLY,
              status: "draft",
              version: Number(run.version ?? 0),
            },
            { $set: { lines }, $inc: { version: 1 } },
            { new: true },
          ).lean();
          if (!updated) throw new PayrollOperationError(
            "PAYROLL_VERSION_CONFLICT",
            "Payroll run changed while its adjustment was being recalculated",
            409,
          );
        }
      } catch (err) {
        console.error("Recalculation error on rejectAdjustment:", err);
      }
    }

    await audit(req, req.params.periodKey, "adjustment_rejected", { adjustmentId: String(adjustment._id) });
    return res.json({ status: "success", data: adjustment });
  },  async approveRun(req: AuthenticatedRequest, res: Response) {
    if (await hasRevisionBackedRun(req)) return revisionBackedRunFailure(res);
    const scope = operationalScope(req);
    if (!scope) return validationFailure(res, "Authenticated company and branch are required");
    const current = await PayrollRunModel.findOne({
      ...legacyRegularRunFilter(req),
      ...LEGACY_RUN_ONLY,
      status: "draft",
    }).sort(LEGACY_RUN_ORDER).lean();
    if (!current) return res.status(409).json({ status: "error", message: "Bang luong khong o trang thai cho duyet." });
    let effectiveSnapshot;
    try {
      effectiveSnapshot = await createEffectivePayrollSnapshot(scope, current);
    } catch (error) {
      return operationFailure(res, error);
    }
    const run = await PayrollRunModel.findOneAndUpdate(
      {
        _id: current._id,
        ...legacyRegularRunFilter(req),
        ...LEGACY_RUN_ONLY,
        status: "draft",
        version: Number(current.version ?? 0),
      },
      { $set: { status: "review", reviewedBy: req.user!.id, effectiveSnapshot }, $inc: { version: 1 } },
      { new: true },
    );
    if (!run) return res.status(409).json({ status: "error", message: "Bang luong khong o trang thai cho duyet." });

    return res.json({ status: "success", data: run });
  },
  async closeRun(req: AuthenticatedRequest, res: Response) {
    if (await hasRevisionBackedRun(req)) return revisionBackedRunFailure(res);
    const scope = operationalScope(req);
    if (!scope) return validationFailure(res, "Authenticated company and branch are required");
    const current = await PayrollRunModel.findOne({
      ...legacyRegularRunFilter(req),
      ...LEGACY_RUN_ONLY,
      status: "review",
    }).sort(LEGACY_RUN_ORDER).lean();
    if (!current) return res.status(409).json({ status: "error", message: "Bang luong phai duoc duyet truoc khi chot." });
    let effectiveSnapshot = current.effectiveSnapshot;
    try {
      if (!effectiveSnapshot) {
        effectiveSnapshot = await createEffectivePayrollSnapshot(scope, current);
      } else if (!await verifyEffectivePayrollSnapshot(scope, current)) {
        return res.status(409).json({
          status: "error",
          code: "PAYROLL_EFFECTIVE_CHECKSUM_MISMATCH",
          message: "Pinned effective payroll snapshot is invalid",
        });
      }
    } catch (error) {
      return operationFailure(res, error);
    }
    const revisionChecksum = effectiveSnapshot.checksum;
    const employeeIds = [
      ...new Set((effectiveSnapshot.lines ?? []).map((line: any) => String(line.employeeId))),
    ];
    try {
      const run = await runPayrollAtomicTransaction(async (session) => {
        const closedRun = await PayrollRunModel.findOneAndUpdate(
          {
            _id: current._id,
            ...legacyRegularRunFilter(req),
            ...LEGACY_RUN_ONLY,
            status: "review",
            version: Number(current.version ?? 0),
          },
          { $set: { status: "closed", closedBy: req.user!.id, closedAt: new Date(), effectiveSnapshot } },
          { new: true, ...(session ? { session } : {}) },
        );
        if (!closedRun) return null;
        // Mongo transactions require sequential operations on one session.
        for (const employeeId of employeeIds) {
          await PayslipPublicationModel.findOneAndUpdate(
            { ...scope, runId: String(closedRun._id), employeeId },
            { $set: { ...scope, runId: String(closedRun._id), employeeId, revisionChecksum, status: "published", publishedBy: req.user!.id, publishedAt: new Date() } },
            {
              upsert: true,
              new: true,
              setDefaultsOnInsert: true,
              ...(session ? { session } : {}),
            },
          );
        }
        return closedRun;
      });
      if (!run) return res.status(409).json({ status: "error", message: "Bang luong phai duoc duyet truoc khi chot." });
      return res.json({ status: "success", data: run });
    } catch (error) {
      return operationFailure(res, error);
    }
  },  async resetPeriod(req: AuthenticatedRequest, res: Response) {
    const scope = operationalScope(req);
    if (!scope) return validationFailure(res, "Authenticated company and branch are required");
    try {
      const result = await resetPayrollPeriod(scope, req.params.periodKey, req.user!.id);
      return res.json({ status: "success", deleted: result.deleted });
    } catch (error) {
      return operationFailure(res, error);
    }
  },  async getLineDetail(req: AuthenticatedRequest, res: Response) {
    const scope = operationalScope(req);
    if (!scope) return validationFailure(res, "Authenticated company and branch are required");
    const permissions = await getEffectivePermissions(req.user!.id, req.user!.role, tenant(req));
    const canReadAny = permissions.has("*") || permissions.has("payroll-payment:read") || permissions.has("payroll-payment:manage");
    if (!canReadAny && req.user!.id !== req.params.employeeId) {
      return res.status(403).json({
        status: "error",
        code: "PAYROLL_PERMISSION_DENIED",
        message: "You can only view your own payroll line",
      });
    }
    const run = await PayrollRunModel.findOne({ _id: req.params.id, ...scope }).lean();
    if (!run) return res.status(404).json({ status: "error", code: "PAYROLL_RUN_NOT_FOUND", message: "Payroll run not found" });
    let effective;
    try {
      effective = await loadAuthoritativePayrollLines(scope, run);
    } catch (error) {
      return operationFailure(res, error);
    }
    const effectiveLine = effective.effectiveLines.find(
      (item: any) => String(item.employeeId) === req.params.employeeId,
    );
    if (!effectiveLine) return res.status(404).json({ status: "error", code: "PAYROLL_LINE_NOT_FOUND", message: "Payroll line not found" });
    if (!canReadAny) {
      const publication = await PayslipPublicationModel.findOne({
        ...scope,
        runId: req.params.id,
        employeeId: req.params.employeeId,
        status: "published",
      }).lean();
      if (
        !publication
        || !["closed", "paid"].includes(run.status)
        || !publicationMatchesEffectivePayroll(publication.revisionChecksum, run, effective)
      ) {
        return res.status(404).json({ status: "error", code: "PAYSLIP_NOT_PUBLISHED" });
      }
    }
    return res.json({ status: "success", data: effectiveLine });
  },  async getRun(req: AuthenticatedRequest, res: Response) {
    let data = await PayrollRunModel.findOne(legacyRegularRunFilter(req)).sort(LEGACY_RUN_ORDER).lean();
    if (!data) return res.status(404).json({
      status: "error",
      code: "PAYROLL_RUN_NOT_FOUND",
      message: "Không tìm thấy bảng lương.",
    });
    try {
      const effective = await loadAuthoritativePayrollLines(
        { companyCode: tenant(req), branchId: req.user?.branchId || "" },
        data,
      );
      const publications = ["closed", "paid"].includes(data.status)
        ? await PayslipPublicationModel.find({
            companyCode: tenant(req),
            branchId: req.user?.branchId || "",
            runId: String(data._id),
            status: "published",
          }).select("employeeId revisionChecksum").lean()
        : [];
      (data as any).publishedEmployeeIds = publications
        .filter((publication) => publicationMatchesEffectivePayroll(
          publication.revisionChecksum,
          data,
          effective,
        ))
        .map((publication) => publication.employeeId);
      (data as any).lines = effective.sourceLines;
      if (effective.sourceTotals !== undefined) (data as any).totals = effective.sourceTotals;
      (data as any).effectiveLines = effective.effectiveLines;
      (data as any).effectiveChecksum = effective.effectiveChecksum;
    } catch (error) {
      const effectiveError = error as Error & { code?: string };
      if (data.status === "review" && effectiveError.code === "PAYROLL_EFFECTIVE_CHECKSUM_MISMATCH") {
        try {
          data = await repairReviewEffectivePayrollSnapshot(
            { companyCode: tenant(req), branchId: req.user?.branchId || "" },
            String(data._id),
            req.user!.id,
            Number(data.version ?? 0),
            req.headers?.["x-correlation-id"] as string | undefined,
          );
          const repairedEffective = await loadAuthoritativePayrollLines(
            { companyCode: tenant(req), branchId: req.user?.branchId || "" },
            data,
          );
          (data as any).publishedEmployeeIds = [];
          (data as any).lines = repairedEffective.sourceLines;
          if (repairedEffective.sourceTotals !== undefined) (data as any).totals = repairedEffective.sourceTotals;
          (data as any).effectiveLines = repairedEffective.effectiveLines;
          (data as any).effectiveChecksum = repairedEffective.effectiveChecksum;
          return res.json({ status: "success", data });
        } catch (repairError) {
          const failedRepair = repairError as Error & { code?: string };
          (data as any).effectiveError = {
            code: failedRepair.code ?? "PAYROLL_EFFECTIVE_UNAVAILABLE",
            message: failedRepair.message ?? "Unable to repair pinned payroll results",
          };
          return res.json({ status: "success", data });
        }
      }
      const degradedData = data as typeof data & {
        effectiveError?: { code: string; message: string };
      };
      degradedData.effectiveError = {
        code: effectiveError.code ?? "PAYROLL_EFFECTIVE_UNAVAILABLE",
        message: effectiveError.message ?? "Không đọc được số liệu đã ghim của kỳ lương",
      };
    }
    return res.json({ status: "success", data });
  },
};



