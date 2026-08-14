import {describe, expect, it} from 'vitest';

import {
  emptyPayrollFormulaLibraryResult,
  PAYROLL_FORMULA_LIBRARY_ENABLED,
} from './payrollFeatureFlags';

describe('payroll formula library feature flag', () => {
  it('is disabled by default', () => {
    expect(PAYROLL_FORMULA_LIBRARY_ENABLED).toBe(false);
  });

  it('creates an empty result with zeroed totals', () => {
    expect(emptyPayrollFormulaLibraryResult()).toEqual({
      applications: [],
      totals: {allowance: 0, bonus: 0, deduction: 0, adjustment: 0},
    });
  });

  it('returns fresh result and applications references for each call', () => {
    const first = emptyPayrollFormulaLibraryResult();
    const second = emptyPayrollFormulaLibraryResult();

    expect(second).not.toBe(first);
    expect(second.applications).not.toBe(first.applications);
  });
});
