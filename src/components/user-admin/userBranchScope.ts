export function resolveUserAdminBranchId(
  role: string | undefined,
  selectedBranchId: string,
  assignedBranchId?: string,
): string | undefined {
  if (role === "admin") return selectedBranchId || assignedBranchId;
  if (["manager", "branch_owner", "user"].includes(role || "")) return assignedBranchId;
  return undefined;
}