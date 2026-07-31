import { adaptLegacyPayrollLine, type PayrollLineSnapshot } from "../interface/payroll-revision.interface";

export async function readPayrollLine(args: {
  run: { activeRevisionId?: string; lines?: Array<{ employeeId: string; employeeName?: string; calculation?: Record<string, number> }> };
  revision: { getLine: (revisionId: string, employeeId: string) => Promise<any> };
  employeeId: string;
}): Promise<any> {
  if (args.run.activeRevisionId) {
    const typed = await args.revision.getLine(args.run.activeRevisionId, args.employeeId);
    if (typed) return typed;
  }
  const legacy = (args.run.lines ?? []).find((line) => line.employeeId === args.employeeId);
  return legacy ? adaptLegacyPayrollLine(legacy) : undefined;
}



