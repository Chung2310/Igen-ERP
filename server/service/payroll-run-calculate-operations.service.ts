import { HRContractModel } from "../model/hr-contract.model";
import { PayrollAttendanceSnapshotModel } from "../model/payroll-attendance-snapshot.model";
import { PayrollPolicyModel } from "../model/payroll-policy.model";
import mongoose from "mongoose";
import { PayrollFormulaModel } from "../model/payroll-formula.model";
import { evaluatePayrollFormulas } from "./payroll-formula-engine.service";
import { PAYROLL_FORMULA_LIBRARY_ENABLED, emptyPayrollFormulaLibraryResult } from "../../src/config/payrollFeatureFlags";
import { PayrollPeriodInputModel } from "../model/payroll-period-input.model";
import { PayrollCustomVariableModel } from "../model/payroll-custom-variable.model";
import { resolvePayrollPeriodInputs } from "./payroll-period-input-resolver.service";
import { PayrollDependentModel, PayrollProfileModel } from "../model/payroll-profile.model";
import {
  countDependents,
  profileWarnings,
  resolveEmployeeSalaryTerms,
  resolveInsuranceSalary,
  resolveTaxMethod,
  selectProfileForPeriod,
} from "./payroll-employee-input.service";
import { resolvePersistedPayrollPolicy } from "../config/payroll-default-policy";
import { PayrollAdjustmentModel } from "../model/payroll-adjustment.model";
import { PayrollAuditModel } from "../model/payroll-audit.model";
import { PayrollRunModel } from "../model/payroll-run.model";
import { PayrollLineOverrideModel } from "../model/payroll-line-override.model";
import { UserModel } from "../model/user.model";
import { resolveDetailedPayrollInput } from "./payroll-effective-input.service";
import { calculateRun, type DetailedCalculationInput } from "./payroll-run-calculation.service";
import { createPayrollRevisionRepositories } from "./payroll-revision.repository";
import { PayrollOperationError, type PayrollOperationScope } from "./payroll-run-operations.service";
import { PAYROLL_LINE_OVERRIDE_FIELDS, type PayrollLineOverrideValues, type PayrollLineSystemValues } from "../interface/payroll-line-override.interface";
import { resolvePayrollLineOverride } from "./payroll-line-override-resolver.service";

const isoDate = (value: Date | string) => new Date(value).toISOString().slice(0, 10);

const amount = (value: unknown) => {
  const normalized = Number(value ?? 0);
  return Number.isFinite(normalized) ? normalized : 0;
};

const insuranceFundAmount = (vietnam: any, code: string) => {
  const funds = Array.isArray(vietnam?.insurance?.funds) ? vietnam.insurance.funds : [];
  return amount(funds.find((fund: any) => fund.code === code)?.employeeAmount);
};

/** Adapts an immutable calculation snapshot to the manual-override component contract. */
export function normalizePayrollLineSystemValues(line: any): PayrollLineSystemValues {
  const calculation = line?.calculation ?? {};
  const vietnam = line?.vietnam ?? calculation.vietnam ?? {};
  const adjustments = amount(calculation.adjustments);
  const adjustedBase = amount(calculation.adjustedBase);
  const overtime = amount(calculation.overtime);
  const bonusTotal = amount(
    calculation.bonusTotal
      ?? vietnam?.income?.bonuses
      ?? (amount(calculation.bonuses) + Math.max(adjustments, 0)),
  );
  const penaltyTotal = amount(calculation.penaltyTotal ?? Math.max(-adjustments, 0));
  const gross = amount(calculation.gross ?? vietnam?.income?.totalIncome);
  const otherDeductions = amount(
    calculation.otherDeductions
      ?? Math.max(0, amount(vietnam?.deductions?.other) - penaltyTotal),
  );

  return {
    baseSalary: amount(calculation.baseSalary ?? calculation.monthlySalary),
    adjustedBase,
    overtime,
    bonusTotal,
    penaltyTotal,
    socialInsurance: amount(calculation.socialInsurance ?? insuranceFundAmount(vietnam, "social")),
    healthInsurance: amount(calculation.healthInsurance ?? insuranceFundAmount(vietnam, "health")),
    unemploymentInsurance: amount(calculation.unemploymentInsurance ?? insuranceFundAmount(vietnam, "unemployment")),
    personalIncomeTax: amount(calculation.personalIncomeTax ?? vietnam?.tax?.tax),
    otherDeductions,
    advances: amount(calculation.advances ?? vietnam?.deductions?.advances),
    hiddenIncome: Math.max(0, gross - adjustedBase - overtime - bonusTotal),
  };
}

