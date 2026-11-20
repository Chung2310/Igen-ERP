import { calculatePayroll } from "./payroll-calculation.service";
import { calculatePayrollChecksum } from "./payroll-checksum.service";
import { calculatePersonalIncomeTax, calculateVietnamPayroll, type PayrollTaxMethod } from "./payroll-vietnam.service";
import type { IPayrollPolicy } from "../interface/payroll-policy.interface";
import type { PayrollLineSnapshot } from "../interface/payroll-revision.interface";
import type { DetailedPayrollInput } from "./payroll-effective-input.service";
import { applyPayrollKpi, type PayrollKpiSnapshot } from "./payroll-kpi-adjustment.service";

export type DetailedCalculationInput = DetailedPayrollInput & {
  standardDays: number;
  standardHours: number;
  workedMinutes: number;
  shortageMinutes: number;
  paidLeaveMinutesByRate: { minutes: number; payRate: number }[];
  overtime: { minutes: number; category: "weekday" | "restDay" | "holiday"; night?: boolean }[];
  allowances: number;
  bonuses: number;
  deductions: number;
  adjustments: number;
  formulaApplications?: PayrollLineSnapshot["formulaApplications"];
  periodInput?: PayrollLineSnapshot["periodInput"];
  payment?: PayrollLineSnapshot["payment"];
  kpi?: PayrollKpiSnapshot;
  /** Present once the company has an active payroll policy; drives the Vietnam formulas. */
  vietnam?: {
    policy: IPayrollPolicy;
    insuranceSalary: number;
    participatesInsurance?: boolean;
    taxMethod?: PayrollTaxMethod;
    dependentCount?: number;
    hasWithholdingCommitment?: boolean;
  };
};

