import { describe, expect, it } from "vitest";
import { requiresAssignedStudentBranch } from "./auth.middleware";

describe("partner authentication branch policy", () => {
  it("allows an unassigned company admin through partner authentication", () => {
    expect(requiresAssignedStudentBranch("admin", undefined, true)).toBe(false);
  });

  it("keeps ordinary branch-required routes restricted for an unassigned admin", () => {
    expect(requiresAssignedStudentBranch("admin")).toBe(true);
  });

  it("does not relax the branch requirement for an unassigned manager", () => {
    expect(requiresAssignedStudentBranch("manager", undefined, true)).toBe(true);
  });

  it("continues to allow superadmins through the partner router", () => {
    expect(requiresAssignedStudentBranch("superadmin", undefined, true)).toBe(false);
  });

  it("continues to allow assigned admins and branch owners", () => {
    expect(requiresAssignedStudentBranch("admin", "branch-1", true)).toBe(false);
    expect(requiresAssignedStudentBranch("branch_owner", "branch-1", true)).toBe(false);
  });
});