const overrideProjection = (override: any): PayrollLineOverrideValues => {
  if (!override) return {};
  const values: PayrollLineOverrideValues = {};
  for (const field of PAYROLL_LINE_OVERRIDE_FIELDS) {
    if (override[field] !== undefined) values[field] = amount(override[field]);
  }
  if (override.customValues !== undefined) {
    const customValues = override.customValues instanceof Map
      ? Object.fromEntries(override.customValues.entries())
      : { ...override.customValues };
    values.customValues = Object.fromEntries(
      Object.entries(customValues).map(([key, value]) => [key, amount(value)]),
    );
  }
  return values;
};

export function projectPayrollLineWithOverride(line: any, override?: any) {
  const systemValues = normalizePayrollLineSystemValues(line);
  const overrideValues = overrideProjection(override);
  const resolved = resolvePayrollLineOverride(systemValues, overrideValues);
  const effectiveValues = {
    ...resolved.values,
    ...(overrideValues.customValues ? { customValues: overrideValues.customValues } : {}),
  };
  return {
    ...line,
    calculation: {
      ...(line?.calculation ?? {}),
      baseSalary: resolved.values.baseSalary,
      monthlySalary: resolved.values.baseSalary,
      adjustedBase: resolved.values.adjustedBase,
      overtime: resolved.values.overtime,
      bonusTotal: resolved.values.bonusTotal,
      penaltyTotal: resolved.values.penaltyTotal,
      socialInsurance: resolved.values.socialInsurance,
      healthInsurance: resolved.values.healthInsurance,
      unemploymentInsurance: resolved.values.unemploymentInsurance,
      personalIncomeTax: resolved.values.personalIncomeTax,
      otherDeductions: resolved.values.otherDeductions,
      advances: resolved.values.advances,
      deductions: resolved.deductionTotal,
      net: resolved.net,
    },
    systemValues,
    overrideValues,
    effectiveValues,
    overrideVersion: amount(override?.version),
    deductionTotal: resolved.deductionTotal,
    net: resolved.net,
    provenance: resolved.provenance,
  };
}

export function projectPayrollRevisionWithOverrides(revision: any, overrides: any[]) {
  const overrideByEmployee = new Map(overrides.map((item) => [String(item.employeeId), item]));
  return {
    ...revision,
    lines: (revision?.lines ?? []).map((line: any) => (
      projectPayrollLineWithOverride(line, overrideByEmployee.get(String(line.employeeId)))
    )),
  };
}

export async function projectPayrollLinesWithStoredOverrides(
  scope: PayrollOperationScope,
  periodKey: string,
  lines: any[],
) {
  const employeeIds = [...new Set(lines.map((line) => String(line.employeeId)))];
  if (!employeeIds.length) return [];
  const overrides = await PayrollLineOverrideModel.find({
    ...scope,
    periodKey,
    employeeId: { $in: employeeIds },
  }).lean();
  return projectPayrollRevisionWithOverrides({ lines }, overrides as any[]).lines;
}

const ADJUSTMENT_BUCKET = {
  allowance: "allowances",
  bonus: "bonuses",
  deduction: "deductions",
  correction: "adjustments",
} as const;

type AdjustmentTotals = Record<(typeof ADJUSTMENT_BUCKET)[keyof typeof ADJUSTMENT_BUCKET], number>;

const emptyAdjustmentTotals = (): AdjustmentTotals => ({ allowances: 0, bonuses: 0, deductions: 0, adjustments: 0 });

