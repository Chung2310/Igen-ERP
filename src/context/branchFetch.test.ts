import { describe, expect, it } from "vitest";
import { buildBranchRequestInit } from "./branchFetch";

describe("buildBranchRequestInit", () => {
  it.each([
    "/api/v1/auth/branches",
    "/api/v1/auth/branches?companyCode=NEW",
    "/api/v1/auth/branches/branch-new/owner",
    "/api/v1/auth/branches/branch-new/pending",
    "https://erp.example/api/v1/auth/branches/branch-new",
  ])("does not attach a stale selection to company-level management: %s", (url) => {
    const init = buildBranchRequestInit(url, undefined, "branch-stale");
    expect(new Headers(init.headers).has("x-branch-id")).toBe(false);
  });

  it("supports Request inputs for branch-list recovery", () => {
    const init = buildBranchRequestInit(new Request("https://erp.example/api/v1/auth/branches"), undefined, "branch-stale");
    expect(new Headers(init.headers).has("x-branch-id")).toBe(false);
  });

  it("preserves an explicit branch header", () => {
    const init = buildBranchRequestInit("/api/v1/crud/products", {
      headers: { "x-branch-id": "branch-explicit" },
    }, "branch-stale");

    expect(new Headers(init.headers).get("x-branch-id")).toBe("branch-explicit");
  });

  it("adds the selected branch when the request has no explicit branch", () => {
    const init = buildBranchRequestInit("/api/v1/crud/products", undefined, "branch-selected");

    expect(new Headers(init.headers).get("x-branch-id")).toBe("branch-selected");
  });
});
