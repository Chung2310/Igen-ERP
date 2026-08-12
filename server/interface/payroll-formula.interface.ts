export type PayrollFormulaStatus = "draft" | "active" | "retired";
export type PayrollFormulaBucket = "allowance" | "bonus" | "deduction" | "adjustment";
export type PayrollFormulaVariableKey = "monthlySalary" | "attendanceSalary" | "standardWorkDays" | "actualWorkDays" | "standardWorkHours" | "actualWorkHours" | "shortageMinutes" | "lateMinutes" | "earlyLeaveMinutes" | "paidLeaveDays" | "weekdayOvertimeHours" | "restDayOvertimeHours" | "holidayOvertimeHours" | "tenureMonths";
export type PayrollFormulaExpression =
  | { type: "constant"; value: number }
  | { type: "variable"; key: PayrollFormulaVariableKey }
  | { type: "binary"; operator: "add" | "subtract" | "multiply" | "divide" | "min" | "max"; left: PayrollFormulaExpression; right: PayrollFormulaExpression }
  | { type: "percent"; value: PayrollFormulaExpression; rate: PayrollFormulaExpression };
export type PayrollFormulaComparison = { left: PayrollFormulaVariableKey; operator: "equal" | "notEqual" | "greaterThan" | "greaterThanOrEqual" | "lessThan" | "lessThanOrEqual"; right: number };
export type PayrollFormulaDefinition = {
  code: string; name: string; description?: string; resultBucket: PayrollFormulaBucket; priority: number;
  effectiveFrom?: Date | string; effectiveTo?: Date | string;
  conditions: { combinator: "and" | "or"; items: PayrollFormulaComparison[] };
  expression: PayrollFormulaExpression;
  rounding: { mode: "none" | "nearest" | "up" | "down"; unit: 1 | 10 | 100 | 1000 };
};
export interface IPayrollFormula extends PayrollFormulaDefinition {
  companyCode: string; status: PayrollFormulaStatus; version: number; createdBy: string;
  activatedBy?: string; activatedAt?: Date; retiredBy?: string;
}
export type PayrollFormulaContext = Partial<Record<PayrollFormulaVariableKey, number>>;
export type PayrollFormulaApplication = { code: string; name: string; version: number; bucket: PayrollFormulaBucket; applied: boolean; value: number; variables: PayrollFormulaContext; trace: string[] };
