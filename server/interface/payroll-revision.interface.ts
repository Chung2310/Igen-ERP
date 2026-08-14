export type PayrollLineSnapshot = {
  employeeId: string;
  employeeName?: string;
  calculation: Record<string, number>;
  sourceIds: string[];
  effectiveSegments: Array<{ sourceId: string; start: string; end: string }>;
  policyId?: string;
  policyVersion?: number;
  policyCode?: string;
  policyName?: string;
  formulaVersion: string;
  warnings: string[];
  formulaApplications?: Array<{ code: string; name: string; version: number; bucket: string; applied: boolean; value: number; variables: Record<string, number>; trace: string[] }>;
  periodInput?: { version: number; values: Record<string, number>; provenance: Record<string, string> };
  /** Payment instructions captured with the calculation so later exports never read a mutable profile. */
  payment?: {
    method: "transfer" | "cash";
    bankName?: string;
    bankCode?: string;
    bankAccountNumber?: string;
    bankAccountHolder?: string;
  };
  /** Full Vietnam breakdown (insurance funds, tax brackets, employer cost) when a policy applied. */
  vietnam?: Record<string, unknown>;
};

export function adaptLegacyPayrollLine(line: {
  employeeId: string;
  employeeName?: string;
  calculation?: Record<string, number>;
}): PayrollLineSnapshot {
  return {
    employeeId: line.employeeId,
    employeeName: line.employeeName,
    calculation: { ...(line.calculation ?? {}) },
    sourceIds: [],
    effectiveSegments: [],
    formulaVersion: "legacy",
    warnings: [],
  };
}
