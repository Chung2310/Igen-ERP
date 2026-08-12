import type { PayrollRunStatus } from "../interface/payroll-operations.interface";

const transitions: Record<PayrollRunStatus, PayrollRunStatus[]> = {
  draft: ["review"],
  review: ["closed", "draft"],
  closed: ["paid", "draft"],
  paid: [],
};

export function assertPayrollTransition(from: PayrollRunStatus, to: PayrollRunStatus): void {
  if (!transitions[from].includes(to)) {
    throw new Error(`PAYROLL_INVALID_TRANSITION: ${from} -> ${to}`);
  }
}
