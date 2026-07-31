export type PayrollLineSnapshot = {
  employeeId: string;
  employeeName?: string;
  calculation: Record<string, number>;
  sourceIds: string[];
  effectiveSegments: Array<{ sourceId: string; start: string; end: string }>;
  policyId?: string;
  policyVersion?: number;
  formulaVersion: string;
  warnings: string[];
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
