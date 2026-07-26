import type { Response } from "express";
import { AttendancePeriodResultModel } from "../model/attendance-period-result.model";
import { TimekeepingLogModel } from "../model/timekeeping.model";
import { HRLeaveApplicationModel } from "../model/hr-leave-application.model";
import { summarizeAttendanceForPayroll } from "../service/attendance-payroll.service";
import { UserModel } from "../model/user.model";
import { CompanyModel } from "../model/company.model";
import { PayrollRunModel } from "../model/payroll-run.model";
import { PayrollAdjustmentModel } from "../model/payroll-adjustment.model";
import { PayrollAuditModel } from "../model/payroll-audit.model";
import { calculatePayroll } from "../service/payroll-calculation.service";
import type { AuthenticatedRequest } from "../middleware/auth";
import { getEffectivePermissions } from "../middleware/auth";

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
const countStandardDays = (period: string, workingDays: number[]) => {
  const [year, month] = period.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  let count = 0;
  for (let day = 1; day <= daysInMonth; day += 1) {
    if (workingDays.includes(new Date(Date.UTC(year, month - 1, day)).getUTCDay())) count += 1;
  }
  return count;
};
const canManagePayroll = async (req: AuthenticatedRequest) => {
  const { id: userId, role, companyCode } = req.user!;
  const permissions = await getEffectivePermissions(userId, role, companyCode);
  return permissions.has("*") || permissions.has("payroll:manage");
};
const audit = (req: AuthenticatedRequest, periodKey: string, action: any, metadata?: Record<string, unknown>) => PayrollAuditModel.create({ companyCode: tenant(req), periodKey, action, actorId: req.user!.id, metadata });

