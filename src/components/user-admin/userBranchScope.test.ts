import assert from "node:assert/strict";
import { it } from "vitest";
import { resolveUserAdminBranchId } from "./userBranchScope";

it("uses the branch selected by an admin", () => {
  assert.equal(resolveUserAdminBranchId("admin", "selected-branch", "assigned-branch"), "selected-branch");
});

it("keeps branch-pinned roles on their assigned branch", () => {
  assert.equal(resolveUserAdminBranchId("manager", "forged-branch", "assigned-branch"), "assigned-branch");
  assert.equal(resolveUserAdminBranchId("branch_owner", "forged-branch", "assigned-branch"), "assigned-branch");
});