import { DEFAULT_ROLE_PERMISSIONS } from "../middleware/auth";
import type { AssistantAccessContext, AssistantUserIdentity } from "./assistant.types";

export interface AssistantToolAccessPolicy {
  permission: string;
}

export function buildAssistantAccessContext(
  user: AssistantUserIdentity,
  resolvedPermissions: readonly string[] = DEFAULT_ROLE_PERMISSIONS[user.role] || [],
): AssistantAccessContext {
  const companyCode = String(user.companyCode || "")
    .trim()
    .toUpperCase();
  if (!companyCode) {
    throw new Error("Tài khoản chưa được gắn với doanh nghiệp.");
  }

  const allBranches = user.role === "admin" || user.role === "superadmin";
  const branchId = String(user.branchId || "").trim();

  return Object.freeze({
    userId: user.id,
    companyCode,
    role: user.role,
    permissions: new Set(resolvedPermissions),
    branchIds: Object.freeze(allBranches || !branchId ? [] : [branchId]),
    allBranches,
    departmentId: user.departmentId,
  });
}

export function assertToolAccess(context: AssistantAccessContext, policy: AssistantToolAccessPolicy): void {
  if (context.permissions.has("*") || context.permissions.has(policy.permission)) return;
  throw new Error("Bạn không có quyền tra cứu nguồn dữ liệu này.");
}
