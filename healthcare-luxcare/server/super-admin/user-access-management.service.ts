import { UserModel } from "../model/user.model";
import { SuperAdminSessionModel } from "../model/super-admin-session.model";
import { SuperAdminImpersonationModel } from "../model/super-admin-impersonation.model";
import { auditService } from "../service/audit.service";
import { PERMISSION_CODES } from "../config/permission-catalog";
import { AccountDeletionRequestModel } from "../model/onboarding.model";
import { onboardingService } from "../service/onboarding.service";

const scoped = (tenantId: string) => (tenantId === "SYSTEM" ? {} : { companyCode: tenantId });
export function createUserAccessManagementService(deps: any) {
  const audit = (actionType: string, data: any) =>
    deps.audit({ actionType, actorSuperAdminId: data.actorId || data.userId, result: "success", ...data });
  async function user(data: any) {
    const value = await deps.users.find(data.userId);
    if (!value || (data.tenantId !== "SYSTEM" && value.companyCode !== data.tenantId))
      throw new Error("Người dùng nằm ngoài phạm vi doanh nghiệp.");
    return value;
  }
  return {
    async search({ tenantId, page = 1, limit = 20, q }: any) {
      const filter = {
        ...scoped(tenantId),
        ...(q ? { $or: [{ email: new RegExp(q, "i") }, { displayName: new RegExp(q, "i") }] } : {}),
      };
      const total = await deps.users.count(filter);
      return { data: await deps.users.search(filter, { skip: (page - 1) * limit, limit }), total, page, limit };
    },
    async detail(data: any) {
      return user(data);
    },
    async update(data: any) {
      const value = await user(data);
      const allowed = ["role", "permissions", "status", "lockedAt", "displayName", "department", "jobTitle"];
      for (const key of allowed) if (key in (data.patch || {})) (value as any)[key] = data.patch[key];
      await value.save();
      await audit("user.access.update", {
        actorId: data.actorId,
        userId: data.userId,
        tenantId: data.tenantId,
        correlationId: data.correlationId,
        changedFields: Object.keys(data.patch || {}).filter((key) => allowed.includes(key)),
      });
      return value;
    },
    async lock(data: any) {
      return this.update({ ...data, patch: { status: "offline", lockedAt: new Date() } });
    },
    async unlock(data: any) {
      return this.update({ ...data, patch: { lockedAt: undefined } });
    },
    async revokeSessions(data: any) {
      await user(data);
      await deps.sessions.revokeAll(data.userId);
      await audit("security.session.revoke", data);
      return { revoked: true };
    },
    async deleteAccount(data: any) {
      const target = await user(data);
      if (target.role === "superadmin") throw new Error("Không thể xóa tài khoản Super Admin.");
      if (String(target._id) === String(data.actorId)) throw new Error("Không thể tự xóa tài khoản Super Admin đang thao tác.");
      if (String(target.email || "").trim().toLowerCase() !== String(data.confirmEmail || "").trim().toLowerCase())
        throw new Error("Email xác nhận không khớp với tài khoản.");

      const deletion = await AccountDeletionRequestModel.findOneAndUpdate(
        { userId: String(target._id), active: true },
        {
          $set: {
            email: target.email,
            companyCode: target.companyCode || "",
            status: "requested",
            dueAt: new Date(),
          },
          $setOnInsert: { userId: String(target._id), active: true },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
      const result = await onboardingService.completeDeletion(String(data.actorId), String(deletion._id));
      await audit("user.account.delete", {
        actorId: data.actorId,
        userId: String(target._id),
        tenantId: data.tenantId,
        companyCode: target.companyCode,
        correlationId: data.correlationId,
        reason: data.reason,
      });
      return { deleted: true, userId: String(result.userId) };
    },
    async resetTwoFactor(data: any) {
      const value = await user(data);
      if (value.role !== "superadmin") throw new Error("Chỉ tài khoản đặc quyền mới được khôi phục xác thực hai lớp.");
      value.superAdminSecurity = { totpEnabled: false, recoveryCodeHashes: [], failedTotpAttempts: 0 };
      await value.save?.();
      await deps.sessions.revokeAll(data.userId);
      await audit("security.2fa.reset", data);
      return { reset: true };
    },
    async assignRole(data: any) {
      if (data.role === "superadmin") throw new Error("Không thể gán vai trò Super Admin qua chức năng quản lý người dùng.");
      const permissions = data.permissions || [];
      const invalid = permissions.filter((code: string) => !PERMISSION_CODES.includes(code));
      if (invalid.length) throw new Error(`Mã quyền không xác định: ${invalid.join(", ")}`);
      const current = await user(data);
      if (current.role === "superadmin") throw new Error("Không thể thay đổi vai trò của Super Admin duy nhất.");
      return this.update({ ...data, patch: { role: data.role, permissions } });
    },
    async startImpersonation(data: any) {
      if (!data.reason?.trim()) throw new Error("Lý do bằng văn bản là bắt buộc.");
      const value = await user(data);
      if (value.role === "superadmin") throw new Error("Không thể mạo danh Super Admin.");
      const expiresAt = new Date(Date.now() + Math.min(data.durationMinutes || 30, 30) * 60_000);
      await deps.impersonations.create({
        actionId: data.correlationId || `imp_${Date.now().toString(36)}`,
        actorId: String(data.actorId || ""),
        targetUserId: String(value._id),
        companyCode: value.companyCode,
        reason: data.reason,
        expiresAt,
      });
      await audit("security.impersonation.start", { ...data, expiresAt });
      return {
        userId: String(value._id),
        expiresAt,
        restrictions: ["recovery", "secrets", "super-admin", "audit-mutation"],
      };
    },
    async stopImpersonation(data: any) {
      await deps.impersonations.stop(String(data.userId));
      await audit("security.impersonation.stop", data);
      return { stopped: true };
    },
    async activeImpersonation(data: any) {
      const value = await user(data);
      return { active: await deps.impersonations.findActive(String(value._id)) };
    },
  };
}
export const userAccessManagementService = createUserAccessManagementService({
  users: {
    find: (id: string) => UserModel.findById(id),
    findOtherSuperAdmin: (userId: string) =>
      UserModel.findOne({ role: "superadmin", _id: { $ne: userId } })
        .select("_id email")
        .lean(),
    count: (q: any) => UserModel.countDocuments(q),
    search: (q: any, p: any) => UserModel.find(q).sort({ createdAt: -1 }).skip(p.skip).limit(p.limit),
  },
  sessions: {
    revokeAll: (userId: string) =>
      SuperAdminSessionModel.updateMany(
        { userId },
        { $set: { revokedAt: new Date(), revokeReason: "administrative" } },
      ),
  },
  impersonations: {
    create: (doc: any) => SuperAdminImpersonationModel.create(doc),
    stop: (targetUserId: string) =>
      SuperAdminImpersonationModel.updateMany({ targetUserId, stoppedAt: null }, { $set: { stoppedAt: new Date() } }),
    findActive: (targetUserId: string) =>
      SuperAdminImpersonationModel.findOne({ targetUserId, stoppedAt: null, expiresAt: { $gt: new Date() } }).lean(),
  },
  audit: (event: any) => auditService.record(event),
});
