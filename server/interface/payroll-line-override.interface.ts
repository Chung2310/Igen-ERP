import type { Document } from "mongoose";

export const PAYROLL_LINE_OVERRIDE_FIELDS = [
  "baseSalary", "adjustedBase", "overtime", "bonusTotal", "penaltyTotal",
  "socialInsurance", "healthInsurance", "unemploymentInsurance",
  "personalIncomeTax", "otherDeductions", "advances",
] as const;

export type PayrollLineOverrideField = typeof PAYROLL_LINE_OVERRIDE_FIELDS[number];
export type PayrollLineOverrideValues = Partial<Record<PayrollLineOverrideField, number>> & {
  customValues?: Record<string, number>;
};

export type PayrollLineSystemValues = Record<PayrollLineOverrideField, number> & {
  hiddenIncome: number;
};

export type PayrollLineOverrideProvenance = Record<keyof PayrollLineSystemValues, "manual_override" | "system">;

export interface IPayrollLineOverride extends Document, PayrollLineOverrideValues {
  companyCode: string;
  branchId: string;
  periodKey: string;
  employeeId: string;
  reason: string;
  version: number;
  updatedBy: string;
}
