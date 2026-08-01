import { describe, expect, it } from "vitest";
import {
  policyWindowsOverlap,
  selectPolicyForDate,
  validatePolicyActivation,
  validatePolicyDefinition,
} from "./payroll-policy.service";

const brackets = [{ upTo: 5_000_000, rate: 0.05 }, { upTo: 10_000_000, rate: 0.1 }, { rate: 0.2 }];

describe("policy definition", () => {
  it("accepts ascending brackets that end open-ended", () => {
    expect(validatePolicyDefinition({ effectiveFrom: new Date("2026-01-01"), taxBrackets: brackets } as any)).toBeNull();
  });

  it("rejects brackets that are empty, unordered, or missing the open-ended top", () => {
    const from = new Date("2026-01-01");
    expect(validatePolicyDefinition({ effectiveFrom: from, taxBrackets: [] } as any)?.code).toBe("PAYROLL_POLICY_BRACKETS_REQUIRED");
    expect(validatePolicyDefinition({ effectiveFrom: from, taxBrackets: [{ upTo: 10, rate: 0.1 }] } as any)?.code).toBe("PAYROLL_POLICY_BRACKETS_INVALID");
    expect(validatePolicyDefinition({ effectiveFrom: from, taxBrackets: [{ upTo: 10, rate: 0.1 }, { upTo: 5, rate: 0.2 }, { rate: 0.3 }] } as any)?.code)
      .toBe("PAYROLL_POLICY_BRACKETS_INVALID");
    expect(validatePolicyDefinition({ effectiveFrom: from, taxBrackets: [{ rate: 0.1 }, { rate: 0.3 }] } as any)?.code)
      .toBe("PAYROLL_POLICY_BRACKETS_INVALID");
  });

  it("rejects a window that ends before it starts", () => {
    expect(validatePolicyDefinition({
      effectiveFrom: new Date("2026-06-01"), effectiveTo: new Date("2026-01-01"), taxBrackets: brackets,
    } as any)?.code).toBe("PAYROLL_POLICY_INVALID_WINDOW");
  });
});

describe("policy windows", () => {
  it("treats a missing effectiveTo as open ended", () => {
    expect(policyWindowsOverlap(
      { effectiveFrom: "2026-01-01" },
      { effectiveFrom: "2030-01-01", effectiveTo: "2030-12-31" },
    )).toBe(true);
  });

  it("reports non-overlapping consecutive windows as free", () => {
    expect(policyWindowsOverlap(
      { effectiveFrom: "2026-01-01", effectiveTo: "2026-06-30" },
      { effectiveFrom: "2026-07-01", effectiveTo: "2026-12-31" },
    )).toBe(false);
  });
});

describe("policy activation", () => {
  const draft = { status: "draft", effectiveFrom: "2026-07-01", effectiveTo: "2026-12-31" };

  it("activates a draft policy when no active policy covers the period", () => {
    expect(validatePolicyActivation(draft, [{ effectiveFrom: "2025-01-01", effectiveTo: "2026-06-30" }])).toBeNull();
  });

  it("refuses to activate over an existing active policy", () => {
    expect(validatePolicyActivation(draft, [{ effectiveFrom: "2026-01-01" }]))
      .toEqual(expect.objectContaining({ code: "PAYROLL_POLICY_OVERLAP", status: 409 }));
  });

  it("refuses to activate a policy that is not a draft", () => {
    expect(validatePolicyActivation({ ...draft, status: "retired" }, [])?.code).toBe("PAYROLL_POLICY_INVALID_STATE");
  });

  it("reports a missing policy as not found", () => {
    expect(validatePolicyActivation(null, [])).toEqual(expect.objectContaining({ code: "PAYROLL_POLICY_NOT_FOUND", status: 404 }));
  });
});

describe("selectPolicyForDate", () => {
  const policies = [
    { code: "old", status: "active", effectiveFrom: "2025-01-01", effectiveTo: "2026-06-30" },
    { code: "current", status: "active", effectiveFrom: "2026-07-01" },
    { code: "draft", status: "draft", effectiveFrom: "2026-07-01" },
  ];

  it("picks the active policy covering the run start date", () => {
    expect(selectPolicyForDate(policies, "2026-07-15")?.code).toBe("current");
    expect(selectPolicyForDate(policies, "2026-03-15")?.code).toBe("old");
  });

  it("ignores drafts and returns nothing when no policy covers the date", () => {
    expect(selectPolicyForDate(policies, "2024-01-01")).toBeUndefined();
    expect(selectPolicyForDate([policies[2]], "2026-07-15")).toBeUndefined();
  });
});
