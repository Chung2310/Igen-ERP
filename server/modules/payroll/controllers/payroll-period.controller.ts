import type { Response } from "express";
import { AttendancePeriodResultModel } from "../../../model/attendance-period-result.model";
import { TimekeepingLogModel } from "../../../model/timekeeping.model";
import { HRLeaveApplicationModel } from "../../../model/hr-leave-application.model";
import { summarizeAttendanceForPayroll } from "../services/attendance-payroll.service";
import { resolveShift } from "../../../service/work-shift.service";
import { UserModel } from "../../../model/user.model";
import { CompanyModel } from "../../../model/company.model";
import { PayrollRunModel } from "../models/payroll-run.model";
import { PayrollAdjustmentModel } from "../models/payroll-adjustment.model";
import { PayrollAuditModel } from "../models/payroll-audit.model";
import { PayslipPublicationModel } from "../../../model/payslip-publication.model";
import { CompanyWorkCalendarDayModel } from "../../../model/company-work-calendar.model";
import { calculatePayroll } from "../services/payroll-calculation.service";
import { calculateVietnamPayroll } from "../services/payroll-vietnam.service";
import { resolvePersistedPayrollPolicy } from "../config/payroll-default-policy";
import { PayrollPolicyModel } from "../models/payroll-policy.model";
import { PayrollFormulaModel } from "../models/payroll-formula.model";
import { evaluatePayrollFormulas } from "../services/payroll-formula-engine.service";
import { PAYROLL_FORMULA_LIBRARY_ENABLED, emptyPayrollFormulaLibraryResult } from "../../../../src/config/payrollFeatureFlags";
import { PayrollPeriodInputModel } from "../models/payroll-period-input.model";
import { PayrollCustomVariableModel } from "../models/payroll-custom-variable.model";
import { resolvePayrollPeriodInputs } from "../services/payroll-period-input-resolver.service";
import { PayrollDependentModel, PayrollProfileModel } from "../models/payroll-profile.model";
import { countDependents, resolveTaxMethod, selectProfileForPeriod } from "../services/payroll-employee-input.service";
import { evaluateWorkingDate } from "../../../service/company-work-calendar.service";
import type { AuthenticatedRequest } from "../../../middleware/auth";
import { getEffectivePermissions } from "../../../middleware/auth";
import { projectPayrollLinesWithStoredOverrides } from "../services/payroll-run-calculate-operations.service";
import {
  createEffectivePayrollSnapshot,
  loadAuthoritativePayrollLines,
  verifyEffectivePayrollSnapshot,
} from "../services/payroll-effective-line.service";
import { repairReviewEffectivePayrollSnapshot } from "../services/payroll-effective-snapshot-repair.service";
import { PayrollPeriodProcessingError, processPayrollPeriod } from "../services/payroll-period-processing.service";
import { resetPayrollPeriod } from "../services/payroll-period-reset.service";
import { runPayrollAtomicTransaction } from "../services/payroll-transaction.service";
import {
  tenant,
  legacyPeriodScope,
  legacyRegularRunFilter,
  LEGACY_RUN_ORDER,
  LEGACY_RUN_ONLY,
  runPayrollControllerStep,
  hasRevisionBackedRun,
  revisionBackedRunFailure,
  audit,
  snapshotPayrollPayment,
  operationalScope,
  validationFailure,
  operationFailure,
  canManagePayroll,
  formatInPayrollTimeZone,
  normalizePayrollLogDate,
  computeStandardDailyMinutes,
  countStandardDays,
  publicationMatchesEffectivePayroll,
  runWithEffectiveChecksum,
} from "./shared";

async function processPeriod(req: AuthenticatedRequest, res: Response) {
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
      syncAttendance: () => runPayrollControllerStep(createSnapshot, req),
      lockAttendance: () => runPayrollControllerStep(lockResults, req),
      calculatePayroll: () => runPayrollControllerStep(createRun, req),
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
}