export function calculateDetailedPayroll(input: DetailedCalculationInput): {
  lines: PayrollLineSnapshot[];
  totals: { grossPay: number; deductions: number; netPay: number };
  issues: DetailedPayrollInput["issues"];
} {
  const issues = [...(input.issues ?? [])];
  if (!input.segments.length) return { lines: [], totals: { grossPay: 0, deductions: 0, netPay: 0 }, issues };

  const totalSegmentDays = input.segments.reduce((sum, segment) => {
    const start = new Date(segment.start + "T00:00:00.000Z").getTime();
    const end = new Date(segment.end + "T00:00:00.000Z").getTime();
    return sum + Math.floor((end - start) / 86400000) + 1;
  }, 0);
  const segments = input.segments.map((segment) => {
    const start = new Date(segment.start + "T00:00:00.000Z").getTime();
    const end = new Date(segment.end + "T00:00:00.000Z").getTime();
    const days = Math.floor((end - start) / 86400000) + 1;
    const ratio = days / totalSegmentDays;
    const calculation = calculatePayroll({
      monthlySalary: Math.round(segment.monthlySalary * ratio),
      standardDays: Math.max(1, input.standardDays * ratio),
      standardHours: Math.max(1, input.standardHours * ratio),
      workedMinutes: input.workedMinutes * ratio,
      shortageMinutes: input.shortageMinutes * ratio,
      paidLeaveMinutesByRate: input.paidLeaveMinutesByRate.map((leave) => ({ ...leave, minutes: leave.minutes * ratio })),
      overtime: input.overtime.map((item) => ({ ...item, minutes: item.minutes * ratio })),
      allowances: input.allowances * ratio,
      bonuses: input.bonuses * ratio,
      deductions: input.deductions * ratio,
      adjustments: input.adjustments * ratio,
    });
    const vietnam = input.vietnam && calculateVietnamPayroll(input.vietnam.policy, {
      workPay: calculation.adjustedBase,
      hourlyRate: Math.round(segment.monthlySalary * ratio) / Math.max(1, input.standardHours * ratio),
      overtime: input.overtime.map((item) => ({ ...item, minutes: item.minutes * ratio })),
      taxableAllowances: input.allowances * ratio,
      bonuses: (input.bonuses + (input.adjustments > 0 ? input.adjustments : 0)) * ratio,
      otherDeductions: (input.deductions + (input.adjustments < 0 ? -input.adjustments : 0)) * ratio,
      insuranceSalary: Math.round(input.vietnam.insuranceSalary * ratio),
      participatesInsurance: input.vietnam.participatesInsurance,
      taxMethod: input.vietnam.taxMethod,
      dependentCount: input.vietnam.dependentCount,
      hasWithholdingCommitment: input.vietnam.hasWithholdingCommitment,
    });
    return { segment, ratio, calculation, vietnam };
  });

  // Tax brackets, withholding thresholds and family deductions belong to the
  // employee's whole period, even when a contract creates several salary lines.
  if (input.vietnam && segments.length > 1) {
    const taxableIncome = segments.reduce((sum, item) => sum + item.vietnam!.income.taxableIncome, 0);
    const tax = calculatePersonalIncomeTax(input.vietnam.policy, {
      method: input.vietnam.taxMethod ?? "progressive",
      taxableIncome,
      employeeInsurance: segments.reduce((sum, item) => sum + item.vietnam!.insurance.employeeTotal, 0),
      dependentCount: input.vietnam.dependentCount ?? 0,
      hasWithholdingCommitment: input.vietnam.hasWithholdingCommitment,
    });
    let cumulativeWeight = 0;
    segments.forEach((item, index) => {
      const vietnam = item.vietnam!;
      const previousWeight = cumulativeWeight;
      cumulativeWeight = index === segments.length - 1 ? 1 : cumulativeWeight
        + (taxableIncome > 0 ? vietnam.income.taxableIncome / taxableIncome : item.ratio);
      // Cumulative rounding preserves every whole-period total exactly.
      const allocate = (value: number) => Math.round(value * cumulativeWeight) - Math.round(value * previousWeight);
      const deductions = {
        personal: allocate(tax.deductions.personal),
        dependents: allocate(tax.deductions.dependents),
        insurance: tax.method === "progressive" ? vietnam.insurance.employeeTotal : 0,
        other: allocate(tax.deductions.other),
        total: 0,
      };
      deductions.total = deductions.personal + deductions.dependents + deductions.insurance + deductions.other;
      const brackets = tax.brackets.map((bracket) => ({ ...bracket, taxableAmount: allocate(bracket.taxableAmount), tax: allocate(bracket.tax) }));
      vietnam.tax = {
        ...tax,
        deductions,
        assessableIncome: allocate(tax.assessableIncome),
        brackets,
        tax: tax.method === "progressive" ? brackets.reduce((sum, bracket) => sum + bracket.tax, 0) : allocate(tax.tax),
      };
      vietnam.deductions.total = vietnam.insurance.employeeTotal + vietnam.tax.tax
        + vietnam.deductions.other + vietnam.deductions.advances;
      const rawNet = vietnam.income.totalIncome - vietnam.deductions.total;
      vietnam.netPay = Math.max(0, rawNet);
      vietnam.carryForward = Math.max(0, -rawNet);
      vietnam.warnings = vietnam.carryForward > 0 ? [{
        code: "PAYROLL_DEDUCTIONS_EXCEED_INCOME",
        message: "Các khoản khấu trừ vượt thu nhập; phần vượt được chuyển kỳ sau",
        severity: "warning",
      }] : [];
    });
  }

  const lines = segments.map(({ segment, ratio, calculation, vietnam }) => {
    // Echo the prorated adjustment inputs back into the snapshot so the payroll
    // table can show thưởng/phạt per employee without re-reading adjustments.
    const adjustmentEcho = {
      allowances: Math.round(input.allowances * ratio),
      bonuses: Math.round(input.bonuses * ratio),
      otherDeductions: Math.round(input.deductions * ratio),
      adjustments: Math.round(input.adjustments * ratio),
    };
    const systemCalculation = vietnam
      ? { ...calculation, ...adjustmentEcho, overtime: vietnam.overtime.total, gross: vietnam.income.totalIncome, deductions: vietnam.deductions.total, net: vietnam.netPay, monthlySalary: Math.round(segment.monthlySalary * ratio), workedMinutes: Math.round(input.workedMinutes * ratio) }
      : { ...calculation, ...adjustmentEcho, deductions: Math.round(input.deductions * ratio), monthlySalary: Math.round(segment.monthlySalary * ratio), workedMinutes: Math.round(input.workedMinutes * ratio) };
    const kpiAmounts = input.kpi
      ? applyPayrollKpi(systemCalculation.net, systemCalculation.deductions, input.kpi.appliedPercent)
      : undefined;
    const finalCalculation = kpiAmounts ? {
      ...systemCalculation,
      netBeforeKpi: kpiAmounts.netBeforeKpi,
      systemKpiPercent: input.kpi!.systemPercent,
      appliedKpiPercent: input.kpi!.appliedPercent,
      kpiAdjustment: kpiAmounts.kpiAdjustment,
      deductions: kpiAmounts.deductions,
      net: kpiAmounts.netAfterKpi,
    } : systemCalculation;
    return {
      employeeId: input.employeeId,
      calculation: finalCalculation,
      ...(vietnam ? { vietnam } : {}),
      sourceIds: [segment.sourceId],
      effectiveSegments: [{ sourceId: segment.sourceId, start: segment.start, end: segment.end }],
      policyId: input.policy?.id,
      policyVersion: input.policy?.version,
      policyCode: input.policy?.code ?? input.vietnam?.policy.code ?? "builtin-default",
      policyName: input.policy?.name ?? input.vietnam?.policy.name ?? "Công thức mặc định",
      formulaVersion: vietnam ? vietnam.formulaVersion : "vietnam-payroll-1",
      warnings: vietnam ? vietnam.warnings.map((warning) => warning.code) : [],
      ...(input.kpi ? { kpi: { ...input.kpi } } : {}),
      formulaApplications: input.formulaApplications,
      periodInput: input.periodInput,
      ...(input.payment ? { payment: { ...input.payment } } : {}),
    };
  });

  return {
    lines,
    totals: {
      grossPay: lines.reduce((sum, line) => sum + (line.calculation.gross ?? 0), 0),
      deductions: lines.reduce((sum, line) => sum + (line.calculation.deductions ?? 0), 0),
      netPay: lines.reduce((sum, line) => sum + (line.calculation.net ?? 0), 0),
    },
    issues,
  };
}

