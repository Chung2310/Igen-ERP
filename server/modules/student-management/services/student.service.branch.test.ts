import assert from "node:assert/strict";
import { it } from "vitest";
import { buildBranchScopeQuery, buildUnassignedBranchScopeQuery, buildAssignableBranchQuery } from "./student.service";

it("builds an exact branch filter for normal student lists", () => {
  assert.deepEqual(buildBranchScopeQuery("branch-a"), { branchId: "branch-a" });
});

it("matches only records whose branch is missing or empty in the legacy list", () => {
  assert.deepEqual(buildUnassignedBranchScopeQuery(), {
    $or: [
      { branchId: { $exists: false } },
      { branchId: null },
      { branchId: "" },
    ],
  });
});

it("limits assignment targets to an active branch in the same company", () => {
  assert.deepEqual(buildAssignableBranchQuery("branch-a", "acme"), {
    _id: "branch-a",
    companyCode: "ACME",
    isActive: true,
  });
});