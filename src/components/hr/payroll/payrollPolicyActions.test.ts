import { describe, expect, it } from "vitest";
import { getPayrollPolicyActions } from "./payrollPolicyActions";

describe("getPayrollPolicyActions", () => {
  it("exposes draft actions to managers", () => expect(getPayrollPolicyActions(true, "draft")).toEqual(["edit", "clone", "activate", "delete"]));
  it("exposes active actions to managers", () => expect(getPayrollPolicyActions(true, "active")).toEqual(["clone", "retire"]));
  it("exposes retired actions to managers", () => expect(getPayrollPolicyActions(true, "retired")).toEqual(["clone", "delete"]));
  it("hides mutations from readers", () => expect(getPayrollPolicyActions(false, "draft")).toEqual([]));
});
