export type PayrollInputProvenance = "period_override" | "system" | "default" | "legacy_fallback";
export type PayrollPeriodInputValues = { agreedSalary?: number; reconciledDays?: number; reconciledHours?: number; allowance?: number; bonus?: number; deduction?: number; customValues?: Record<string, number | undefined> };
export interface IPayrollPeriodInput extends PayrollPeriodInputValues { companyCode: string; branchId: string; periodKey: string; employeeId: string; reason: string; version: number; updatedBy: string; }
export type PayrollCustomVariableUnit = "money" | "number" | "days" | "hours" | "minutes" | "percent";
export interface IPayrollCustomVariable { companyCode: string; code: string; name: string; description?: string; unit: PayrollCustomVariableUnit; defaultValue?: number; status: "draft" | "active" | "retired"; version: number; createdBy: string; activatedBy?: string; retiredBy?: string; }
