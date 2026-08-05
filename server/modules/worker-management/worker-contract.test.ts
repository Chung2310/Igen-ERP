import { describe, expect, it } from "vitest";
import { workerScopeFromActor } from "./contracts";

describe("workerScopeFromActor", () => {
  it("normalizes company and branch scope", () => expect(workerScopeFromActor({ companyCode: " acme ", branchId: " BR-01 " })).toEqual({ companyCode: "ACME", branchId: "BR-01" }));
  it("omits a blank branch scope", () => expect(workerScopeFromActor({ companyCode: "acme", branchId: " " })).toEqual({ companyCode: "ACME" }));
  it("requires a company scope", () => expect(() => workerScopeFromActor({ companyCode: " " })).toThrow("Company scope is required"));
});
