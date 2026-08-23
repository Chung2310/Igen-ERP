import type { Response } from "express";
import type { AuthenticatedRequest } from "../../../middleware/auth";
import { UserModel } from "../../../model/user.model";
import { AttendancePeriodResultModel } from "../../../model/attendance-period-result.model";
import { PayrollRunModel } from "../models/payroll-run.model";
import { PayrollAdjustmentModel } from "../models/payroll-adjustment.model";
import { PayrollPolicyModel } from "../models/payroll-policy.model";
import { PayrollDependentModel, PayrollProfileModel } from "../models/payroll-profile.model";
import { calculatePayroll } from "../services/payroll-calculation.service";
import { calculateVietnamPayroll } from "../services/payroll-vietnam.service";
import { resolvePersistedPayrollPolicy } from "../config/payroll-default-policy";
import { countDependents, resolveTaxMethod, selectProfileForPeriod } from "../services/payroll-employee-input.service";
import { PayrollOperationError } from "../services/payroll-run-operations.service";
import {
  legacyPeriodScope,
  legacyRegularRunFilter,
  LEGACY_RUN_ORDER,
  LEGACY_RUN_ONLY,
  snapshotPayrollPayment,
  audit,
} from "./shared";

export const payrollAdjustmentController = {
  async listAdjustments(req: AuthenticatedRequest, res: Response) {
    const data = await PayrollAdjustmentModel.find(legacyPeriodScope(req)).sort({ createdAt: -1 }).lean();
    const employeeIds = Array.from(new Set(data.map((item) => item.employeeId)));
    const users = await UserModel.find({ _id: { $in: employeeIds } }).select("displayName email").lean();
    const userMap = new Map(users.map((u) => [String(u._id), u.displayName || u.email]));
    const enriched = data.map((item) => ({
      ...item,
      employeeName: userMap.get(item.employeeId) || item.employeeId,
    }));
    return res.json({ status: "success", data: enriched });
  },
  async createAdjustment(req: AuthenticatedRequest, res: Response) {
    const { employeeId, kind, amount, reason } = req.body;
    if (!employeeId || !kind || !Number.isFinite(amount) || amount < 0 || !String(reason || "").trim()) return res.status(400).json({ status: "error", message: "Du lieu dieu chinh khong hop le." });
    const adjustment = await PayrollAdjustmentModel.create({ ...legacyPeriodScope(req), employeeId, kind, amount, reason, createdBy: req.user!.id });
    return res.status(201).json({ status: "success", data: adjustment });
  },
  async approveAdjustment(req: AuthenticatedRequest, res: Response) {
    const adjustment = await PayrollAdjustmentModel.findOneAndUpdate(
      { _id: req.params.adjustmentId, ...legacyPeriodScope(req), status: "pending" },
      { $set: { status: "approved", approvedBy: req.user!.id }, $inc: { version: 1 } },
      { returnDocument: 'after' },
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
            { returnDocument: 'after' },
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
      { returnDocument: 'after' },
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
            { returnDocument: 'after' },
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
  },
};
