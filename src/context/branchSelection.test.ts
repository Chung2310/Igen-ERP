import assert from "node:assert/strict";
import { it } from "vitest";
import { resolveActiveBranchId } from "./branchSelection";

const branches = [{ _id: "branch-a" }, { _id: "branch-b" }];

it("retains a saved branch that is still active", () => {
  assert.equal(resolveActiveBranchId(branches, "branch-b"), "branch-b");
});

it("uses the first active branch when the saved value is empty or invalid", () => {
  assert.equal(resolveActiveBranchId(branches, ""), "branch-a");
  assert.equal(resolveActiveBranchId(branches, "deleted-branch"), "branch-a");
  assert.equal(resolveActiveBranchId(branches, null), "branch-a");
});

it("returns an empty value only when the company has no active branch", () => {
  assert.equal(resolveActiveBranchId([], "branch-a"), "");
});