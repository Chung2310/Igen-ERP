import { Request, Response } from "express";
import { authService } from "../service/auth.service";
import { AuthenticatedRequest } from "../middleware/auth";
import { UserModel } from "../model/user.model";
import { BranchModel } from "../model/branch.model";
import { googleOAuthService } from "../service/google-oauth.service";
import { getSuperAdminRequestMetadata } from "../security/super-admin-request-context";
import { CompanyModel } from "../model/company.model";
import { ModuleSettings } from "../modules/student-management/models/module-settings.model";
import { resolveProfileEnabledModules } from "../service/auth-profile-modules";
import { recordUserActivity } from "../middleware/user-activity";
import { clearModuleCache } from "../middleware/require-module";
import { notifyCompanyModulesChanged } from "../service/company-module-notify";
import { PERMISSION_CODES } from "../config/permission-catalog";
import { getEffectivePermissions } from "../middleware/auth";
import { profileResourceService } from "../service/profile-resource.service";
import { employeeDocumentResourceService } from "../service/employee-document-resource.service";
import { resourceIndexingService } from "../service/resource-indexing.service";

/** Redirect URI cho OAuth Google Drive (khớp Google Cloud Console). */
function buildDriveRedirectUri(req: Request): string {
  const host = req.get("host") || "";
  const isLocal = host.includes("localhost") || host.includes("127.0.0.1") || host.includes("192.168.");
  const protocol = isLocal ? req.protocol : "https";
  return `${protocol}://${host}/api/v1/auth/companies/drive/oauth-callback`;
}

/** Trang HTML đóng popup và gửi kết quả OAuth về cửa sổ cha. */
function driveOAuthResultHtml(ok: boolean, message: string): string {
  const payload = JSON.stringify({ type: "GOOGLE_DRIVE_OAUTH_RESULT", ok, message });
  const title = ok ? "Đã kết nối Google Drive" : "Kết nối Google Drive thất bại";
  const color = ok ? "#16a34a" : "#dc2626";
  return `<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"/><title>${title}</title>
<style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f8fafc}
.box{background:#fff;border-radius:16px;padding:28px 32px;max-width:420px;text-align:center;box-shadow:0 8px 40px rgba(0,0,0,.08)}
h2{color:${color};margin:0 0 8px;font-size:18px}p{color:#64748b;font-size:13px;line-height:1.5;margin:0}</style></head>
<body><div class="box"><h2>${ok ? "✅ " : "❌ "}${title}</h2><p>${ok ? `Tài khoản: ${message}` : message}</p></div>
<script>
  try { localStorage.setItem('gdrive_oauth_result', ${JSON.stringify(payload)}); } catch(e){}
  if (window.opener) { window.opener.postMessage(${payload}, '*'); }
  setTimeout(function(){ window.close(); }, ${ok ? 1200 : 4000});
</script></body></html>`;
}

/**
 * Suy ra danh sách mã quyền hiển thị cho profile người dùng.
 * superadmin/admin luôn thấy đầy đủ; role khác tra theo RolePermission của
 * công ty — nếu công ty chưa cấu hình RolePermission cho role đó thì cũng
 * cho full quyền (nhất quán với hành vi mặc định-mở hiện có của các role
 * ngoài "user" trên Dashboard).
 */
async function resolveProfilePermissions(
  userId?: string,
  role?: string,
  companyCode?: string
): Promise<string[]> {
  if (!role || role === "superadmin") return PERMISSION_CODES;
  const effective = await getEffectivePermissions(userId || "", role, companyCode);
  return Array.from(effective);
}

