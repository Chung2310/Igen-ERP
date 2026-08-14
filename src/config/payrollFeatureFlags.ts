export const PAYROLL_FORMULA_LIBRARY_ENABLED = false;

export function emptyPayrollFormulaLibraryResult(): {
  applications: never[];
  totals: {
    allowance: number;
    bonus: number;
    deduction: number;
    adjustment: number;
  };
} {
  return {
    applications: [],
    totals: {allowance: 0, bonus: 0, deduction: 0, adjustment: 0},
  };
}
