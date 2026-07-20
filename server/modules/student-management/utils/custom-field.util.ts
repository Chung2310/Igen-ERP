import { User } from "../models/user.model";

type TenantUser = { companyCode?: string; centerId?: string; role?: string };

function tenantError(message: string, status: number): Error {
  return Object.assign(new Error(message), { status });
}

async function canonicalTenant(target: string): Promise<string | null> {
  const clauses: Record<string, unknown>[] = [{ companyCode: target }];
  if (/^[0-9a-fA-F]{24}$/.test(target)) clauses.push({ _id: target });
  const owner = await User.findOne({ $or: clauses }).select("companyCode");
  return owner ? (owner.companyCode || target) : null;
}

export async function resolveCustomFieldTenant(user: TenantUser, requestedTenant?: unknown): Promise<string> {
  const requested = typeof requestedTenant === "string" && requestedTenant.trim() ? requestedTenant.trim() : undefined;
  const ownTenant = user.companyCode || (user.centerId && user.centerId !== "SYSTEM" ? user.centerId : undefined);

  if (user.role === "superadmin") {
    if (!requested) throw tenantError("Vui lòng chọn công ty cho trường tùy chỉnh.", 400);
    const canonical = await canonicalTenant(requested);
    if (!canonical) throw tenantError("Không tìm thấy công ty được chọn.", 404);
    return canonical;
  }

  if (!ownTenant) throw tenantError("Không thể xác định công ty cho trường tùy chỉnh.", 400);
  if (requested) {
    const canonical = await canonicalTenant(requested);
    if (!canonical || canonical !== ownTenant) throw tenantError("Bạn không có quyền truy cập trường tùy chỉnh của công ty này.", 403);
  }
  return ownTenant;
}

export async function resolveCustomFieldTenantForOwner(ownerId: unknown): Promise<string> {
  const target = String(ownerId ?? "").trim();
  if (!target) throw tenantError("Không thể xác định chủ sở hữu bản ghi.", 400);
  return (await canonicalTenant(target)) ?? target;
}

export function canManageCustomFields(role: string): boolean {
  return role === "superadmin" || role === "admin" || role === "manager";
}
