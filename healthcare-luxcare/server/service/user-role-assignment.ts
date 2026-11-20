export function canAssignRoleOnUserCreation(
  callerRole: string | undefined,
  targetRole: string,
  callerLevel: number,
  targetLevel: number,
): boolean {
  if (callerRole === "superadmin") return true;
  if (callerRole !== "admin") return false;
  if (["admin", "superadmin"].includes(targetRole.trim().toLowerCase())) return false;
  return targetLevel > callerLevel;
}

export function assertPrivilegedRoleAssignment(callerRole: string | undefined, targetRole: unknown): void {
  if (
    ["admin", "superadmin"].includes(
      String(targetRole || "")
        .trim()
        .toLowerCase(),
    ) &&
    callerRole !== "superadmin"
  ) {
    throw Object.assign(new Error("Chỉ Superadmin được tạo hoặc cấp vai trò Admin/Superadmin."), { statusCode: 403 });
  }
}
