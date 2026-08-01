import type { PayrollLineSnapshot } from "../interface/payroll-revision.interface";

type PayslipRun = { _id?: unknown; id?: string; status?: string; periodKey?: string; activeRevisionChecksum?: string };
type Payment = { employeeId: string; amount: number; status?: string };

export type PayrollPayslipView = {
  runId: string;
  periodKey?: string;
  employeeId: string;
  employeeName?: string;
  calculation: Record<string, number>;
  netPay: number;
  paidAmount: number;
  balance: number;
  checksum?: string;
  formulaVersion: string;
  warnings: string[];
  vietnam?: Record<string, unknown>;
};

export function buildPayslip(run: PayslipRun, line: PayrollLineSnapshot, payments: Payment[]): PayrollPayslipView {
  if (run.status !== "closed" && run.status !== "partially_paid" && run.status !== "paid") {
    throw new Error("Payslip requires a closed payroll run");
  }
  const runId = String(run._id ?? run.id ?? "");
  const netPay = Number(line.calculation.net ?? line.calculation.netPay ?? 0);
  const paidAmount = payments.filter((payment) => payment.employeeId === line.employeeId && payment.status === "confirmed").reduce((sum, payment) => sum + payment.amount, 0);
  return {
    runId,
    periodKey: run.periodKey,
    employeeId: line.employeeId,
    employeeName: line.employeeName,
    calculation: { ...line.calculation },
    netPay,
    paidAmount,
    balance: Math.max(0, netPay - paidAmount),
    checksum: run.activeRevisionChecksum,
    formulaVersion: line.formulaVersion,
    warnings: [...line.warnings],
    vietnam: line.vietnam ? { ...line.vietnam } : undefined,
  };
}