export function calculateDetailedPayrollBatch(inputs: DetailedCalculationInput[]): {
  lines: PayrollLineSnapshot[];
  totals: { grossPay: number; deductions: number; netPay: number };
  issues: DetailedPayrollInput["issues"];
} {
  return inputs.reduce((accumulator, input) => {
    const calculated = calculateDetailedPayroll(input);
    return {
      lines: [...accumulator.lines, ...calculated.lines],
      totals: {
        grossPay: accumulator.totals.grossPay + calculated.totals.grossPay,
        deductions: accumulator.totals.deductions + calculated.totals.deductions,
        netPay: accumulator.totals.netPay + calculated.totals.netPay,
      },
      issues: [...(accumulator.issues ?? []), ...(calculated.issues ?? [])],
    };
  }, { lines: [], totals: { grossPay: 0, deductions: 0, netPay: 0 }, issues: [] } as ReturnType<typeof calculateDetailedPayroll>);
}

export async function runPayrollRevision(args: {
  revision: { create: (value: any) => Promise<any>; update: (id: string, value: any) => Promise<any> };
  run: { activateRevision: (id: string) => Promise<void> };
  input: DetailedCalculationInput;
}) {
  const started = await args.revision.create({ status: "running", lines: [], totals: { grossPay: 0, deductions: 0, netPay: 0 } });
  try {
    const calculated = calculateDetailedPayroll(args.input);
    const completed = await args.revision.update(started.id, { status: "completed", lines: calculated.lines, totals: calculated.totals, issues: calculated.issues });
    await args.run.activateRevision(started.id);
    return { ...completed, status: "completed" as const };
  } catch (error) {
    await args.revision.update(started.id, { status: "failed", issues: [{ code: "PAYROLL_CALCULATION_FAILED", message: error instanceof Error ? error.message : "Tính lương không thành công.", severity: "blocking" }] });
    return { ...started, status: "failed" as const };
  }
}
export async function calculateRun(args: {
  idempotencyKey?: string;
  idempotency?: { get: (key: string) => Promise<any>; save: (key: string, result: any) => Promise<void> };
  run: { get: () => Promise<any>; activateRevision?: (id: string, expectedVersion: number, checksum: string) => Promise<any> };
  revision: { nextRevision: (runId: string) => Promise<number>; create: (value: any) => Promise<any>; update: (id: string, value: any) => Promise<any> };
  input: () => Promise<DetailedCalculationInput | DetailedCalculationInput[]>;
  expectedVersion: number;
}) {
  if (args.idempotencyKey && args.idempotency) { const replay = await args.idempotency.get(args.idempotencyKey); if (replay?.result) return replay.result; }
  const run = await args.run.get();
  if (!run) return { code: "PAYROLL_RUN_NOT_FOUND" };
  if (run.version !== args.expectedVersion) return { code: "PAYROLL_VERSION_CONFLICT", currentVersion: run.version };
  if (run.status !== "draft") return { code: "PAYROLL_RUN_STATE_INVALID", status: run.status };
  const runId = run.id ?? (run._id === undefined ? undefined : String(run._id));
  const revision = await args.revision.nextRevision(runId);
  const started = await args.revision.create({ runId, revision, status: "running", lines: [], totals: { grossPay: 0, deductions: 0, netPay: 0 }, issues: [] });
  try {
    const input = await args.input();
    const calculated = calculateDetailedPayrollBatch(Array.isArray(input) ? input : [input]);
    const checksum = calculatePayrollChecksum({ lines: calculated.lines, totals: calculated.totals });
    const completed = await args.revision.update(started.id, { status: "completed", lines: calculated.lines, totals: calculated.totals, issues: calculated.issues, checksum });
    if (args.run.activateRevision) {
      const activated = await args.run.activateRevision(started.id, args.expectedVersion, checksum);
      if (activated === null) return { code: "PAYROLL_VERSION_CONFLICT", currentVersion: run.version };
    }
    if (args.idempotencyKey && args.idempotency) await args.idempotency.save(args.idempotencyKey, completed);
    return completed;
  } catch (error) {
    await args.revision.update(started.id, { status: "failed", issues: [{ code: "PAYROLL_CALCULATION_FAILED", message: error instanceof Error ? error.message : "Tính lương không thành công.", severity: "blocking" }] });
    return { code: "PAYROLL_CALCULATION_FAILED", revisionId: started.id };
  }
}
