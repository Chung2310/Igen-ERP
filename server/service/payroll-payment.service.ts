import type { PayrollRunStatus } from "../interface/payroll-operations.interface";

export type PayrollPaymentAction = "confirm" | "cancel" | "reverse";

export type PayrollSettlementLine = { employeeId: string; netPay: number; confirmedPaid: number };

export type PayrollPaymentFailure = { code: string; message: string; status: number };

/** Runs must be closed before money moves; a fully paid run has nothing left to pay. */
const PAYABLE_RUN_STATUSES: PayrollRunStatus[] = ["closed", "partially_paid"];

export type PayrollPaymentStatus = "draft" | "confirmed" | "cancelled" | "reversed";

const ACTIONS: Record<PayrollPaymentAction, { from: PayrollPaymentStatus; to: PayrollPaymentStatus; actorField: string; atField: string }> = {
  confirm: { from: "draft", to: "confirmed", actorField: "confirmedBy", atField: "confirmedAt" },
  cancel: { from: "draft", to: "cancelled", actorField: "cancelledBy", atField: "cancelledAt" },
  reverse: { from: "confirmed", to: "reversed", actorField: "reversedBy", atField: "reversedAt" },
};

export const paymentActionRule = (action: PayrollPaymentAction) => ACTIONS[action];

const failure = (code: string, message: string, status: number): PayrollPaymentFailure => ({ code, message, status });

/**
 * Sums every confirmed payment line per employee. Cancelled and reversed payments
 * release their allocation, so only `confirmed` rows count towards the balance.
 */
export function confirmedPaidByEmployee(payments: Array<{ status: string; lines?: Array<{ employeeId: string; amount: number }> }>) {
  const paid = new Map<string, number>();
  for (const payment of payments) {
    if (payment.status !== "confirmed") continue;
    for (const line of payment.lines ?? []) {
      paid.set(String(line.employeeId), (paid.get(String(line.employeeId)) ?? 0) + Number(line.amount || 0));
    }
  }
  return paid;
}

export function buildSettlementLines(
  lines: Array<{ employeeId: string; calculation?: Record<string, number> }>,
  confirmedPaid: Map<string, number>,
): PayrollSettlementLine[] {
  return lines.map((line) => ({
    employeeId: String(line.employeeId),
    netPay: Number(line.calculation?.net ?? 0),
    confirmedPaid: confirmedPaid.get(String(line.employeeId)) ?? 0,
  }));
}

export function deriveRunSettlementStatus(lines: PayrollSettlementLine[]): "closed" | "partially_paid" | "paid" {
  const netPay = lines.reduce((sum, line) => sum + line.netPay, 0);
  const paid = lines.reduce((sum, line) => sum + Math.min(line.netPay, line.confirmedPaid), 0);
  if (paid <= 0) return "closed";
  return paid >= netPay ? "paid" : "partially_paid";
}

export function validatePaymentRequest(
  run: { status: string },
  settlement: PayrollSettlementLine[],
  request: { amount: number; lines: Array<{ employeeId: string; amount: number }> },
): PayrollPaymentFailure | null {
  if (!PAYABLE_RUN_STATUSES.includes(run.status as PayrollRunStatus)) {
    return failure("PAYROLL_RUN_NOT_PAYABLE", `A payroll run in status ${run.status} cannot be paid`, 409);
  }
  if (!Number.isInteger(request.amount) || request.amount <= 0) {
    return failure("PAYROLL_PAYMENT_INVALID_AMOUNT", "Payment amount must be a positive integer", 400);
  }
  if (!request.lines.length) {
    return failure("PAYROLL_PAYMENT_INVALID_AMOUNT", "Payment must allocate at least one employee line", 400);
  }
  const byEmployee = new Map(settlement.map((line) => [line.employeeId, line]));
  const requestedByEmployee = new Map<string, number>();
  for (const line of request.lines) {
    const source = byEmployee.get(String(line.employeeId));
    if (!source) {
      return failure("PAYROLL_PAYMENT_UNKNOWN_EMPLOYEE", "Payment employee is not in the payroll run", 409);
    }
    if (!Number.isInteger(line.amount) || line.amount <= 0) {
      return failure("PAYROLL_PAYMENT_INVALID_AMOUNT", "Every payment line must be a positive integer", 400);
    }
    requestedByEmployee.set(String(line.employeeId), (requestedByEmployee.get(String(line.employeeId)) ?? 0) + line.amount);
  }
  for (const [employeeId, requested] of requestedByEmployee) {
    const source = byEmployee.get(employeeId)!;
    if (requested > source.netPay - source.confirmedPaid) {
      return failure("PAYROLL_PAYMENT_EXCEEDS_BALANCE", "Payment amount exceeds the remaining payroll balance", 409);
    }
  }
  if (request.lines.reduce((sum, line) => sum + line.amount, 0) !== request.amount) {
    return failure("PAYROLL_PAYMENT_ALLOCATION_MISMATCH", "Payment allocation does not match the payment amount", 400);
  }
  return null;
}

export function validatePaymentTransition(
  payment: { status: string } | null,
  action: PayrollPaymentAction,
): PayrollPaymentFailure | null {
  if (!payment) return failure("PAYROLL_PAYMENT_NOT_FOUND", "Payment not found", 404);
  const rule = ACTIONS[action];
  if (payment.status !== rule.from) {
    return failure("PAYROLL_PAYMENT_INVALID_TRANSITION", `Cannot ${action} a payment in status ${payment.status}`, 409);
  }
  return null;
}