async function loadAdjustmentTotals(scope: PayrollOperationScope, periodKey: string) {
  const rows: any[] = await PayrollAdjustmentModel.find({
    ...scope,
    periodKey,
    status: { $in: ["pending", "approved", "snapshotted"] },
  }).select("employeeId kind amount").lean();
  const totals = new Map<string, AdjustmentTotals>();
  for (const row of rows) {
    const bucket = ADJUSTMENT_BUCKET[row.kind as keyof typeof ADJUSTMENT_BUCKET];
    if (!bucket) continue;
    const employeeId = String(row.employeeId);
    const current = totals.get(employeeId) ?? emptyAdjustmentTotals();
    current[bucket] += Number(row.amount || 0);
    totals.set(employeeId, current);
  }
  return totals;
}

export async function buildRunCalculationInputs(
  scope: PayrollOperationScope,
  run: any,
): Promise<DetailedCalculationInput[]> {
  const snapshot: any = await PayrollAttendanceSnapshotModel.findOne({ ...scope, runId: String(run._id ?? run.id) }).lean();
  if (!snapshot) {
    throw new PayrollOperationError("PAYROLL_ATTENDANCE_NOT_LOCKED", "Attendance snapshot is missing for this payroll run", 409);
  }
  const period = { start: isoDate(run.startDate), end: isoDate(run.endDate) };
  const employeeIds = snapshot.employees.map((employee: any) => String(employee.employeeId));
  const [users, contracts, profiles, dependents, policies, adjustments, formulas, periodInputs, customVariables] = await Promise.all([
    UserModel.find({ _id: { $in: employeeIds } }).select("monthlySalary").lean(),
    HRContractModel.find({ companyCode: scope.companyCode, employeeId: { $in: employeeIds } })
      .select("employeeId startDate endDate status salaryTerms").lean(),
    PayrollProfileModel.find({ companyCode: scope.companyCode, employeeId: { $in: employeeIds } }).lean(),
    PayrollDependentModel.find({ companyCode: scope.companyCode, employeeId: { $in: employeeIds } }).lean(),
    PayrollPolicyModel.find({ companyCode: scope.companyCode, status: "active" }).lean(),
    loadAdjustmentTotals(scope, run.periodKey),
    PAYROLL_FORMULA_LIBRARY_ENABLED && mongoose.connection.readyState === 1 ? PayrollFormulaModel.find({ companyCode: scope.companyCode, status: "active", effectiveFrom: { $lte: new Date(period.end) }, $or: [{ effectiveTo: { $exists: false } }, { effectiveTo: null }, { effectiveTo: { $gte: new Date(period.end) } }] }).sort({ priority: 1, code: 1 }).lean() : Promise.resolve([]),
    mongoose.connection.readyState === 1 ? PayrollPeriodInputModel.find({ ...scope, periodKey: run.periodKey, employeeId: { $in: employeeIds } }).lean() : Promise.resolve([]),
    mongoose.connection.readyState === 1 ? PayrollCustomVariableModel.find({ companyCode: scope.companyCode, status: "active" }).lean() : Promise.resolve([]),
  ]);
  const salaryById = new Map((users as any[]).map((user) => [String(user._id), Number(user.monthlySalary || 0)]));
  const groupByEmployee = <T extends { employeeId: unknown }>(rows: T[]) => rows.reduce((map, row) => {
    const key = String(row.employeeId);
    map.set(key, [...(map.get(key) ?? []), row]);
    return map;
  }, new Map<string, T[]>());
  const contractsByEmployee = groupByEmployee(contracts as any[]);
  const profilesByEmployee = groupByEmployee(profiles as any[]);
  const dependentsByEmployee = groupByEmployee(dependents as any[]);
  const periodInputByEmployee = new Map((periodInputs as any[]).map((item) => [String(item.employeeId), item]));
  const policy = resolvePersistedPayrollPolicy(policies as any[], period.end);
  if (!policy) throw new PayrollOperationError("PAYROLL_POLICY_REQUIRED", "Cần áp dụng công thức lương cho kỳ này", 409);

  return Promise.all(snapshot.employees.map(async (employee: any) => {
    const employeeId = String(employee.employeeId);
    const contractTerms = resolveEmployeeSalaryTerms(employeeId, contractsByEmployee.get(employeeId) ?? [], period);
    // Employees without contract salary terms still calculate from their legacy
    // monthlySalary so existing companies keep working before the data migration.
    const sourceSalaryTerms = contractTerms.terms.length
      ? contractTerms.terms
      : [{ id: `contract:${employeeId}`, start: period.start, end: period.end, monthlySalary: salaryById.get(employeeId) ?? 0 }];
    const profile = selectProfileForPeriod(profilesByEmployee.get(employeeId) ?? [], period);
    const employeeAdjustments = adjustments.get(employeeId) ?? emptyAdjustmentTotals();
    const sourceSalary = sourceSalaryTerms[0]?.monthlySalary ?? salaryById.get(employeeId) ?? 0;
    const sourceDailyMinutes = employee.standardDays > 0 ? employee.standardHours * 60 / employee.standardDays : 0;
    const resolvedPeriod = resolvePayrollPeriodInputs({ agreedSalary: sourceSalary, reconciledDays: sourceDailyMinutes > 0 ? employee.workedMinutes / sourceDailyMinutes : 0, reconciledHours: employee.workedMinutes / 60, allowance: employeeAdjustments.allowances, bonus: employeeAdjustments.bonuses, deduction: employeeAdjustments.deductions }, periodInputByEmployee.get(employeeId) as any, customVariables as any[]);
    const monthlySalary = resolvedPeriod.values.agreedSalary;
    const salaryTerms = (periodInputByEmployee.get(employeeId) as any)?.agreedSalary !== undefined ? sourceSalaryTerms.map((term) => ({ ...term, monthlySalary })) : sourceSalaryTerms;
    const resolved = await resolveDetailedPayrollInput(employeeId, { period, salaryTerms });
    const standardDays = resolvedPeriod.values.reconciledDays;
    const standardHours = resolvedPeriod.values.reconciledHours;
    const workedMinutes = standardHours * 60;
    const dailyMinutes = standardDays > 0 ? standardHours * 60 / standardDays : 0;
    const actualWorkDays = standardDays;
    const overtimeHours = (category: string) => (employee.overtime ?? []).filter((item: any) => item.category === category).reduce((sum: number, item: any) => sum + Number(item.minutes || 0), 0) / 60;
    const earliestContract = (contractsByEmployee.get(employeeId) ?? []).map((item: any) => new Date(item.startDate).getTime()).filter(Number.isFinite).sort((a, b) => a - b)[0];
    const tenureMonths = earliestContract ? Math.max(0, Math.floor((new Date(period.end).getTime() - earliestContract) / (30.4375 * 86400000))) : 0;
    const customContext = Object.fromEntries(Object.entries(resolvedPeriod.customValues).map(([key,item])=>[key,item.value]));
    const formulaContext = { monthlySalary, attendanceSalary: monthlySalary, standardWorkDays: employee.standardDays, actualWorkDays, standardWorkHours: employee.standardHours, actualWorkHours: standardHours, shortageMinutes: employee.shortageMinutes, lateMinutes: Number(employee.lateMinutes || 0), earlyLeaveMinutes: Number(employee.earlyLeaveMinutes || 0), paidLeaveDays: (employee.paidLeaveMinutesByRate ?? []).reduce((sum: number, item: any) => sum + Number(item.minutes || 0), 0) / Math.max(1, dailyMinutes), weekdayOvertimeHours: overtimeHours("weekday"), restDayOvertimeHours: overtimeHours("restDay"), holidayOvertimeHours: overtimeHours("holiday"), tenureMonths, ...customContext };
    const library = PAYROLL_FORMULA_LIBRARY_ENABLED ? evaluatePayrollFormulas(formulas as any[], formulaContext) : emptyPayrollFormulaLibraryResult();
    return {
      ...resolved,
      issues: [
        ...(resolved.issues ?? []),
        ...(contractTerms.terms.length ? [] : contractTerms.issues.map((issue) => ({ ...issue, severity: "warning" as const }))),
        ...profileWarnings(employeeId, profile),
      ],
      standardDays: Number(employee.standardDays || 0),
      standardHours: Number(employee.standardHours || 0),
      workedMinutes,
      shortageMinutes: Number(employee.shortageMinutes || 0),
      paidLeaveMinutesByRate: employee.paidLeaveMinutesByRate ?? [],
      overtime: employee.overtime ?? [],
      allowances: resolvedPeriod.values.allowance + library.totals.allowance,
      bonuses: resolvedPeriod.values.bonus + library.totals.bonus,
      deductions: resolvedPeriod.values.deduction + library.totals.deduction,
      adjustments: employeeAdjustments.adjustments + library.totals.adjustment,
      formulaApplications: library.applications,
      periodInput: { version: Number((periodInputByEmployee.get(employeeId) as any)?.version ?? 0), values: { ...resolvedPeriod.values, ...customContext }, provenance: { ...resolvedPeriod.provenance, ...Object.fromEntries(Object.entries(resolvedPeriod.customValues).map(([key,item])=>[key,item.provenance])) } },
      policy: { id: String((policy as any)._id), version: Number((policy as any).version ?? 0), code: policy.code, name: policy.name },
      ...({
        vietnam: {
          policy,
          insuranceSalary: resolveInsuranceSalary(salaryTerms, contractTerms.insuranceSalaryByTerm, salaryById.get(employeeId) ?? 0),
          participatesInsurance: profile?.participatesInsurance ?? true,
          taxMethod: resolveTaxMethod(profile),
          dependentCount: countDependents(dependentsByEmployee.get(employeeId) ?? [], period),
          hasWithholdingCommitment: Boolean(profile?.hasWithholdingCommitment),
        },
      }),
    } satisfies DetailedCalculationInput;
  }));
}

