import { UserModel } from "../model/user.model";
import { SuperAdminSessionModel } from "../model/super-admin-session.model";
import { auditService } from "../service/audit.service";

const scoped = (tenantId: string) => tenantId === "SYSTEM" ? {} : { companyCode: tenantId };
export function createUserAccessManagementService(deps: any) {
  const audit = (actionType: string, data: any) => deps.audit({ actionType, actorSuperAdminId: data.actorId || data.userId, result: "success", ...data });
  async function user(data: any) { const value = await deps.users.find(data.userId); if (!value || (data.tenantId !== "SYSTEM" && value.companyCode !== data.tenantId)) throw new Error("User is outside tenant scope"); return value; }
  return {
    async search({ tenantId, page = 1, limit = 20, q }: any) { const filter = { ...scoped(tenantId), ...(q ? { $or: [{ email: new RegExp(q, "i") }, { displayName: new RegExp(q, "i") }] } : {}) }; const total = await deps.users.count(filter); return { data: await deps.users.search(filter, { skip: (page - 1) * limit, limit }), total, page, limit }; },
    async detail(data: any) { return user(data); },
    async update(data: any) { const value = await user(data); const allowed = ["role", "permissions", "status", "lockedAt", "displayName", "department", "jobTitle"]; for (const key of allowed) if (key in (data.patch || {})) (value as any)[key] = data.patch[key]; await value.save(); await audit("user.access.update", { actorId: data.actorId, userId: data.userId, tenantId: data.tenantId, correlationId: data.correlationId, changedFields: Object.keys(data.patch || {}).filter(key => allowed.includes(key)) }); return value; },
    async lock(data: any) { return this.update({ ...data, patch: { status: "offline", lockedAt: new Date() } }); },
    async unlock(data: any) { return this.update({ ...data, patch: { lockedAt: undefined } }); },
    async revokeSessions(data: any) { await user(data); await deps.sessions.revokeAll(data.userId); await audit("security.session.revoke", data); return { revoked: true }; },
    async resetTwoFactor(data: any) { const value = await user(data); if (value.role !== "superadmin") throw new Error("2FA recovery is restricted to privileged accounts"); value.superAdminSecurity = { totpEnabled: false, recoveryCodeHashes: [], failedTotpAttempts: 0 }; await value.save?.(); await deps.sessions.revokeAll(data.userId); await audit("security.2fa.reset", data); return { reset: true }; },
    async assignRole(data: any) { if (data.role === "superadmin" && data.tenantId !== "SYSTEM") throw new Error("Tenant accounts cannot assign superadmin"); return this.update({ ...data, patch: { role: data.role, permissions: data.permissions || [] } }); },
    async startImpersonation(data: any) { if (!data.reason?.trim()) throw new Error("A written reason is required"); const value = await user(data); if (value.role === "superadmin") throw new Error("Cannot impersonate Super Admin"); const expiresAt = new Date(Date.now() + Math.min(data.durationMinutes || 30, 30) * 60_000); await audit("security.impersonation.start", { ...data, expiresAt }); return { userId: String(value._id), expiresAt, restrictions: ["recovery", "secrets", "super-admin", "audit-mutation"] }; },
    async stopImpersonation(data: any) { await audit("security.impersonation.stop", data); return { stopped: true }; },
  };
}
export const userAccessManagementService = createUserAccessManagementService({ users: { find: (id: string) => UserModel.findById(id), count: (q: any) => UserModel.countDocuments(q), search: (q: any, p: any) => UserModel.find(q).sort({ createdAt: -1 }).skip(p.skip).limit(p.limit) }, sessions: { revokeAll: (userId: string) => SuperAdminSessionModel.updateMany({ userId }, { $set: { revokedAt: new Date(), revokeReason: "administrative" } }) }, audit: (event: any) => auditService.record(event) });