export function buildUserRosterFilter(companyCode?: string, branchId?: string): Record<string, unknown> {
  return {
    ...(companyCode ? { companyCode } : {}),
    ...(companyCode && branchId ? { branchId } : {}),
  };
}
export const authController = {
  /**
   * POST /api/v1/auth/register
   */
  async register(req: Request, res: Response) {
    try {
      const user = await authService.register(req.body);
      const userObj = user.toObject();
      delete userObj.password;

      return res.status(201).json({
        status: "success",
        message: "Đăng ký tài khoản thành công",
        data: userObj,
      });
    } catch (error: any) {
      console.error("[authController.register] Error:", error);
      return res.status(400).json({
        status: "error",
        message: error.message || "Không thể đăng ký tài khoản",
      });
    }
  },

  /**
   * POST /api/v1/auth/login
   */
  async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;
      const result = await authService.login(email, password, getSuperAdminRequestMetadata(req));
      if (result.kind === "super_admin_challenge") {
        return res.status(202).json({ status: "challenge_required", challengeId: result.challengeId, enrollmentRequired: result.enrollmentRequired, expiresAt: result.expiresAt.toISOString() });
      }
      const { user, accessToken, refreshToken } = result;

      // Lưu Refresh Token vào HTTPOnly Cookie bảo mật
      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 ngày
      });

      const userObj = user.toObject();
      delete userObj.password;

      const company = userObj.companyCode && userObj.companyCode !== "SYSTEM"
        ? await CompanyModel.findOne({ code: userObj.companyCode }).select("driveOAuth driveFolderId").lean()
        : null;
      if (company && company.driveOAuth?.refreshToken) {
        userObj.googleDriveIntegration = {
          isConnected: true,
          driveEmail: company.driveOAuth.connectedEmail || "Company Google Drive",
          rootFolderId: company.driveFolderId || "root",
          connectedAt: company.driveOAuth.connectedAt
        };
      }

      void recordUserActivity({
        userId: String(user._id), companyCode: user.companyCode || "SYSTEM", actionType: "auth.login",
        category: "authentication", result: "success", method: "POST", route: "/api/v1/auth/login",
        description: "Đăng nhập thành công", ...getSuperAdminRequestMetadata(req),
      });

      return res.status(200).json({
        status: "success",
        message: "Đăng nhập thành công",
        accessToken,
        user: userObj,
      });
    } catch (error: any) {
      const attemptedEmail = String(req.body?.email || "").trim().toLowerCase();
      if (attemptedEmail) void UserModel.findOne({ email: attemptedEmail }).select("_id companyCode").lean().then((attemptedUser: any) => {
        if (attemptedUser) return recordUserActivity({
          userId: String(attemptedUser._id), companyCode: attemptedUser.companyCode || "SYSTEM", actionType: "auth.login",
          category: "authentication", result: "failure", method: "POST", route: "/api/v1/auth/login",
          description: "Đăng nhập thất bại", ...getSuperAdminRequestMetadata(req),
        });
      }).catch(() => undefined);
      console.error("[authController.login] Error:", error);
      return res.status(401).json({
        status: "error",
        message: error.message || "Đăng nhập thất bại",
      });
    }
  },

  /**
   * POST /api/v1/auth/refresh-token
   */
  async refreshToken(req: Request, res: Response) {
    try {
      // Ưu tiên đọc từ Cookies
      const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

      if (!refreshToken) {
        return res.status(400).json({
          status: "error",
          message: "Yêu cầu mã làm mới (Refresh Token).",
        });
      }

      const { accessToken } = await authService.refresh(refreshToken);
      return res.status(200).json({
        status: "success",
        accessToken,
      });
    } catch (error: any) {
      console.error("[authController.refreshToken] Error:", error);
      return res.status(401).json({
        status: "error",
        message: error.message || "Làm mới mã truy cập thất bại",
      });
    }
  },

  /**
   * POST /api/v1/auth/logout
   */
  async logout(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (userId) {
        const activeSessionClear = req.user?.sessionId
          ? { $set: { status: "offline" }, $unset: { activeSessionId: "", activeSessionIssuedAt: "", activeSessionLastSeenAt: "", activeSessionUserAgent: "", activeSessionIp: "" } }
          : { $set: { status: "offline" } };
        await UserModel.updateOne({ _id: userId, ...(req.user?.sessionId ? { activeSessionId: req.user.sessionId } : {}) }, activeSessionClear);
      }

      res.clearCookie("refreshToken", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
      });

      return res.status(200).json({
        status: "success",
        message: "Đăng xuất tài khoản thành công",
      });
    } catch (error: any) {
      console.error("[authController.logout] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Có lỗi xảy ra khi đăng xuất",
      });
    }
  },

  /**
   * GET /api/v1/auth/me
   */
  async getMe(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.id;
      // console.log(`[Auth getMe] Request từ User ID: ${userId}, Email: ${req.user?.email}, Role: ${req.user?.role}`);
      if (!userId) {
        console.warn("[Auth getMe] Từ chối: Không tìm thấy User ID trong JWT.");
        return res.status(401).json({
          status: "error",
          message: "Người dùng chưa xác thực.",
        });
      }

      const user = await authService.getMe(userId);
      if (!user) {
        console.warn(`[Auth getMe] Không tìm thấy user với ID: ${userId}`);
        return res.status(404).json({
          status: "error",
          message: "Không tìm thấy hồ sơ người dùng.",
        });
      }

      // console.log(`[Auth getMe] Trả về profile cho user ${user.email}. FBConnected=${user.facebookIntegration?.isConnected}, FBPageId=${user.facebookIntegration?.pageId}`);
      const userObj = user.toObject();
      const company = userObj.companyCode && userObj.companyCode !== "SYSTEM"
        ? await CompanyModel.findOne({ code: userObj.companyCode }).select("enabledModules businessType driveOAuth driveFolderId").lean()
        : null;
      const legacyEntityPreset = company && !company.businessType
        ? (await ModuleSettings.findOne({ tenantId: userObj.companyCode }).select("entityPreset").lean())?.entityPreset
        : undefined;
      userObj.businessType = company?.businessType ?? "general";
      userObj.enabledModules = resolveProfileEnabledModules(company?.enabledModules, company?.businessType, legacyEntityPreset);
      userObj.permissions = await resolveProfilePermissions(userId, userObj.role, userObj.companyCode);

      if (company && company.driveOAuth?.refreshToken) {
        userObj.googleDriveIntegration = {
          isConnected: true,
          driveEmail: company.driveOAuth.connectedEmail || "Company Google Drive",
          rootFolderId: company.driveFolderId || "root",
          connectedAt: company.driveOAuth.connectedAt
        };
      }

      return res.status(200).json({
        status: "success",
        user: userObj,
      });
    } catch (error: any) {
      console.error("[Auth getMe] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Không thể lấy thông tin người dùng",
        details: error.message,
      });
    }
  },

  async getTelegramLinkStatus(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ status: "error", message: "Người dùng chưa xác thực." });
      }

      const data = await authService.getTelegramLinkStatus(userId);
      return res.status(200).json({ status: "success", data });
    } catch (error: any) {
      console.error("[authController.getTelegramLinkStatus] Error:", error);
      return res.status(500).json({ status: "error", message: error.message || "Không thể lấy trạng thái liên kết Telegram." });
    }
  },

  async createTelegramLinkCode(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ status: "error", message: "Người dùng chưa xác thực." });
      }

      const data = await authService.createTelegramLinkCode(userId);
      return res.status(200).json({ status: "success", message: "Đã tạo mã liên kết Telegram.", data });
    } catch (error: any) {
      console.error("[authController.createTelegramLinkCode] Error:", error);
      return res.status(500).json({ status: "error", message: error.message || "Không thể tạo mã liên kết Telegram." });
    }
  },

  async unlinkTelegram(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ status: "error", message: "Người dùng chưa xác thực." });
      }

      const data = await authService.unlinkTelegram(userId);
      return res.status(200).json({ status: "success", message: "Đã hủy liên kết Telegram.", data });
    } catch (error: any) {
      console.error("[authController.unlinkTelegram] Error:", error);
      return res.status(500).json({ status: "error", message: error.message || "Không thể hủy liên kết Telegram." });
    }
  },

  /**
   * PATCH /api/v1/auth/profile
   */
  async updateProfile(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.id;
      // console.log(`[Auth updateProfile] Request từ User ID: ${userId}. Body:`, JSON.stringify(req.body));
      if (!userId) {
        return res.status(401).json({
          status: "error",
          message: "Người dùng chưa xác thực.",
        });
      }

      if (req.body.facebookIntegration) {
        // console.log(`[Auth updateProfile] Đang cập nhật Facebook Integration cho User ${userId}:`, JSON.stringify(req.body.facebookIntegration));
      }
      if (req.body.tiktokIntegration) {
        // console.log(`[Auth updateProfile] Đang cập nhật TikTok Integration cho User ${userId}:`, JSON.stringify(req.body.tiktokIntegration));
      }

      const updatedUser = await authService.updateProfile(userId, req.body);
      if (!updatedUser) {
        console.warn(`[Auth updateProfile] Không tìm thấy user với ID: ${userId}`);
        return res.status(404).json({
          status: "error",
          message: "Không tìm thấy hồ sơ người dùng.",
        });
      }

      const userObj = updatedUser.toObject();
      if (req.body.photoUploadToken) {
        await profileResourceService.finalizeAvatar({
          companyCode: userObj.companyCode,
          branchId: userObj.branchId,
          actorId: userId,
          actorName: userObj.displayName || userObj.email,
        }, userObj, req.body.photoUploadToken);
      }
      const company = userObj.companyCode && userObj.companyCode !== "SYSTEM"
        ? await CompanyModel.findOne({ code: userObj.companyCode }).select("driveOAuth driveFolderId").lean()
        : null;
      if (company && company.driveOAuth?.refreshToken) {
        userObj.googleDriveIntegration = {
          isConnected: true,
          driveEmail: company.driveOAuth.connectedEmail || "Company Google Drive",
          rootFolderId: company.driveFolderId || "root",
          connectedAt: company.driveOAuth.connectedAt
        };
      }

      // console.log(`[Auth updateProfile] Cập nhật thành công cho user ${updatedUser.email}. FBConnected=${updatedUser.facebookIntegration?.isConnected}, FBPageId=${updatedUser.facebookIntegration?.pageId}`);
      return res.status(200).json({
        status: "success",
        message: "Cập nhật hồ sơ người dùng thành công",
        user: userObj,
      });
    } catch (error: any) {
      console.error("[Auth updateProfile] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Không thể cập nhật hồ sơ người dùng",
        details: error.message,
      });
    }
  },

  /**
   * POST /api/v1/auth/change-password
   */
  async changePassword(req: AuthenticatedRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const { password } = req.body;

      if (!userId) {
        return res.status(401).json({
          status: "error",
          message: "Người dùng chưa xác thực.",
        });
      }

      await authService.changePassword(userId, password);
      return res.status(200).json({
        status: "success",
        message: "Thay đổi mật khẩu thành công",
      });
    } catch (error: any) {
      console.error("[authController.changePassword] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Không thể thay đổi mật khẩu",
        details: error.message,
      });
    }
  },

  /**
   * POST /api/v1/auth/register-company
   * (Chỉ dành cho superadmin)
   */
  async registerCompany(req: AuthenticatedRequest, res: Response) {
    try {
      const result = await authService.registerCompanyAndAdmin(req.body);
      const adminObj = result.admin.toObject();
      delete adminObj.password;

      return res.status(201).json({
        status: "success",
        message: "Đăng ký doanh nghiệp và tài khoản Admin thành công",
        data: {
          company: result.company,
          admin: adminObj,
        },
      });
    } catch (error: any) {
      console.error("[authController.registerCompany] Error:", error);
      return res.status(400).json({
        status: "error",
        message: error.message || "Không thể đăng ký doanh nghiệp",
      });
    }
  },

  /**
   * POST /api/v1/auth/register-user
   * (Dành cho superadmin hoặc admin)
   */
  async registerUser(req: AuthenticatedRequest, res: Response) {
    try {
      const callerRole = req.user?.role;
      const callerCompanyCode = req.user?.companyCode;

      if (callerRole !== "superadmin") {
        // Chỉ superadmin mới được đăng ký user cho công ty khác
        req.body.companyCode = callerCompanyCode;
      }

      const newUser = await authService.registerUserForCompany(req.body, callerCompanyCode, callerRole);
      const userObj = newUser.toObject();
      delete userObj.password;
      if (req.body.jobDescriptionUploadToken) {
        await employeeDocumentResourceService.finalizeJobDescription({
          companyCode: userObj.companyCode,
          branchId: userObj.branchId,
          actorId: req.user!.id,
          actorName: req.user!.email,
        }, userObj, req.body.jobDescriptionUploadToken);
      }

      return res.status(201).json({
        status: "success",
        message: "Đăng ký thành viên doanh nghiệp thành công",
        data: userObj,
      });
    } catch (error: any) {
      console.error("[authController.registerUser] Error:", error);
      return res.status(400).json({
        status: "error",
        message: error.message || "Không thể đăng ký thành viên",
      });
    }
  },

  /**
   * GET /api/v1/auth/users
   */
  async getUsers(req: AuthenticatedRequest, res: Response) {
    try {
      let companyCode = req.query.companyCode as string;

      // Bảo vệ dữ liệu đa doanh nghiệp (Tenant Isolation)
      if (req.user?.role !== "superadmin") {
        companyCode = req.user?.companyCode;
      }

      const requestedBranchId = typeof req.query.branchId === "string" ? req.query.branchId : "";
      const filter = buildUserRosterFilter(companyCode, requestedBranchId);
      if (requestedBranchId && companyCode) {
        const { BranchModel } = await import("../model/branch.model");
        const branch = await BranchModel.findOne({ _id: requestedBranchId, companyCode }).select("_id").lean();
        if (!branch) return res.status(403).json({ status: "error", message: "Chi nhánh không thuộc công ty." });
        filter.branchId = requestedBranchId;
      }
      const users = await authService.getUsers(filter);

      return res.status(200).json({
        status: "success",
        data: users,
      });
    } catch (error: any) {
      console.error("[authController.getUsers] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Không thể lấy danh sách nhân sự",
        details: error.message,
      });
    }
  },

  /**
   * GET /api/v1/auth/companies
   * (Chỉ dành cho superadmin)
   */
  async getCompanies(req: AuthenticatedRequest, res: Response) {
    try {
      const companies = await authService.getAllCompanies();
      return res.status(200).json({
        status: "success",
        data: companies,
      });
    } catch (error: any) {
      console.error("[authController.getCompanies] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Không thể lấy danh sách doanh nghiệp",
        details: error.message,
      });
    }
  },

  /**
   * PATCH /api/v1/auth/companies/:id
   * (Chỉ dành cho superadmin)
   */
  async updateCompany(req: AuthenticatedRequest, res: Response) {
    try {
      const updatedCompany = await authService.updateCompany(req.params.id, req.body);
      if (updatedCompany?.code) {
        const socket = await import("../socket");
        await notifyCompanyModulesChanged(
          updatedCompany.code,
          updatedCompany.enabledModules || [],
          { clearModuleCache, emitToCompany: socket.emitToCompany },
          "authController.updateCompany"
        );
      }
      return res.status(200).json({
        status: "success",
        message: "Cập nhật doanh nghiệp thành công",
        data: updatedCompany,
      });
    } catch (error: any) {
      console.error("[authController.updateCompany] Error:", error);
      return res.status(400).json({
        status: "error",
        message: error.message || "Không thể cập nhật doanh nghiệp",
      });
    }
  },

  async getCompanyDriveConfig(req: AuthenticatedRequest, res: Response) {
    try {
      if (req.user?.role !== "superadmin" && req.user?.companyCode !== req.params.code) {
        return res.status(403).json({ status: "error", message: "Bạn không có quyền xem cấu hình Google Drive của doanh nghiệp này." });
      }
      const result = await authService.getCompanyDriveConfig(req.params.code);
      return res.status(200).json({ status: "success", data: result });
    } catch (error: any) {
      console.error("[authController.getCompanyDriveConfig] Error:", error);
      return res.status(400).json({ status: "error", message: error.message || "Không thể lấy cấu hình Google Drive doanh nghiệp" });
    }
  },

  /** GET /api/v1/auth/companies/:code/drive/oauth-url — tạo link OAuth cho popup (admin). */
  async getDriveOAuthUrl(req: AuthenticatedRequest, res: Response) {
    try {
      if (!["admin", "superadmin"].includes(String(req.user?.role || ""))) {
        return res.status(403).json({ status: "error", message: "Bạn không có quyền kết nối Google Drive." });
      }
      if (req.user?.role !== "superadmin" && req.user?.companyCode !== req.params.code) {
        return res.status(403).json({ status: "error", message: "Bạn không có quyền kết nối Google Drive của doanh nghiệp này." });
      }
      const redirectUri = buildDriveRedirectUri(req);
      const url = googleOAuthService.buildAuthUrl(redirectUri, req.params.code);
      return res.status(200).json({ status: "success", data: { url } });
    } catch (error: any) {
      console.error("[authController.getDriveOAuthUrl] Error:", error);
      return res.status(400).json({ status: "error", message: error.message || "Không tạo được link kết nối Google Drive" });
    }
  },

  /** GET /api/v1/auth/companies/drive/oauth-callback — Google redirect về đây (public). */
  async driveOAuthCallback(req: Request, res: Response) {
    try {
      const { code, state, error } = req.query;
      if (error) return res.send(driveOAuthResultHtml(false, String(error)));
      if (!code || !state) return res.send(driveOAuthResultHtml(false, "Thiếu mã xác thực hoặc thông tin doanh nghiệp."));

      const redirectUri = buildDriveRedirectUri(req);
      const { refreshToken, email } = await googleOAuthService.exchangeCode(String(code), redirectUri);
      await authService.saveDriveOAuth(String(state), { refreshToken, email });
      return res.send(driveOAuthResultHtml(true, email || "Google Drive"));
    } catch (error: any) {
      console.error("[authController.driveOAuthCallback] Error:", error);
      return res.send(driveOAuthResultHtml(false, error.message || "Kết nối Google Drive thất bại."));
    }
  },

  /** POST /api/v1/auth/companies/:code/drive/disconnect — ngắt kết nối (admin). */
  async disconnectDrive(req: AuthenticatedRequest, res: Response) {
    try {
      if (!["admin", "superadmin"].includes(String(req.user?.role || ""))) {
        return res.status(403).json({ status: "error", message: "Bạn không có quyền ngắt kết nối Google Drive." });
      }
      if (req.user?.role !== "superadmin" && req.user?.companyCode !== req.params.code) {
        return res.status(403).json({ status: "error", message: "Bạn không có quyền thao tác trên doanh nghiệp này." });
      }
      const result = await authService.disconnectDrive(req.params.code);
      return res.status(200).json({ status: "success", message: "Đã ngắt kết nối Google Drive", data: result });
    } catch (error: any) {
      console.error("[authController.disconnectDrive] Error:", error);
      return res.status(400).json({ status: "error", message: error.message || "Không thể ngắt kết nối Google Drive" });
    }
  },

  async bulkUpdateUsers(req: AuthenticatedRequest, res: Response) {
    try {
      const callerRole = req.user?.role;
      const callerCompanyCode = req.user?.companyCode;

      await authService.bulkUpdateUsers(req.body.updates, callerCompanyCode!, callerRole!);

      return res.status(200).json({
        status: "success",
        message: "Cập nhật cấu trúc nhân sự thành công",
      });
    } catch (error: any) {
      console.error("[authController.bulkUpdateUsers] Error:", error);
      return res.status(400).json({
        status: "error",
        message: error.message || "Không thể cập nhật cấu trúc nhân sự",
      });
    }
  },

  /**
   * PATCH /api/v1/auth/users/:id
   */
  async updateUser(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const callerRole = req.user?.role;
      const callerCompanyCode = req.user?.companyCode;

      const updatedUser = await authService.updateUser(id, req.body, callerCompanyCode!, callerRole!);
      if (updatedUser && req.body.jobDescriptionUploadToken) {
        await employeeDocumentResourceService.finalizeJobDescription({
          companyCode: updatedUser.companyCode,
          branchId: updatedUser.branchId,
          actorId: req.user!.id,
          actorName: req.user!.email,
        }, updatedUser, req.body.jobDescriptionUploadToken);
      }

      return res.status(200).json({
        status: "success",
        message: "Cập nhật thông tin nhân sự thành công",
        data: updatedUser,
      });
    } catch (error: any) {
      console.error("[authController.updateUser] Error:", error);
      return res.status(400).json({
        status: "error",
        message: error.message || "Không thể cập nhật thông tin nhân sự",
      });
    }
  },

  /**
   * DELETE /api/v1/auth/users/:id
   */
  async deleteUser(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const callerRole = req.user?.role;
      const callerCompanyCode = req.user?.companyCode;
      const target = await UserModel.findById(id).select("companyCode").lean();

      await authService.deleteUser(id, callerCompanyCode!, callerRole!);
      if (target?.companyCode) {
        await Promise.all([
          resourceIndexingService.trashSourceRecordResources(target.companyCode, "hr.employee", id),
          resourceIndexingService.trashSourceRecordResources(target.companyCode, "hr.org-chart", id),
        ]);
      }

      return res.status(200).json({
        status: "success",
        message: "Xóa nhân sự thành công",
      });
    } catch (error: any) {
      console.error("[authController.deleteUser] Error:", error);
      return res.status(400).json({
        status: "error",
        message: error.message || "Không thể xóa nhân sự",
      });
    }
  },
  /**
   * GET /api/v1/auth/users/colleagues
   * Trả về danh sách đồng nghiệp cùng công ty (chỉ các trường an toàn).
   * Dành cho tất cả user đã đăng nhập (để dùng trong share picker, chat, v.v.)
   */
  async getColleagues(req: AuthenticatedRequest, res: Response) {
    try {
      const companyCode = req.user?.companyCode;
      if (!companyCode) {
        return res.status(400).json({ status: "error", message: "Không xác định được công ty." });
      }

      const colleagues = await UserModel.find(
        { companyCode, isDeleted: { $ne: true } },
        { _id: 1, displayName: 1, email: 1, photoURL: 1, jobTitle: 1, qualification: 1, department: 1, role: 1, branchId: 1 }
      ).lean();

      const branchIds = colleagues
        .map((colleague: any) => colleague.branchId)
        .filter(Boolean)
        .map((branchId: any) => branchId.toString());
      const branches = branchIds.length
        ? await BranchModel.find(
            { companyCode, _id: { $in: Array.from(new Set(branchIds)) } },
            { _id: 1, name: 1 },
          ).lean()
        : [];
      const branchNames = new Map(branches.map((branch: any) => [branch._id.toString(), branch.name]));
      const safeColleagues = colleagues.map((colleague: any) => ({
        _id: colleague._id,
        displayName: colleague.displayName,
        email: colleague.email,
        ...(colleague.photoURL ? { photoURL: colleague.photoURL } : {}),
        ...(colleague.jobTitle ? { jobTitle: colleague.jobTitle } : {}),
        ...(colleague.qualification ? { qualification: colleague.qualification } : {}),
        ...(colleague.department ? { department: colleague.department } : {}),
        ...(colleague.role ? { role: colleague.role } : {}),
        ...(colleague.branchId
          ? {
              branchId: colleague.branchId.toString(),
              branchName: branchNames.get(colleague.branchId.toString()) || "",
            }
          : {}),
      }));

      return res.status(200).json({ status: "success", data: safeColleagues });
    } catch (error: any) {
      console.error("[authController.getColleagues] Error:", error);
      return res.status(500).json({ status: "error", message: "Không thể lấy danh sách đồng nghiệp." });
    }
  },
};
