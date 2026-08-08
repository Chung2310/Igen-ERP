export interface ResourceAccessContext {
  companyCode: string;
  branchId?: string;
  userId: string;
  role: string;
  permissions: ReadonlySet<string>;
}

export interface ResourceAccessItem {
  companyCode: string;
  managedType?: "user" | "system";
  branchId?: string | null;
  requiredPermissions?: string[];
  sourceKey?: string;
  sourceAudienceIds?: string[];
}

const ACCESS_DENIED_MESSAGE = "Bạn không có quyền truy cập tài nguyên này.";
const SYSTEM_MUTATION_MESSAGE = "Tài nguyên hệ thống chỉ được thay đổi tại chức năng nguồn.";

function hasPermission(context: ResourceAccessContext, permission: string): boolean {
  return context.permissions.has("*") || context.permissions.has(permission);
}

function isBranchReadable(item: ResourceAccessItem, context: ResourceAccessContext): boolean {
  if (!item.branchId) return true;
  if (context.branchId) return String(item.branchId) === String(context.branchId);
  return context.role === "admin" || context.role === "superadmin";
}

export function isResourceReadable(item: ResourceAccessItem, context: ResourceAccessContext): boolean {
  if (String(item.companyCode).toUpperCase() !== String(context.companyCode).toUpperCase()) return false;
  if (item.managedType !== "system") return true;
  if (!hasPermission(context, "resource:read")) return false;
  if (!isBranchReadable(item, context)) return false;
  if (item.sourceAudienceIds?.length && !item.sourceAudienceIds.map(String).includes(String(context.userId))) return false;

  const required = item.requiredPermissions || [];
  if (context.permissions.has("*")) return true;
  if (required.length === 0) return false;
  return required.some((permission) => context.permissions.has(permission));
}

export function assertResourceReadable(item: ResourceAccessItem, context: ResourceAccessContext): void {
  if (!isResourceReadable(item, context)) throw new Error(ACCESS_DENIED_MESSAGE);
}

export function assertResourceMutable(item: ResourceAccessItem, _context?: ResourceAccessContext): void {
  if (item.managedType === "system") throw new Error(SYSTEM_MUTATION_MESSAGE);
}

export function filterReadableResourceItems<T extends ResourceAccessItem>(
  items: readonly T[],
  context: ResourceAccessContext,
): T[] {
  return items.filter((item) => isResourceReadable(item, context));
}
