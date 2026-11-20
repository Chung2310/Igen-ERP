import type { PayrollFormulaDefinition } from "../interface/payroll-formula.interface";
const base = { priority: 10, conditions: { combinator: "and" as const, items: [] }, rounding: { mode: "nearest" as const, unit: 1000 as const } };
export const DEFAULT_PAYROLL_FORMULA_TEMPLATES: PayrollFormulaDefinition[] = [
  { ...base, code: "attendance-allowance", name: "Phụ cấp chuyên cần", description: "Phụ cấp khi đủ ngày công", resultBucket: "allowance", conditions: { combinator: "and", items: [{ left: "actualWorkDays", operator: "greaterThanOrEqual", right: 26 }] }, expression: { type: "constant", value: 500_000 } },
  { ...base, code: "workday-bonus", name: "Thưởng theo ngày công", resultBucket: "bonus", priority: 20, expression: { type: "binary", operator: "multiply", left: { type: "variable", key: "actualWorkDays" }, right: { type: "constant", value: 20_000 } } },
  { ...base, code: "late-deduction", name: "Khấu trừ đi muộn", resultBucket: "deduction", priority: 30, expression: { type: "binary", operator: "multiply", left: { type: "variable", key: "lateMinutes" }, right: { type: "constant", value: 2_000 } } },
];