async function createSnapshot(req: AuthenticatedRequest, res: Response) {
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
    results.push(await AttendancePeriodResultModel.findOneAndUpdate({ ...periodScope, employeeId: employee.employeeId }, { $set: { ...periodScope, employeeId: employee.employeeId, employeeName: employee.employeeName || "", monthlySalary: employee.monthlySalary, standardHours, standardDays, workedMinutes: summary.workedMinutes, shortageMinutes: summary.shortageMinutes, workedDays: summary.workedDays, shortageDays: summary.shortageDays, paidLeaveMinutesByRate: summary.paidLeaveMinutesByRate, overtime: summary.overtime, status: "draft", needsRecalculation: false } }, { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }));
    console.log(`[payroll.snapshot] ${employee.employeeName} (${employee.employeeId}) rawLogsMatched=${logs.filter((log) => log.uid === employee.employeeId).length} totalLogsInPeriod=${logs.length} presentDays=${employeeLogs.filter((l) => l.status !== "Absent").length} absentGenerated=${employeeLogs.filter((l) => l.status === "Absent").length} standardDailyMinutes=${employee.standardDailyMinutes} workingDays=${JSON.stringify(employee.workingDays)} workedMinutes=${summary.workedMinutes} shortageMinutes=${summary.shortageMinutes}`);
  }
  await audit(req, period, "snapshot", { count: results.length });
  return res.status(201).json({ status: "success", data: results });
}

async function listAudit(req: AuthenticatedRequest, res: Response) { const data = await PayrollAuditModel.find(legacyPeriodScope(req)).sort({ createdAt: -1 }).lean(); return res.json({ status: "success", data }); }

async function listResults(req: AuthenticatedRequest, res: Response) {
  if (!(await canManagePayroll(req))) {
    const run = await PayrollRunModel.findOne(legacyRegularRunFilter(req)).sort(LEGACY_RUN_ORDER).lean();
    if (!run) return res.json({ status: "success", data: [] });
  }
  const data = await AttendancePeriodResultModel.find(legacyPeriodScope(req)).lean();
  return res.json({ status: "success", data });
}

async function lockResults(req: AuthenticatedRequest, res: Response) {
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
}

async function createRun(req: AuthenticatedRequest, res: Response) {
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
      { returnDocument: 'after' },
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
}

async function resetPeriod(req: AuthenticatedRequest, res: Response) {
  const scope = operationalScope(req);
  if (!scope) return validationFailure(res, "Authenticated company and branch are required");
  try {
    const result = await resetPayrollPeriod(scope, req.params.periodKey, req.user!.id);
    return res.json({ status: "success", deleted: result.deleted });
  } catch (error) {
    return operationFailure(res, error);
  }
}

async function approveRun(req: AuthenticatedRequest, res: Response) {
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
    { returnDocument: 'after' },
  );
  if (!run) return res.status(409).json({ status: "error", message: "Bang luong khong o trang thai cho duyet." });

  return res.json({ status: "success", data: run });
}

async function closeRun(req: AuthenticatedRequest, res: Response) {
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
        { returnDocument: 'after', ...(session ? { session } : {}) },
      );
      if (!closedRun) return null;
      // Mongo transactions require sequential operations on one session.
      for (const employeeId of employeeIds) {
        await PayslipPublicationModel.findOneAndUpdate(
          { ...scope, runId: String(closedRun._id), employeeId },
          { $set: { ...scope, runId: String(closedRun._id), employeeId, revisionChecksum, status: "published", publishedBy: req.user!.id, publishedAt: new Date() } },
          {
            upsert: true,
            returnDocument: 'after',
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
}

async function getLineDetail(req: AuthenticatedRequest, res: Response) {
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
}

async function getRun(req: AuthenticatedRequest, res: Response) {
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
}

export const payrollPeriodController = {
  processPeriod,
  createSnapshot,
  listAudit,
  listResults,
  lockResults,
  createRun,
  resetPeriod,
  approveRun,
  closeRun,
  getLineDetail,
  getRun,
};
