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
import { PayrollCalculationRevisionModel } from "../model/payroll-calculation-revision.model";
import { PayrollPaymentModel } from "../model/payroll-payment.model";
import { PayslipPublicationModel } from "../model/payslip-publication.model";
import { PayrollExportJobModel } from "../model/payroll-export-job.model";
import { readPayrollLine } from "../service/payroll-line-read.service";
import { CompanyWorkCalendarDayModel } from "../model/company-work-calendar.model";
import { calculatePayroll } from "../service/payroll-calculation.service";
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
import { calculateOperationalRun } from "../service/payroll-run-calculate-operations.service";
import { createPayrollPayment, transitionPayrollPayment } from "../service/payroll-payment-operations.service";
import type { PayrollPaymentAction } from "../service/payroll-payment.service";
import {
  activatePayrollPolicy,
  createPayrollPolicy,
  listPayrollPolicies,
  retirePayrollPolicy,
} from "../service/payroll-policy-operations.service";
import { runPayrollWorkflowAction } from "../service/payroll-run-workflow-operations.service";
import { buildPayslip } from "../service/payroll-payslip.service";
import { buildPayrollWorkbook, workbookBuffer } from "../service/payroll-export.service";
import { calculatePayrollChecksum } from "../service/payroll-checksum.service";
import type { PayrollWorkflowAction } from "../service/payroll-run-workflow.service";
import {
  auditQuerySchema,
  calculateRunSchema,
  createOperationalRunSchema,
  createPaymentSchema,
  createPolicySchema,
  paymentTransitionSchema,
  rejectRunSchema,
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
  return permissions.has("*") || permissions.has("payroll:manage");
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
const operationalScope = (req: AuthenticatedRequest) => {
  const companyCode = tenant(req);
  const branchId = req.user?.branchId || "";
  return companyCode && branchId ? { companyCode, branchId } : null;
};
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
  const schema = action === "reject" ? rejectRunSchema : workflowTransitionSchema;
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
  if (error instanceof PayrollOperationError) {
    return res.status(error.status).json({
      status: "error",
      code: error.code,
      message: error.message,
      ...(error.currentVersion !== undefined ? { currentVersion: error.currentVersion } : {}),
    });
  }
  console.error("[payroll.operations] Unexpected error:", error);
  return res.status(500).json({ status: "error", code: "PAYROLL_OPERATION_FAILED", message: "Payroll operation failed" });
};

