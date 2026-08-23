import type { PayrollLineSnapshot } from "../interfaces/payroll-revision.interface";

type PayslipRun = { _id?: unknown; id?: string; status?: string; periodKey?: string; activeRevisionChecksum?: string };
type PaymentAllocation = { employeeId: string; amount: number };
type Payment = {
  employeeId?: string;
  amount?: number;
  lines?: PaymentAllocation[];
  status?: string;
};

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
  if (run.status !== "closed" && run.status !== "paid") {
    throw new Error("Payslip requires a closed payroll run");
  }
  const runId = String(run._id ?? run.id ?? "");
  const netPay = Number(line.calculation.net ?? line.calculation.netPay ?? 0);
  const paidAmount = payments.reduce((sum, payment) => {
    if (payment.status !== "confirmed") return sum;
    if (Array.isArray(payment.lines)) {
      return sum + payment.lines
        .filter((allocation) => allocation.employeeId === line.employeeId)
        .reduce((allocated, allocation) => allocated + allocation.amount, 0);
    }
    return payment.employeeId === line.employeeId ? sum + Number(payment.amount ?? 0) : sum;
  }, 0);
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
