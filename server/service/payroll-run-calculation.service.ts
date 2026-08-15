import { calculatePayroll } from "./payroll-calculation.service";
import { calculatePayrollChecksum } from "./payroll-checksum.service";
import { calculateVietnamPayroll, type PayrollTaxMethod } from "./payroll-vietnam.service";
import type { IPayrollPolicy } from "../interface/payroll-policy.interface";
import type { PayrollLineSnapshot } from "../interface/payroll-revision.interface";
import type { DetailedPayrollInput } from "./payroll-effective-input.service";

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
  commission?: number;
  formulaApplications?: PayrollLineSnapshot["formulaApplications"];
  periodInput?: PayrollLineSnapshot["periodInput"];
  payment?: PayrollLineSnapshot["payment"];
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
  const lines = input.segments.map((segment) => {
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
      commission: (input.commission ?? 0) * ratio,
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
    // Echo the prorated adjustment inputs back into the snapshot so the payroll
    // table can show thưởng/phạt per employee without re-reading adjustments.
    const adjustmentEcho = {
      allowances: Math.round(input.allowances * ratio),
      bonuses: Math.round(input.bonuses * ratio),
      otherDeductions: Math.round(input.deductions * ratio),
      adjustments: Math.round(input.adjustments * ratio),
    };
    return {
      employeeId: input.employeeId,
      calculation: vietnam
        ? { ...calculation, ...adjustmentEcho, commission: Math.round((input.commission ?? 0) * ratio), gross: vietnam.income.totalIncome, deductions: vietnam.deductions.total, net: vietnam.netPay, monthlySalary: Math.round(segment.monthlySalary * ratio), workedMinutes: Math.round(input.workedMinutes * ratio) }
        : { ...calculation, ...adjustmentEcho, commission: Math.round((input.commission ?? 0) * ratio), deductions: Math.round(input.deductions * ratio), monthlySalary: Math.round(segment.monthlySalary * ratio), workedMinutes: Math.round(input.workedMinutes * ratio) },
      ...(vietnam ? { vietnam } : {}),
      sourceIds: [segment.sourceId],
      effectiveSegments: [{ sourceId: segment.sourceId, start: segment.start, end: segment.end }],
      policyId: input.policy?.id,
      policyVersion: input.policy?.version,
      policyCode: input.policy?.code ?? input.vietnam?.policy.code ?? "builtin-default",
      policyName: input.policy?.name ?? input.vietnam?.policy.name ?? "Công thức mặc định",
      formulaVersion: vietnam ? vietnam.formulaVersion : "vietnam-payroll-1",
      warnings: vietnam ? vietnam.warnings.map((warning) => warning.code) : [],
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
    await args.revision.update(started.id, { status: "failed", issues: [{ code: "PAYROLL_CALCULATION_FAILED", message: error instanceof Error ? error.message : "Payroll calculation failed", severity: "blocking" }] });
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
    await args.revision.update(started.id, { status: "failed", issues: [{ code: "PAYROLL_CALCULATION_FAILED", message: error instanceof Error ? error.message : "Payroll calculation failed", severity: "blocking" }] });
    return { code: "PAYROLL_CALCULATION_FAILED", revisionId: started.id };
  }
}
