import { describe, expect, it } from "vitest";
import { buildBranchRequestInit } from "./branchFetch";

describe("buildBranchRequestInit", () => {
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
