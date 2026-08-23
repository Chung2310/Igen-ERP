import { adaptLegacyPayrollLine, type PayrollLineSnapshot } from "../interfaces/payroll-revision.interface";

export function buildLegacyRevision(line: {
  employeeId: string;
  employeeName?: string;
  calculation?: Record<string, number>;
}): PayrollLineSnapshot {
  return adaptLegacyPayrollLine(line);
}
