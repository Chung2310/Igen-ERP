import assert from "node:assert/strict";
import { it } from "vitest";
import { buildBranchRosterFilter } from "./branch-roster-filter";

it("keeps assigned employees scoped to their selected branch by default", () => {
  assert.deepEqual(buildBranchRosterFilter("main-id"), { branchId: "main-id" });
});

it("includes legacy unassigned employees when requested for the main branch", () => {
  assert.deepEqual(buildBranchRosterFilter("main-id", true), {
    $or: [
      { branchId: "main-id" },
      { branchId: { $exists: false } },
      { branchId: null },
      { branchId: "" },
    ],
  });
});

it("does not add a branch condition when no branch is selected", () => {
  assert.deepEqual(buildBranchRosterFilter(), {});
});