const CALCULATION_ERRORS: Record<string, { message: string; status: number }> = {
  PAYROLL_RUN_NOT_FOUND: { message: "Payroll run not found", status: 404 },
  PAYROLL_VERSION_CONFLICT: { message: "Payroll run version conflict", status: 409 },
  PAYROLL_RUN_STATE_INVALID: { message: "Payroll run must have locked attendance before calculation", status: 409 },
  PAYROLL_CALCULATION_FAILED: { message: "Payroll calculation failed", status: 422 },
};

export async function calculateOperationalRun(
  scope: PayrollOperationScope,
  runId: string,
  actorId: string,
  expectedVersion: number,
  idempotencyKey: string,
) {
  const repositories = createPayrollRevisionRepositories(scope, runId);
  const replay: any = await repositories.idempotency.get(idempotencyKey);
  if (replay?.result) {
    if (replay.runId && replay.runId !== runId) {
      throw new PayrollOperationError("PAYROLL_IDEMPOTENCY_CONFLICT", "Idempotency key was used for another request", 409);
    }
    const replayed: any = await PayrollRunModel.findOne({ _id: runId, ...scope }).lean();
    const revision = replayed?.periodKey
      ? {
          ...replay.result,
          lines: await projectPayrollLinesWithStoredOverrides(scope, replayed.periodKey, replay.result.lines ?? []),
        }
      : replay.result;
    return { revision, runVersion: replayed?.version };
  }
  const result: any = await calculateRun({
    idempotencyKey,
    idempotency: repositories.idempotency,
    run: repositories.run,
    revision: repositories.revision,
    input: async () => {
      const run = await repositories.run.get();
      return buildRunCalculationInputs(scope, run);
    },
    expectedVersion,
  });

  const failure = result?.code ? CALCULATION_ERRORS[result.code] : undefined;
  if (failure) {
    throw new PayrollOperationError(result.code, failure.message, failure.status, result.currentVersion);
  }
  if (result?.code) {
    throw new PayrollOperationError(result.code, "Payroll calculation failed", 409, result.currentVersion);
  }

  const run: any = await PayrollRunModel.findOne({ _id: runId, ...scope }).lean();
  await PayrollAuditModel.create({
    ...scope,
    periodKey: run?.periodKey ?? "",
    action: "calculate",
    actorId,
    metadata: {
      operation: "calculate",
      runId,
      revisionId: String(result?._id ?? result?.id ?? ""),
      lineCount: Array.isArray(result?.lines) ? result.lines.length : 0,
      beforeVersion: expectedVersion,
      afterVersion: run?.version,
    },
  });

  const revision = run?.periodKey
    ? {
        ...result,
        lines: await projectPayrollLinesWithStoredOverrides(scope, run.periodKey, result?.lines ?? []),
      }
    : result;
  return { revision, runVersion: run?.version };
}
