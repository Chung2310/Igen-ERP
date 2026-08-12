import type { PayrollInputProvenance, PayrollPeriodInputValues } from "../interface/payroll-period-input.interface";
type CoreKey = "agreedSalary" | "reconciledDays" | "reconciledHours" | "allowance" | "bonus" | "deduction";
const keys: CoreKey[] = ["agreedSalary", "reconciledDays", "reconciledHours", "allowance", "bonus", "deduction"];
export function resolvePayrollPeriodInputs(source: Record<CoreKey, number>, override: PayrollPeriodInputValues = {}, variables: Array<{ code: string; defaultValue?: number }> = []) {
  const values = {} as Record<CoreKey, number>, provenance = {} as Record<CoreKey, PayrollInputProvenance>;
  keys.forEach((key) => { if (override[key] !== undefined) { values[key] = override[key]!; provenance[key] = "period_override"; } else { values[key] = source[key]; provenance[key] = "system"; } });
  const customValues: Record<string, { value: number; provenance: PayrollInputProvenance }> = {}, missing: string[] = [];
  variables.forEach((variable) => { const key = `custom.${variable.code}`; const explicit = override.customValues?.[variable.code]; if (explicit !== undefined) customValues[key] = { value: explicit, provenance: "period_override" }; else if (variable.defaultValue !== undefined) customValues[key] = { value: variable.defaultValue, provenance: "default" }; else missing.push(key); });
  return { values, provenance, customValues, missing };
}
