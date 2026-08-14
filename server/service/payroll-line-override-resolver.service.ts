import {
  PAYROLL_LINE_OVERRIDE_FIELDS,
  type PayrollLineOverrideProvenance,
  type PayrollLineOverrideValues,
  type PayrollLineSystemValues,
} from "../interface/payroll-line-override.interface";

const DEDUCTION_FIELDS = [
  "penaltyTotal",
  "socialInsurance",
  "healthInsurance",
  "unemploymentInsurance",
  "personalIncomeTax",
  "otherDeductions",
  "advances",
] as const;

export function resolvePayrollLineOverride(
  system: PayrollLineSystemValues,
  override: PayrollLineOverrideValues,
): {
  values: PayrollLineSystemValues;
  deductionTotal: number;
  net: number;
  provenance: PayrollLineOverrideProvenance;
} {
  const values: PayrollLineSystemValues = {
    ...system,
    customValues: { ...(system.customValues ?? {}) },
  };
  const provenance: PayrollLineOverrideProvenance = {
    baseSalary: "system",
    adjustedBase: "system",
    overtime: "system",
    bonusTotal: "system",
    penaltyTotal: "system",
    socialInsurance: "system",
    healthInsurance: "system",
    unemploymentInsurance: "system",
    personalIncomeTax: "system",
    otherDeductions: "system",
    advances: "system",
    hiddenIncome: "system",
    customValues: Object.fromEntries(
      Object.keys(system.customValues ?? {}).map((code) => [code, "system"]),
    ),
  };

  for (const field of PAYROLL_LINE_OVERRIDE_FIELDS) {
    if (override[field] !== undefined) {
      values[field] = override[field];
      provenance[field] = "manual_override";
    }
  }

  for (const [code, value] of Object.entries(override.customValues ?? {})) {
    values.customValues![code] = value;
    provenance.customValues[code] = "manual_override";
  }

  const deductionTotal = Math.round(
    DEDUCTION_FIELDS.reduce((total, field) => total + values[field], 0),
  );
  const net = Math.max(0, Math.round(
    values.adjustedBase + values.overtime + values.bonusTotal + values.hiddenIncome - deductionTotal,
  ));

  return { values, deductionTotal, net, provenance };
}
