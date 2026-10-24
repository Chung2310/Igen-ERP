import { CompanyModel } from "../model/company.model";
import { SuperAdminSessionModel } from "../model/super-admin-session.model";

type Account = { role?: string; companyCode?: string; lockedAt?: unknown; disabledAt?: unknown; isActive?: boolean };

export class AccountAccessError extends Error {
  constructor(public readonly code: string, message: string) { super(message); }
}

export async function assertPrivilegedSessionCurrent(userId: string, sessionId?: string) {
  const session = sessionId ? await SuperAdminSessionModel.findOne({ sessionId }).lean() : null;
  const now = Date.now();
  if (!session || String(session.userId) !== String(userId) || session.revokedAt || new Date(session.expiresAt).getTime() <= now || (session.lastSeenAt && now - new Date(session.lastSeenAt).getTime() > 30 * 60_000)) {
    throw new AccountAccessError("SESSION_REVOKED", "Phiên quản trị đã hết hạn hoặc bị thu hồi.");
  }
}

export async function assertAccountUsable(user: Account): Promise<void> {
  if (user.lockedAt) throw new AccountAccessError("ACCOUNT_LOCKED", "Tài khoản của bạn đã bị khóa.");
  if (user.disabledAt || user.isActive === false) throw new AccountAccessError("ACCOUNT_DISABLED", "Tài khoản của bạn đã bị vô hiệu hoá.");
  if (user.role === "superadmin") return;
  if (!user.companyCode || user.companyCode === "SYSTEM") {
    throw new AccountAccessError("COMPANY_UNAVAILABLE", "Không xác định được doanh nghiệp đang hoạt động.");
  }
  const company = await CompanyModel.findOne({ code: user.companyCode }).select("lifecycleStatus").lean();
  if (!company || (company.lifecycleStatus && company.lifecycleStatus !== "active")) {
    throw new AccountAccessError("COMPANY_UNAVAILABLE", "Doanh nghiệp của bạn đang tạm ngưng hoạt động.");
  }
}
