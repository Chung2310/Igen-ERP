import { describe, expect, it } from "vitest";
import { buildCompanyUserFilter } from "./auth.util";

describe("student management branch owner scope", () => {
  it("limits company owners to the authenticated branch", () => {
    expect(buildCompanyUserFilter("ACME", "branch-a")).toEqual({
      companyCode: "ACME",
      branchId: "branch-a",
    });
  });

  it("keeps the legacy company scope when no branch is available", () => {
    expect(buildCompanyUserFilter("ACME")).toEqual({ companyCode: "ACME" });
  });
});
