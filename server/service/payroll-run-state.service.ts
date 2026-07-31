import type { PayrollRunStatus } from "../interface/payroll-operations.interface";

const transitions: Record<PayrollRunStatus, PayrollRunStatus[]> = {
  draft: ["attendance_locked"],
  attendance_locked: ["calculated"],
  calculated: ["calculated", "reviewed"],
  reviewed: ["calculated", "approved"],
  approved: ["calculated", "closed"],
  closed: ["partially_paid", "paid"],
  partially_paid: ["closed", "paid"],
  paid: ["partially_paid"],
};

export function assertPayrollTransition(from: PayrollRunStatus, to: PayrollRunStatus): void {
  if (!transitions[from].includes(to)) {
    throw new Error(`PAYROLL_INVALID_TRANSITION: ${from} -> ${to}`);
  }
}