export const payrollController = {
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
    try {
      return res.json({ status: "success", data: await activatePayrollPolicy(tenant(req), req.params.id, req.user!.id) });
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
  reviewOperationalRun: workflowHandler("review"),
  approveOperationalRun: workflowHandler("approve"),
  rejectOperationalRun: workflowHandler("reject"),
  closeOperationalRun: workflowHandler("close"),
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
    if (!employees.length) return res.status(400).json({ status: "error", message: "ChÆ°a cÃ³ nhÃ¢n viÃªn Ä‘Æ°á»£c cáº¥u hÃ¬nh lÆ°Æ¡ng." });
    const start = `${period}-01`; const endDate = new Date(Number(period.slice(0, 4)), Number(period.slice(5, 7)), 0); const end = `${period}-${String(endDate.getDate()).padStart(2, "0")}`;
    const logs = await TimekeepingLogModel.find({ companyCode: tenant(req), branchId: periodScope.branchId, date: { $gte: start, $lte: end } }).lean();
    const calendarDays = await CompanyWorkCalendarDayModel.find({ companyCode: tenant(req), branchId: periodScope.branchId, date: { $gte: start, $lte: end }, isApplied: true }).lean();
    const calendarRules = new Map<string, any[]>();
    for (const rule of calendarDays) calendarRules.set(rule.date, [...(calendarRules.get(rule.date) || []), rule]);
    const leaves = await HRLeaveApplicationModel.find({ companyCode: tenant(req), branchId: periodScope.branchId, status: "approved", startDate: { $lte: new Date(`${end}T23:59:59`) }, endDate: { $gte: new Date(`${start}T00:00:00`) } }).lean();
    const today = formatInPayrollTimeZone(new Date(), "date");
    const results = [];
    for (const employee of employees) {
      const standardDays = countStandardDays(period, employee.workingDays, calendarRules);
      const standardHours = (employee.standardDailyMinutes * standardDays) / 60;
      const employeeLogs = logs
        .filter((log) => log.uid === employee.employeeId && evaluateWorkingDate(log.date, calendarRules.get(log.date) || [], employee.workingDays))
        .map((log) => ({ date: log.date, status: log.status, checkIn: log.checkIn?.time ? formatInPayrollTimeZone(log.checkIn.time, "time") : undefined, checkOut: log.checkOut?.time ? formatInPayrollTimeZone(log.checkOut.time, "time") : undefined }));
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
    if (stale) return res.status(409).json({ status: "error", message: "Lá»‹ch sá»­ cháº¥m cÃ´ng Ä‘Ã£ thay Ä‘á»•i. HÃ£y Ä‘á»“ng bá»™ cÃ´ng trÆ°á»›c khi khÃ³a." });
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
    if (rows.some((row) => row.needsRecalculation)) return res.status(409).json({ status: "error", message: "Dá»¯ liá»‡u cÃ´ng Ä‘Ã£ thay Ä‘á»•i. HÃ£y Ä‘á»“ng bá»™ vÃ  khÃ³a cÃ´ng láº¡i." });
    const existing = await PayrollRunModel.findOne(legacyRegularRunFilter(req)).sort(LEGACY_RUN_ORDER).lean();
    if (existing) return res.status(409).json({ status: "error", message: "Ky luong da ton tai." });
    const lines = rows.map((row) => ({
      employeeId: row.employeeId,
      calculation: { ...calculatePayroll({
        monthlySalary: row.monthlySalary,
        standardDays: row.standardDays,
        standardHours: row.standardHours,
        workedMinutes: row.workedMinutes ?? ((row.workedDays || 0) * row.standardHours * 60) / row.standardDays,
        shortageMinutes: row.shortageMinutes,
        paidLeaveMinutesByRate: row.paidLeaveMinutesByRate,
        overtime: row.overtime,
        allowances: 0,
        bonuses: 0,
        deductions: 0,
        adjustments: 0,
      }), workedMinutes: row.workedMinutes, workedDays: row.workedDays || 0, standardHours: row.standardHours, standardDays: row.standardDays },
    }));
    const run = await PayrollRunModel.create({ companyCode: tenant(req), branchId, periodKey: req.params.periodKey, type: "regular", status: "calculated", createdBy: req.user!.id, lines });
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
    if (!run || !run.activeRevisionId || !["closed", "partially_paid", "paid"].includes(run.status)) return res.status(409).json({ status: "error", code: "PAYROLL_RUN_NOT_CLOSED" });
    const revision = await PayrollCalculationRevisionModel.findOne({ _id: run.activeRevisionId, ...scope }).lean();
    if (!revision?.checksum || revision.checksum !== run.activeRevisionChecksum) return res.status(409).json({ status: "error", code: "PAYROLL_CHECKSUM_MISMATCH" });
    const employeeIds = Array.isArray(req.body?.employeeIds) ? req.body.employeeIds : revision.lines.map((line) => line.employeeId);
    const docs = await Promise.all(employeeIds.map((employeeId: string) => PayslipPublicationModel.findOneAndUpdate({ ...scope, runId: String(run._id), employeeId }, { $set: { ...scope, runId: String(run._id), employeeId, revisionChecksum: revision.checksum, status: "published", publishedBy: req.user!.id, publishedAt: new Date() } }, { upsert: true, new: true, setDefaultsOnInsert: true })));
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
    const data = await Promise.all(publications.map(async (publication) => { const run = await PayrollRunModel.findOne({ _id: publication.runId, ...scope }).lean(); const revision = run?.activeRevisionId ? await PayrollCalculationRevisionModel.findOne({ _id: run.activeRevisionId, ...scope }).lean() : null; const line = revision?.lines.find((item) => item.employeeId === req.user!.id); return run && line ? buildPayslip(run, line, await PayrollPaymentModel.find({ ...scope, runId: publication.runId }).lean() as any) : null; }));
    return res.json({ status: "success", data: data.filter(Boolean) });
  },
  async printPayslip(req: AuthenticatedRequest, res: Response) {
    const scope = operationalScope(req); if (!scope) return validationFailure(res, "Authenticated company and branch are required");
    const publication = await PayslipPublicationModel.findOne({ ...scope, runId: req.params.id, employeeId: req.params.employeeId, status: "published" }).lean();
    if (!publication) return res.status(404).json({ status: "error", code: "PAYSLIP_NOT_PUBLISHED" });
    const run = await PayrollRunModel.findOne({ _id: req.params.id, ...scope }).lean(); const revision = run?.activeRevisionId ? await PayrollCalculationRevisionModel.findOne({ _id: run.activeRevisionId, ...scope }).lean() : null; const line = revision?.lines.find((item) => item.employeeId === req.params.employeeId);
    if (!run || !revision || !line || revision.checksum !== publication.revisionChecksum || revision.checksum !== run.activeRevisionChecksum) return res.status(409).json({ status: "error", code: "PAYROLL_CHECKSUM_MISMATCH" });
    const payslip = buildPayslip(run, line, await PayrollPaymentModel.find({ ...scope, runId: req.params.id }).lean() as any);
    const esc = (value: unknown) => String(value ?? "").replace(/[&<>\"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[char] || char));
    res.type("html").set("Content-Disposition", `inline; filename=payslip-${run.periodKey}-${payslip.employeeId}.html`); return res.send(`<!doctype html><html><head><meta charset="utf-8"><title>Payslip ${esc(run.periodKey)}</title><style>body{font:14px Arial;max-width:760px;margin:40px auto;color:#172033}h1{font-size:24px;border-bottom:2px solid #172033;padding-bottom:12px}.row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #ddd}.total{font-size:18px;font-weight:bold}@media print{body{margin:0}}</style></head><body><h1>Payslip ${esc(run.periodKey)}</h1><div class="row"><b>Employee</b><span>${esc(payslip.employeeName || payslip.employeeId)}</span></div><div class="row"><b>Gross pay</b><span>${payslip.calculation.gross ?? 0}</span></div><div class="row"><b>Deductions</b><span>${payslip.calculation.deductions ?? 0}</span></div><div class="row total"><b>Net pay</b><span>${payslip.netPay}</span></div><div class="row"><b>Paid</b><span>${payslip.paidAmount}</span></div><div class="row"><b>Balance</b><span>${payslip.balance}</span></div><p>Checksum: ${esc(payslip.checksum)}</p><script>window.print()</script></body></html>`);
  },  async exportPayroll(req: AuthenticatedRequest, res: Response) {
    const scope = operationalScope(req); if (!scope) return validationFailure(res, "Authenticated company and branch are required");
    const type = req.body?.type; if (!["detailed", "insurance", "pit", "bank_transfer"].includes(type)) return validationFailure(res, "Invalid export type");
    if (type === "bank_transfer") { const permissions = await getEffectivePermissions(req.user!.id, req.user!.role, tenant(req)); if (!permissions.has("*") && !permissions.has("payroll:pay")) return res.status(403).json({ status: "error", code: "PAYROLL_PERMISSION_DENIED", message: "Bank transfer export requires payroll:pay" }); }
    const run = await PayrollRunModel.findOne({ _id: req.params.id, ...scope }).lean(); const revision = run?.activeRevisionId ? await PayrollCalculationRevisionModel.findOne({ _id: run.activeRevisionId, ...scope }).lean() : null;
    if (!run || !revision || !["closed", "partially_paid", "paid"].includes(run.status)) return res.status(409).json({ status: "error", code: "PAYROLL_RUN_NOT_CLOSED" });
    if (revision.checksum !== run.activeRevisionChecksum) return res.status(409).json({ status: "error", code: "PAYROLL_CHECKSUM_MISMATCH" });
    const buffer = workbookBuffer(buildPayrollWorkbook(type, revision.lines)); const checksum = calculatePayrollChecksum(buffer.toString("base64"));
    const job = await PayrollExportJobModel.create({ ...scope, runId: String(run._id), type, revisionChecksum: revision.checksum, status: "completed", createdBy: req.user!.id, output: { contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", size: buffer.length, checksum }, completedAt: new Date() });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"); res.setHeader("Content-Disposition", `attachment; filename=payroll-${run.periodKey}-${type}.xlsx`); return res.send(buffer);
  },  async listAdjustments(req: AuthenticatedRequest, res: Response) {
    const data = await PayrollAdjustmentModel.find(legacyPeriodScope(req)).sort({ createdAt: -1 }).lean();
    return res.json({ status: "success", data });
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
    await audit(req, req.params.periodKey, "adjustment_rejected", { adjustmentId: String(adjustment._id) });
    return res.json({ status: "success", data: adjustment });
  },  async approveRun(req: AuthenticatedRequest, res: Response) {
    if (await hasRevisionBackedRun(req)) return revisionBackedRunFailure(res);
    const run = await PayrollRunModel.findOneAndUpdate(
      { ...legacyRegularRunFilter(req), ...LEGACY_RUN_ONLY, status: "calculated" },
      { $set: { status: "approved", approvedBy: req.user!.id }, $inc: { version: 1 } },
      { new: true, sort: LEGACY_RUN_ORDER },
    );
    if (!run) return res.status(409).json({ status: "error", message: "Bang luong khong o trang thai cho duyet." });
    return res.json({ status: "success", data: run });
  },
  async closeRun(req: AuthenticatedRequest, res: Response) {
    if (await hasRevisionBackedRun(req)) return revisionBackedRunFailure(res);
    const run = await PayrollRunModel.findOneAndUpdate(
      { ...legacyRegularRunFilter(req), ...LEGACY_RUN_ONLY, status: "approved" },
      { $set: { status: "closed", closedBy: req.user!.id, closedAt: new Date() } },
      { new: true, sort: LEGACY_RUN_ORDER },
    );
    if (!run) return res.status(409).json({ status: "error", message: "Bang luong phai duoc duyet truoc khi chot." });
    return res.json({ status: "success", data: run });
  },  async resetPeriod(req: AuthenticatedRequest, res: Response) {
    const periodFilter = legacyPeriodScope(req);
    const runFilter = legacyRegularRunFilter(req);
    const run = await PayrollRunModel.findOne(runFilter).sort(LEGACY_RUN_ORDER).lean();
    const [deletedRun, results, adjustments, audits] = await Promise.all([
      run ? PayrollRunModel.deleteOne({ _id: run._id, ...runFilter }) : Promise.resolve({ deletedCount: 0 }),
      AttendancePeriodResultModel.deleteMany(periodFilter),
      PayrollAdjustmentModel.deleteMany(periodFilter),
      PayrollAuditModel.deleteMany(periodFilter),
    ]);
    await audit(req, req.params.periodKey, "reset", { hadRun: Boolean(run), results: results.deletedCount, adjustments: adjustments.deletedCount, auditsRemoved: audits.deletedCount });
    return res.json({ status: "success", deleted: { run: deletedRun.deletedCount, results: results.deletedCount, adjustments: adjustments.deletedCount } });
  },  async getLineDetail(req: AuthenticatedRequest, res: Response) {
    const scope = operationalScope(req);
    if (!scope) return validationFailure(res, "Authenticated company and branch are required");
    const run = await PayrollRunModel.findOne({ _id: req.params.id, ...scope }).lean();
    if (!run) return res.status(404).json({ status: "error", code: "PAYROLL_RUN_NOT_FOUND", message: "Payroll run not found" });
    const line = await readPayrollLine({
      run,
      employeeId: req.params.employeeId,
      revision: { getLine: async (revisionId, employeeId) => {
        const revision = await PayrollCalculationRevisionModel.findOne({ _id: revisionId, ...scope }).lean();
        return revision?.lines?.find((item: any) => item.employeeId === employeeId) as any;
      } },
    });
    if (!line) return res.status(404).json({ status: "error", code: "PAYROLL_LINE_NOT_FOUND", message: "Payroll line not found" });
    return res.json({ status: "success", data: line });
  },  async getRun(req: AuthenticatedRequest, res: Response) {
    const data = await PayrollRunModel.findOne(legacyRegularRunFilter(req)).sort(LEGACY_RUN_ORDER).lean();
    if (!data) return res.status(404).json({ status: "error", message: "Khong tim thay bang luong." });
    return res.json({ status: "success", data });
  },
};



