import { describe, expect, it } from "vitest";
import {
  countDependents,
  profileWarnings,
  resolveEmployeeSalaryTerms,
  resolveInsuranceSalary,
  resolveTaxMethod,
  selectProfileForPeriod,
} from "./payroll-employee-input.service";

const period = { start: "2026-07-01", end: "2026-07-31" };

const term = (overrides: any = {}) => ({
  salaryEffectiveFrom: new Date("2026-01-01"),
  contractSalary: 20_000_000,
  insuranceSalary: 15_000_000,
  payrollSalary: 20_000_000,
  salaryType: "monthly" as const,
  currency: "VND",
  ...overrides,
});

const contract = (overrides: any = {}) => ({
  _id: "contract-1",
  startDate: new Date("2025-01-01"),
  endDate: new Date("2027-01-01"),
  status: "active",
  salaryTerms: [term()],
  ...overrides,
});

describe("resolveEmployeeSalaryTerms", () => {
  it("clips a term to the payroll period", () => {
    const { terms } = resolveEmployeeSalaryTerms("emp-1", [contract()], period);

    expect(terms).toEqual([expect.objectContaining({ start: "2026-07-01", end: "2026-07-31", monthlySalary: 20_000_000 })]);
  });

  it("splits the period when the salary changes mid-month", () => {
    const { terms } = resolveEmployeeSalaryTerms("emp-1", [contract({
      salaryTerms: [
        term({ salaryEffectiveTo: new Date("2026-07-15"), payrollSalary: 20_000_000 }),
        term({ salaryEffectiveFrom: new Date("2026-07-16"), payrollSalary: 26_000_000 }),
      ],
    })], period);

    expect(terms.map((item) => [item.start, item.end, item.monthlySalary])).toEqual([
      ["2026-07-01", "2026-07-15", 20_000_000],
      ["2026-07-16", "2026-07-31", 26_000_000],
    ]);
  });

  it("applies the probation rate and prefers an explicit probation salary", () => {
    const rated = resolveEmployeeSalaryTerms("emp-1", [contract({
      salaryTerms: [term({ probation: true, probationRate: 0.85 })],
    })], period);
    expect(rated.terms[0]).toEqual(expect.objectContaining({ monthlySalary: 17_000_000, probation: true }));

    const explicit = resolveEmployeeSalaryTerms("emp-1", [contract({
      salaryTerms: [term({ probation: true, probationRate: 0.85, probationSalary: 12_000_000 })],
    })], period);
    expect(explicit.terms[0].monthlySalary).toBe(12_000_000);
  });

  it("stops paying after the contract ends", () => {
    const { terms } = resolveEmployeeSalaryTerms("emp-1", [contract({ endDate: new Date("2026-07-10") })], period);

    expect(terms[0].end).toBe("2026-07-10");
  });

  it("drops a term whose window falls outside the period", () => {
    const { terms, issues } = resolveEmployeeSalaryTerms("emp-1", [contract({
      salaryTerms: [term({ salaryEffectiveFrom: new Date("2025-01-01"), salaryEffectiveTo: new Date("2025-12-31") })],
    })], period);

    expect(terms).toEqual([]);
    expect(issues).toEqual([expect.objectContaining({ code: "CONTRACT_SALARY_TERM_MISSING", severity: "blocking" })]);
  });

  it("ignores terminated contracts and contracts without salary terms", () => {
    expect(resolveEmployeeSalaryTerms("emp-1", [contract({ status: "terminated" })], period).terms).toEqual([]);
    expect(resolveEmployeeSalaryTerms("emp-1", [contract({ salaryTerms: [] })], period).terms).toEqual([]);
  });

  it("reports the highest declared insurance base across the paid segments", () => {
    const resolved = resolveEmployeeSalaryTerms("emp-1", [contract({
      salaryTerms: [
        term({ salaryEffectiveTo: new Date("2026-07-15"), insuranceSalary: 15_000_000 }),
        term({ salaryEffectiveFrom: new Date("2026-07-16"), insuranceSalary: 18_000_000 }),
      ],
    })], period);

    expect(resolveInsuranceSalary(resolved.terms, resolved.insuranceSalaryByTerm)).toBe(18_000_000);
  });
});

describe("countDependents", () => {
  it("counts only verified dependents whose window touches the period", () => {
    expect(countDependents([
      { status: "verified", deductionFrom: "2026-01-01" },
      { status: "verified", deductionFrom: "2026-07-20" },
      { status: "verified", deductionFrom: "2025-01-01", deductionTo: "2026-06-30" },
      { status: "pending", deductionFrom: "2026-01-01" },
      { status: "rejected", deductionFrom: "2026-01-01" },
      { status: "verified", deductionFrom: "2026-08-01" },
    ], period)).toBe(2);
  });
});

describe("payroll profile selection", () => {
  it("prefers the most recent profile effective in the period", () => {
    const chosen = selectProfileForPeriod([
      { effectiveFrom: "2025-01-01", taxCode: "old" },
      { effectiveFrom: "2026-06-01", taxCode: "new" },
      { effectiveFrom: "2026-09-01", taxCode: "future" },
    ], period);

    expect(chosen?.taxCode).toBe("new");
  });

  it("skips inactive profiles", () => {
    expect(selectProfileForPeriod([{ effectiveFrom: "2026-01-01", status: "inactive" }], period)).toBeUndefined();
  });

  it("lets residency override an inconsistent tax method", () => {
    expect(resolveTaxMethod({ residencyStatus: "nonResident", taxMethod: "progressive" })).toBe("nonResident");
    expect(resolveTaxMethod({ residencyStatus: "resident", taxMethod: "nonResident" })).toBe("progressive");
    expect(resolveTaxMethod({ residencyStatus: "resident", taxMethod: "shortTerm" })).toBe("shortTerm");
    expect(resolveTaxMethod(undefined)).toBe("progressive");
  });

  it("warns about a missing profile, tax code and bank account without blocking", () => {
    expect(profileWarnings("emp-1", undefined)).toEqual([expect.objectContaining({ code: "PAYROLL_PROFILE_MISSING", severity: "warning" })]);
    expect(profileWarnings("emp-1", { taxCode: " ", bankAccountNumber: "" }).map((issue) => issue.code))
      .toEqual(["PAYROLL_TAX_CODE_MISSING", "PAYROLL_BANK_ACCOUNT_MISSING"]);
    expect(profileWarnings("emp-1", { taxCode: "123", bankAccountNumber: "456" })).toEqual([]);
  });
});
