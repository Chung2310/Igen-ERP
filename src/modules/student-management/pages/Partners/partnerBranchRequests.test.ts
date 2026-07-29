import { describe, expect, it } from "vitest";
import { buildPartnerBranchHeaders } from "./partnerBranchScope";

describe("Partner active branch requests", () => {
  it("sends the selected branch explicitly", () => {
    expect(buildPartnerBranchHeaders("branch-a")).toEqual({ "x-branch-id": "branch-a" });
  });

  it("does not invent a branch while branch context is unresolved", () => {
    expect(buildPartnerBranchHeaders("")).toEqual({});
  });
});