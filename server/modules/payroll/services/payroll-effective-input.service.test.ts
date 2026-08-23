import { describe, expect, it } from "vitest";
import { resolveDetailedPayrollInput } from "./payroll-effective-input.service";

describe("resolveDetailedPayrollInput", () => {
  it("splits a period at effective salary changes in deterministic order", async () => {
    const result = await resolveDetailedPayrollInput("employee-1", {
      period: { start: "2026-07-01", end: "2026-07-31" },
      salaryTerms: [
        { id: "new", start: "2026-07-16", end: "2026-07-31", monthlySalary: 30000000 },
        { id: "old", start: "2026-07-01", end: "2026-07-15", monthlySalary: 26000000 },
      ],
      policy: { id: "policy-1", version: 2 },
    });

    expect(result.segments).toEqual([
      { sourceId: "old", start: "2026-07-01", end: "2026-07-15", monthlySalary: 26000000 },
      { sourceId: "new", start: "2026-07-16", end: "2026-07-31", monthlySalary: 30000000 },
    ]);
    expect(result.issues).toEqual([]);
  });

  it("returns blocking issues for missing policy and overlapping salary terms", async () => {
    const result = await resolveDetailedPayrollInput("employee-1", {
      period: { start: "2026-07-01", end: "2026-07-31" },
      salaryTerms: [
        { id: "a", start: "2026-07-01", end: "2026-07-20", monthlySalary: 26000000 },
        { id: "b", start: "2026-07-15", end: "2026-07-31", monthlySalary: 30000000 },
      ],
    });

    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "PAYROLL_POLICY_MISSING", severity: "blocking" }),
      expect.objectContaining({ code: "SALARY_TERM_OVERLAP", severity: "blocking" }),
    ]));
  });

  it("preserves probation metadata and resolves dependents active in the period", async () => {
    const result = await resolveDetailedPayrollInput("employee-1", {
      period: { start: "2026-07-01", end: "2026-07-31" },
      salaryTerms: [
        { id: "probation", start: "2026-07-01", end: "2026-07-14", monthlySalary: 20000000, probation: true },
        { id: "official", start: "2026-07-15", end: "2026-07-31", monthlySalary: 26000000, probation: false },
      ],
      dependents: [
        { id: "child-a", start: "2026-07-10", end: "2026-12-31" },
        { id: "child-b", start: "2026-08-01", end: "2026-12-31" },
      ],
      policy: { id: "policy-1", version: 2 },
    });
    expect(result.segments[0].probation).toBe(true);
    expect(result.segments[1].probation).toBe(false);
    expect(result.activeDependents).toEqual(["child-a"]);
  });});