export const payrollController = {
  async createSnapshot(req: AuthenticatedRequest, res: Response) {
    const requestedEmployees = req.body?.employees as { employeeId: string; employeeName?: string; monthlySalary: number }[] | undefined;
    const company = await CompanyModel.findOne({ code: tenant(req) }).select("locationConfig").lean();
    const companyWorkingDays = Array.isArray(company?.locationConfig?.workingDays) && company.locationConfig.workingDays.length ? company.locationConfig.workingDays : [1, 2, 3, 4, 5];
    const companyDailyMinutes = computeStandardDailyMinutes(company?.locationConfig?.checkInLimit, company?.locationConfig?.checkOutLimit, company?.locationConfig?.lunchBreakStart, company?.locationConfig?.lunchBreakEnd);
    const employees = requestedEmployees?.length
      ? requestedEmployees.map((employee) => ({ ...employee, workingDays: companyWorkingDays, standardDailyMinutes: companyDailyMinutes, checkInLimit: company?.locationConfig?.checkInLimit || "08:30", checkOutLimit: company?.locationConfig?.checkOutLimit || "17:30", lunchBreakStart: company?.locationConfig?.lunchBreakStart, lunchBreakEnd: company?.locationConfig?.lunchBreakEnd }))
      : (await UserModel.find({ companyCode: tenant(req), isActive: { $ne: false }, monthlySalary: { $gte: 0 } }).select("_id displayName monthlySalary workHoursConfig").lean()).map((user) => {
          const standardDailyMinutes = user.workHoursConfig?.useCustom
            ? computeStandardDailyMinutes(user.workHoursConfig.checkInLimit, user.workHoursConfig.checkOutLimit, user.workHoursConfig.lunchBreakStart, user.workHoursConfig.lunchBreakEnd)
            : companyDailyMinutes;
          return {
            employeeId: String(user._id),
            employeeName: user.displayName,
            monthlySalary: user.monthlySalary || 0,
            workingDays: user.workHoursConfig?.useCustom && Array.isArray(user.workHoursConfig.workingDays) && user.workHoursConfig.workingDays.length ? user.workHoursConfig.workingDays : companyWorkingDays,
            standardDailyMinutes,
            checkInLimit: user.workHoursConfig?.useCustom ? user.workHoursConfig.checkInLimit : company?.locationConfig?.checkInLimit || "08:30",
            checkOutLimit: user.workHoursConfig?.useCustom ? user.workHoursConfig.checkOutLimit : company?.locationConfig?.checkOutLimit || "17:30",
            lunchBreakStart: user.workHoursConfig?.useCustom ? user.workHoursConfig.lunchBreakStart : company?.locationConfig?.lunchBreakStart,
            lunchBreakEnd: user.workHoursConfig?.useCustom ? user.workHoursConfig.lunchBreakEnd : company?.locationConfig?.lunchBreakEnd,
          };
        });
    if (!employees.length) return res.status(400).json({ status: "error", message: "Chua c� nh�n vi�n du?c c?u h�nh luong." });
    const period = req.params.periodKey;
    if (!/^\d{4}-\d{2}$/.test(period)) return res.status(400).json({ status: "error", message: "Ky luong phai co dang YYYY-MM." });
    const start = `${period}-01`; const endDate = new Date(Number(period.slice(0, 4)), Number(period.slice(5, 7)), 0); const end = `${period}-${String(endDate.getDate()).padStart(2, "0")}`;
    const logs = await TimekeepingLogModel.find({ companyCode: tenant(req), date: { $gte: start, $lte: end } }).lean();
    const leaves = await HRLeaveApplicationModel.find({ companyCode: tenant(req), status: "approved", startDate: { $lte: new Date(`${end}T23:59:59`) }, endDate: { $gte: new Date(`${start}T00:00:00`) } }).lean();
    const results = [];
    for (const employee of employees) {
      const standardDays = countStandardDays(period, employee.workingDays);
      const standardHours = (employee.standardDailyMinutes * standardDays) / 60;
      const employeeLogs = logs.filter((log) => log.uid === employee.employeeId).map((log) => ({ date: log.date, status: log.status, checkIn: log.checkIn?.time ? formatInPayrollTimeZone(log.checkIn.time, "time") : undefined, checkOut: log.checkOut?.time ? formatInPayrollTimeZone(log.checkOut.time, "time") : undefined }));
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
        const weekday = new Date(`${date}T00:00:00.000Z`).getUTCDay();
        if (!employee.workingDays.includes(weekday) || loggedDates.has(date)) continue;
        if (leaveDates.has(date)) { employeeLogs.push({ date, status: "Present", checkIn: employee.checkInLimit, checkOut: employee.checkOutLimit }); continue; }
        employeeLogs.push({ date, status: "Absent", checkIn: "", checkOut: "" });
      }
      const summary = summarizeAttendanceForPayroll({ standardDailyMinutes: employee.standardDailyMinutes, lunchBreakStart: employee.lunchBreakStart, lunchBreakEnd: employee.lunchBreakEnd, logs: employeeLogs, paidLeaves: [], overtime: [] });
      results.push(await AttendancePeriodResultModel.findOneAndUpdate({ companyCode: tenant(req), periodKey: period, employeeId: employee.employeeId }, { $set: { companyCode: tenant(req), periodKey: period, employeeId: employee.employeeId, employeeName: employee.employeeName || "", monthlySalary: employee.monthlySalary, standardHours, standardDays, shortageMinutes: summary.shortageMinutes, workedDays: summary.workedDays, shortageDays: summary.shortageDays, paidLeaveMinutesByRate: summary.paidLeaveMinutesByRate, overtime: summary.overtime, status: "draft" } }, { upsert: true, new: true, setDefaultsOnInsert: true }));
      console.log(`[payroll.snapshot] ${employee.employeeName} (${employee.employeeId}) rawLogsMatched=${logs.filter((log) => log.uid === employee.employeeId).length} totalLogsInPeriod=${logs.length} presentDays=${employeeLogs.filter((l) => l.status !== "Absent").length} absentGenerated=${employeeLogs.filter((l) => l.status === "Absent").length} standardDailyMinutes=${employee.standardDailyMinutes} workingDays=${JSON.stringify(employee.workingDays)} workedMinutes=${summary.workedMinutes} shortageMinutes=${summary.shortageMinutes}`);
    }
    await audit(req, period, "snapshot", { count: results.length });
    return res.status(201).json({ status: "success", data: results });
  },
  async listAudit(req: AuthenticatedRequest, res: Response) { const data = await PayrollAuditModel.find({ companyCode: tenant(req), periodKey: req.params.periodKey }).sort({ createdAt: -1 }).lean(); return res.json({ status: "success", data }); },
  async listResults(req: AuthenticatedRequest, res: Response) {
    if (!(await canManagePayroll(req))) {
      const run = await PayrollRunModel.findOne({ companyCode: tenant(req), periodKey: req.params.periodKey }).lean();
      if (!run) return res.json({ status: "success", data: [] });
    }
    const data = await AttendancePeriodResultModel.find({ companyCode: tenant(req), periodKey: req.params.periodKey }).lean();
    return res.json({ status: "success", data });
  },
  async lockResults(req: AuthenticatedRequest, res: Response) {
    const result = await AttendancePeriodResultModel.updateMany(
      { companyCode: tenant(req), periodKey: req.params.periodKey, status: "draft" },
      { $set: { status: "locked", lockedAt: new Date(), lockedBy: req.user!.id } },
    );
    await audit(req, req.params.periodKey, "lock", { count: result.modifiedCount });
    return res.json({ status: "success", lockedCount: result.modifiedCount });
  },
  async createRun(req: AuthenticatedRequest, res: Response) {
    const rows = await AttendancePeriodResultModel.find({ companyCode: tenant(req), periodKey: req.params.periodKey, status: "locked" }).lean();
    if (!rows.length) return res.status(409).json({ status: "error", message: "Chua co ket qua cong da khoa." });
    const existing = await PayrollRunModel.findOne({ companyCode: tenant(req), periodKey: req.params.periodKey });
    if (existing) return res.status(409).json({ status: "error", message: "Ky luong da ton tai." });
    const lines = rows.map((row) => ({
      employeeId: row.employeeId,
      calculation: { ...calculatePayroll({
        monthlySalary: row.monthlySalary,
        standardDays: row.standardDays,
        standardHours: row.standardHours,
        shortageMinutes: row.shortageMinutes,
        paidLeaveMinutesByRate: row.paidLeaveMinutesByRate,
        overtime: row.overtime,
        allowances: 0,
        bonuses: 0,
        deductions: 0,
        adjustments: 0,
      }) },
    }));
    const run = await PayrollRunModel.create({ companyCode: tenant(req), periodKey: req.params.periodKey, status: "calculated", createdBy: req.user!.id, lines });
    await audit(req, req.params.periodKey, "calculate", { lineCount: lines.length });
    return res.status(201).json({ status: "success", data: run });
  },
  async createAdjustment(req: AuthenticatedRequest, res: Response) {
    const { employeeId, kind, amount, reason } = req.body;
    if (!employeeId || !kind || !Number.isFinite(amount) || amount < 0 || !String(reason || "").trim()) return res.status(400).json({ status: "error", message: "Du lieu dieu chinh khong hop le." });
    const adjustment = await PayrollAdjustmentModel.create({ companyCode: tenant(req), periodKey: req.params.periodKey, employeeId, kind, amount, reason, createdBy: req.user!.id });
    return res.status(201).json({ status: "success", data: adjustment });
  },
  async approveAdjustment(req: AuthenticatedRequest, res: Response) {
    const adjustment = await PayrollAdjustmentModel.findOneAndUpdate(
      { _id: req.params.adjustmentId, companyCode: tenant(req), periodKey: req.params.periodKey, status: "pending" },
      { $set: { status: "approved", approvedBy: req.user!.id } },
      { new: true },
    );
    if (!adjustment) return res.status(409).json({ status: "error", message: "Dieu chinh khong ton tai hoac da duoc xu ly." });
    await audit(req, req.params.periodKey, "adjustment", { adjustmentId: String(adjustment._id) });
    return res.json({ status: "success", data: adjustment });
  },
  async approveRun(req: AuthenticatedRequest, res: Response) {
    const run = await PayrollRunModel.findOneAndUpdate(
      { companyCode: tenant(req), periodKey: req.params.periodKey, status: "calculated" },
      { $set: { status: "approved", approvedBy: req.user!.id } },
      { new: true },
    );
    if (!run) return res.status(409).json({ status: "error", message: "Bang luong khong o trang thai cho duyet." });
    return res.json({ status: "success", data: run });
  },
  async closeRun(req: AuthenticatedRequest, res: Response) {
    const run = await PayrollRunModel.findOneAndUpdate(
      { companyCode: tenant(req), periodKey: req.params.periodKey, status: "approved" },
      { $set: { status: "closed", closedBy: req.user!.id, closedAt: new Date() } },
      { new: true },
    );
    if (!run) return res.status(409).json({ status: "error", message: "Bang luong phai duoc duyet truoc khi chot." });
    return res.json({ status: "success", data: run });
  },  async resetPeriod(req: AuthenticatedRequest, res: Response) {
    const filter = { companyCode: tenant(req), periodKey: req.params.periodKey };
    const run = await PayrollRunModel.findOne(filter).lean();
    const [deletedRun, results, adjustments, audits] = await Promise.all([
      PayrollRunModel.deleteOne(filter),
      AttendancePeriodResultModel.deleteMany(filter),
      PayrollAdjustmentModel.deleteMany(filter),
      PayrollAuditModel.deleteMany(filter),
    ]);
    await audit(req, req.params.periodKey, "reset", { hadRun: Boolean(run), results: results.deletedCount, adjustments: adjustments.deletedCount, auditsRemoved: audits.deletedCount });
    return res.json({ status: "success", deleted: { run: deletedRun.deletedCount, results: results.deletedCount, adjustments: adjustments.deletedCount } });
  },  async getRun(req: AuthenticatedRequest, res: Response) {
    const data = await PayrollRunModel.findOne({ companyCode: tenant(req), periodKey: req.params.periodKey }).lean();
    if (!data) return res.status(404).json({ status: "error", message: "Khong tim thay bang luong." });
    return res.json({ status: "success", data });
  },
};
