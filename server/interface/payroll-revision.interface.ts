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
