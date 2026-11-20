import { logger } from "../config/logger";
import { archiveHistoricalUser } from "./historical-user.service";
import jwt from "jsonwebtoken";
import { AuthSessionError } from "./auth-session-error";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { UserModel } from "../model/user.model";
import { normalizeBirthDate } from "./birth-date";
import { BranchModel } from "../model/branch.model";
import { CompanyModel } from "../model/company.model";
import { SuperAdminSessionModel } from "../model/super-admin-session.model";
import { RolePermissionModel } from "../model/role-permission.model";
import { TelegramSessionModel } from "../model/telegram-session.model";
import { TelegramLinkTokenModel } from "../model/telegram-link-token.model";
import { DEFAULT_ROLE_LEVELS } from "../middleware/auth";
import { IUser } from "../interface/user.interface";
import { ICompany } from "../interface/company.interface";
import { TelegramLinkStatus } from "../interface/telegram-link.interface";
import { pickSelfServiceProfileUpdate } from "../utils/self-service-profile-update";
import { superAdminAuthService } from "./super-admin-auth.service";
import { filterModulesForBusinessType, resolveBusinessType } from "../config/business-types";
import { resolveCompanyModuleUpdate } from "./auth-company-modules";
import { clearModuleCache } from "../middleware/require-module";
import { createCompanyAdminUser } from "../utils/company-admin-user";
import { reconcilePaidHolidayAttendance } from "./paid-holiday-attendance.service";
import { canAssignRoleOnUserCreation, assertPrivilegedRoleAssignment } from "./user-role-assignment";

import { getJwtAccessSecret, getJwtRefreshSecret } from "../config/env";
import { DepartmentModel } from "../model/department.model";
import { getActiveSessionId, normalizeAuthClient, type AuthClient } from "../security/auth-client";

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
const TELEGRAM_LINK_CODE_TTL_MS = 5 * 60 * 1000;
export const REGULAR_SESSION_REPLACED_CODE = "SESSION_REPLACED";
export const REGULAR_SESSION_REPLACED_EVENT = "auth:session-replaced";
export const REGULAR_SESSION_REPLACED_MESSAGE =
  "Phiên đăng nhập đã được sử dụng trên thiết bị khác. Vui lòng đăng nhập lại.";

function isSuperAdminRole(role?: string) {
  return role === "superadmin";
}

function assertRegularSessionCurrent(user: IUser, sessionId?: string, authClient: AuthClient = "web") {
  const currentSessionId = getActiveSessionId(user, authClient);
  if (!isSuperAdminRole(user.role) && (!sessionId || currentSessionId !== sessionId)) {
    const error = new Error(REGULAR_SESSION_REPLACED_MESSAGE);
    (error as Error & { code?: string }).code = REGULAR_SESSION_REPLACED_CODE;
    throw error;
  }
}

function generateTelegramLinkCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

/**
 * Chặn đăng nhập/làm mới token cho tài khoản bị vô hiệu hoá hoặc thuộc doanh nghiệp không còn active.
 */
async function assertAccountUsable(user: IUser): Promise<void> {
  if (user.disabledAt) {
    throw new AuthSessionError("Tài khoản của bạn đã bị vô hiệu hoá.", "ACCOUNT_DISABLED");
  }
  if (user.role !== "trial_user" && user.companyCode && user.companyCode !== "SYSTEM") {
    const company = await CompanyModel.findOne({ code: user.companyCode })
      .select("lifecycleStatus trialOwnerId")
      .lean<{ lifecycleStatus?: string; trialOwnerId?: string } | null>();
    if (!company || (company.lifecycleStatus && company.lifecycleStatus !== "active")) {
      throw new AuthSessionError("Doanh nghiệp của bạn đang tạm ngưng hoạt động.", "COMPANY_INACTIVE");
    }
  }
}

export const authService = {
  /**
   * Tạo bộ đôi Access Token và Refresh Token
   */
  generateTokens(user: IUser, sessionId?: string, authClient: AuthClient = "web") {
    const payload = {
      id: user._id,
      email: user.email,
      role: user.role,
      companyCode: user.companyCode,
      ...(sessionId ? { sid: sessionId, authClient } : {}),
    };

    const accessToken = jwt.sign(payload, getJwtAccessSecret(), { expiresIn: "15m" });
    const refreshToken = jwt.sign(payload, getJwtRefreshSecret(), { expiresIn: "7d" });

    return { accessToken, refreshToken };
  },

  /**
   * Đăng ký tài khoản người dùng mới
   */
  async register(data: any): Promise<{ registrationPending: true; email: string }> {
    const { onboardingService } = await import("./onboarding.service");
    return onboardingService.register(data);
  },

  async verifyRegistration(email: string, code: string) {
    const { onboardingService } = await import("./onboarding.service");
    return onboardingService.verifyRegistration(email, code);
  },

  /**
   * Đăng nhập tài khoản
   */
  async login(email: string, password?: string, requestMetadata?: any, authClient: AuthClient = "web") {
    const emailLower = email.toLowerCase().trim();
    const user = await UserModel.findOne({ email: emailLower });

    if (!user) {
      throw new Error("Tài khoản hoặc mật khẩu không chính xác.");
    }

    if (user.password && password) {
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        throw new Error("Tài khoản hoặc mật khẩu không chính xác.");
      }
    } else if (user.password && !password) {
      throw new Error("Yêu cầu mật khẩu để đăng nhập.");
    }

    await assertAccountUsable(user);

    if (user.role === "superadmin") {
      const privilegedSession = await superAdminAuthService.completePasswordLogin(user, requestMetadata);
      return { kind: "authenticated" as const, user, ...privilegedSession };
    }

    const previousSessionId = authClient === "mobile" ? user.activeMobileSessionId : getActiveSessionId(user, "web");
    const sessionId = crypto.randomUUID();
    const now = new Date();
    if (authClient === "mobile") {
      user.activeMobileSessionId = sessionId;
      user.activeMobileSessionIssuedAt = now;
      user.activeMobileSessionLastSeenAt = now;
      user.activeMobileSessionUserAgent = requestMetadata?.userAgent || "";
      user.activeMobileSessionIp = requestMetadata?.sourceIp || "";
    } else {
      user.activeWebSessionId = sessionId;
      user.activeWebSessionIssuedAt = now;
      user.activeWebSessionLastSeenAt = now;
      user.activeWebSessionUserAgent = requestMetadata?.userAgent || "";
      user.activeWebSessionIp = requestMetadata?.sourceIp || "";
      // Keep the legacy field aligned with the web slot during migration.
      user.activeSessionId = sessionId;
      user.activeSessionIssuedAt = now;
      user.activeSessionLastSeenAt = now;
      user.activeSessionUserAgent = requestMetadata?.userAgent || "";
      user.activeSessionIp = requestMetadata?.sourceIp || "";
    }
    await user.save();

    if (previousSessionId && previousSessionId !== sessionId) {
      if (authClient === "mobile") {
        const { MobilePushDevice } = await import("../model/mobile-push.model");
        await MobilePushDevice.deleteMany({ uid: String(user._id), sessionId: previousSessionId }).catch(() =>
          logger.warn("[MobilePush] Replaced-session cleanup deferred"),
        );
      }
      const { emitToUserSession } = await import("../socket");
      emitToUserSession(previousSessionId, REGULAR_SESSION_REPLACED_EVENT, {
        code: REGULAR_SESSION_REPLACED_CODE,
        client: authClient,
        message: REGULAR_SESSION_REPLACED_MESSAGE,
      });
    }

    const tokens = this.generateTokens(user, sessionId, authClient);
    return { kind: "authenticated" as const, user, ...tokens };
  },

  /**
   * Làm mới Access Token từ Refresh Token
   */
  async refresh(token: string, authClient: AuthClient = "web") {
    try {
      const decoded = jwt.verify(token, getJwtRefreshSecret()) as any;
      const user = await UserModel.findById(decoded.id);

      if (!user) {
        throw new AuthSessionError("Không tìm thấy thông tin tài khoản.");
      }

      await assertAccountUsable(user);
      const tokenAuthClient = decoded.authClient ? normalizeAuthClient(decoded.authClient) : authClient;
      if (decoded.authClient && tokenAuthClient !== authClient) {
        throw new AuthSessionError("Refresh token không thuộc kênh đăng nhập hiện tại.", "INVALID_SESSION_CLIENT");
      }

      if (isSuperAdminRole(user.role) && decoded.sid) {
        const session = await SuperAdminSessionModel.findOne({ sessionId: decoded.sid });
        const now = Date.now();
        const idleExpired = session?.lastSeenAt && now - new Date(session.lastSeenAt).getTime() > 30 * 60_000;
        if (
          !session ||
          session.revokedAt ||
          idleExpired ||
          new Date(session.expiresAt).getTime() <= now ||
          String(session.userId) !== String(user._id)
        ) {
          throw new AuthSessionError("Phiên quản trị đặc quyền đã hết hạn hoặc bị thu hồi.");
        }
      } else {
        assertRegularSessionCurrent(user, decoded.sid, tokenAuthClient);
      }

      const payload = {
        id: user._id,
        email: user.email,
        role: user.role,
        companyCode: user.companyCode,
        ...(decoded.sid ? { sid: decoded.sid, authLevel: decoded.authLevel, authClient: tokenAuthClient } : {}),
      };

      const accessToken = jwt.sign(payload, getJwtAccessSecret(), { expiresIn: "15m" });
      return { accessToken };
    } catch (error) {
      if (
        error instanceof jwt.JsonWebTokenError ||
        error instanceof jwt.TokenExpiredError ||
        error instanceof jwt.NotBeforeError
      )
        throw new AuthSessionError("Mã làm mới (Refresh Token) đã hết hạn hoặc không hợp lệ.");
      // Database/infrastructure failures must not invalidate a valid mobile session.
      throw error;
    }
  },

  /**
   * Lấy thông tin tài khoản hiện tại
   */
  async getMe(id: string): Promise<IUser | null> {
    return await UserModel.findById(id).select("-password");
  },

  async getTelegramLinkStatus(id: string): Promise<TelegramLinkStatus> {
    const [session, pendingCode] = await Promise.all([
      TelegramSessionModel.findOne({ userId: id }).lean(),
      TelegramLinkTokenModel.findOne({ userId: id }).lean(),
    ]);

    return {
      linked: !!session,
      telegramChatId: session?.telegramChatId ?? null,
      telegramUserId: session?.telegramUserId ?? null,
      linkedAt: session?.linkedAt ?? null,
      pendingCode: pendingCode?.code ?? null,
      pendingCodeExpiresAt: pendingCode?.expiresAt ?? null,
      botUsername: String(process.env.TELEGRAM_BOT_USERNAME || "iGEN_ERP_Bot").trim(),
    };
  },

  async createTelegramLinkCode(id: string): Promise<TelegramLinkStatus> {
    const user = await UserModel.findById(id).select("email displayName");
    if (!user) {
      throw new Error("Không tìm thấy người dùng.");
    }

    await TelegramLinkTokenModel.deleteMany({ userId: user._id });

    let created = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        created = await TelegramLinkTokenModel.create({
          userId: user._id,
          email: user.email,
          displayName: user.displayName || user.email,
          code: generateTelegramLinkCode(),
          expiresAt: new Date(Date.now() + TELEGRAM_LINK_CODE_TTL_MS),
        });
        break;
      } catch (error: any) {
        if (error?.code !== 11000) {
          throw error;
        }
      }
    }

    if (!created) {
      throw new Error("Không thể tạo mã liên kết Telegram. Vui lòng thử lại.");
    }

    return this.getTelegramLinkStatus(id);
  },

  async unlinkTelegram(id: string): Promise<TelegramLinkStatus> {
    await Promise.all([
      TelegramSessionModel.deleteMany({ userId: id }),
      TelegramLinkTokenModel.deleteMany({ userId: id }),
    ]);

    return this.createTelegramLinkCode(id);
  },

  /**
   * Cập nhật thông tin tài khoản người dùng (tự phục vụ - self-service).
   * Chỉ cho phép cập nhật các trường hồ sơ cá nhân, KHÔNG bao giờ cho phép
   * client tự đổi role/companyCode/level/parentId qua endpoint này (chặn leo thang đặc quyền).
   */
  async updateProfile(id: string, updateData: any): Promise<IUser | null> {
    const safeUpdateData = pickSelfServiceProfileUpdate(updateData);
    return await UserModel.findByIdAndUpdate(id, { $set: safeUpdateData }, { returnDocument: "after" }).select(
      "-password",
    );
  },

  /**
   * Thay đổi mật khẩu người dùng
   */
  async changePassword(id: string, newPassword: string): Promise<void> {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await UserModel.findByIdAndUpdate(id, { $set: { password: hashedPassword } });
  },

  /**
   * Đăng ký doanh nghiệp mới và tài khoản admin tương ứng
   */
  async registerCompanyAndAdmin(data: any): Promise<any> {
    const {
      companyName,
      companyCode,
      ownerName,
      ownerEmail,
      ownerPassword,
      enabledModules,
      businessType: businessTypeInput,
    } = data;
    const normalizedCode = companyCode.toUpperCase().trim();
    const emailLower = ownerEmail.toLowerCase().trim();

    // 1. Kiểm tra mã doanh nghiệp
    const existingCompany = await CompanyModel.findOne({ code: normalizedCode });
    if (existingCompany) {
      throw new Error(`Mã doanh nghiệp "${normalizedCode}" đã tồn tại trên hệ thống.`);
    }

    // 2. Kiểm tra email admin
    const existingUser = await UserModel.findOne({ email: emailLower });
    if (existingUser) {
      throw new Error(`Địa chỉ email "${emailLower}" đã được sử dụng cho một tài khoản khác.`);
    }

    // 3. Tạo doanh nghiệp
    const businessType = resolveBusinessType(businessTypeInput);
    const newCompany = new CompanyModel({
      code: normalizedCode,
      name: companyName.trim(),
      ownerEmail: emailLower,
      businessType,
      enabledModules: filterModulesForBusinessType(enabledModules, businessType),
      createdAt: new Date(),
    });
    await newCompany.save();

    // 4. Tạo tài khoản admin của doanh nghiệp đó
    const adminUser = await createCompanyAdminUser({
      companyCode: normalizedCode,
      companyName,
      ownerName,
      ownerEmail: emailLower,
      ownerPassword,
    });
    return { company: newCompany, admin: adminUser };
  },

  /**
   * Lấy danh sách người dùng theo bộ lọc, tự động seed cấu trúc sơ đồ mẫu nếu doanh nghiệp mới trống
   */
  async getUsers(filter: { companyCode?: string } = {}, callerRole?: string): Promise<IUser[]> {
    let users = await UserModel.find(filter).select("-password").sort({ createdAt: -1 });

    // Auto-heal: Gán chi nhánh MAIN cho tài khoản Admin/CEO nếu chưa có branchId
    if (filter.companyCode && filter.companyCode !== "SYSTEM") {
      const adminUser = users.find((u) => (u.role === "admin" || u.level === 1) && !u.branchId);
      if (adminUser) {
        try {
          const { BranchModel } = await import("../model/branch.model");
          let mainBranch =
            (await BranchModel.findOne({ companyCode: filter.companyCode, code: "MAIN" }).lean()) ||
            (await BranchModel.findOne({ companyCode: filter.companyCode }).lean());

          if (!mainBranch) {
            const created = await BranchModel.create({
              companyCode: filter.companyCode,
              code: "MAIN",
              name: "Trụ sở chính",
              isActive: true,
              managerId: String(adminUser._id),
            });
            mainBranch = (created as any)?.toObject ? (created as any).toObject() : created;
          }

          if (mainBranch?._id) {
            adminUser.branchId = String(mainBranch._id);
            await UserModel.updateOne({ _id: adminUser._id }, { $set: { branchId: String(mainBranch._id) } }).catch(
              () => undefined,
            );
            if (!mainBranch.managerId) {
              await BranchModel.updateOne(
                { _id: mainBranch._id },
                { $set: { managerId: String(adminUser._id) } },
              ).catch(() => undefined);
            }
          }
        } catch (err) {
          logger.error("[getUsers] Error linking admin to MAIN branch:", err);
        }
      }
    }

    // Tự động seed sơ đồ tổ chức mẫu nếu cấu hình SEED_MOCK_USERS=true và có <= 1 thành viên
    if (
      process.env.SEED_MOCK_USERS === "true" &&
      callerRole === "superadmin" &&
      filter.companyCode &&
      filter.companyCode !== "SYSTEM" &&
      users.length <= 1
    ) {
      const companyCode = filter.companyCode;
      let ceo = users.find((u) => u.role === "admin" || u.role === "superadmin");
      if (!ceo) {
        ceo = users[0];
      }

      if (ceo) {
        const companyName = ceo.companyName || companyCode;

        // 1. Cập nhật CEO gốc
        await UserModel.findByIdAndUpdate(ceo._id, {
          $set: {
            jobTitle: "CEO",
            department: "Ban Giám Đốc",
            division: "Ban Giám Đốc",
            phone: ceo.phone || "0901234567",
            photoURL: ceo.photoURL || "👨‍💼",
            level: 1,
            status: "online",
          },
        });

        // 2. Danh sách nhân sự mẫu
        const mockEmployees = [
          {
            email: `hai.nl@${companyCode.toLowerCase()}.vn`,
            displayName: "Nguyễn Lê Hải",
            jobTitle: "Chief Operations Officer (COO)",
            department: "Ban Giám Đốc",
            phone: "0901112223",
            photoURL: "👨‍💻",
            level: 2,
            parentId: ceo._id.toString(),
            role: "admin",
            division: "Khối Vận Hành",
            status: "online",
          },
          {
            email: `anh.tm@${companyCode.toLowerCase()}.vn`,
            displayName: "Trần Mai Anh",
            jobTitle: "Chief CMO",
            department: "Ban Giám Đốc",
            phone: "0903334445",
            photoURL: "👩‍💼",
            level: 2,
            parentId: ceo._id.toString(),
            role: "admin",
            division: "Khối Marketing",
            status: "online",
          },
          {
            email: `huy.hg@${companyCode.toLowerCase()}.vn`,
            displayName: "Hoàng Gia Huy",
            jobTitle: "Trưởng phòng Kho vận",
            department: "Phòng Kho Vận",
            phone: "0905556667",
            photoURL: "📦",
            level: 3,
            role: "user",
            division: "Khối Vận Hành",
            status: "online",
          },
          {
            email: `tuan.lq@${companyCode.toLowerCase()}.vn`,
            displayName: "Lưu Quốc Tuấn",
            jobTitle: "Trưởng phòng Marketing",
            department: "Phòng Marketing",
            phone: "0907778889",
            photoURL: "📣",
            level: 3,
            role: "user",
            division: "Khối Marketing",
            status: "offline",
          },
          {
            email: `vy.nb@${companyCode.toLowerCase()}.vn`,
            displayName: "Nguyễn Bích Vy",
            jobTitle: "Trưởng phòng Sales CRM",
            department: "Phòng Sales",
            phone: "0908889990",
            photoURL: "👩‍💻",
            level: 3,
            role: "user",
            division: "Khối Sales",
            status: "online",
          },
          {
            email: `sang.ln@${companyCode.toLowerCase()}.vn`,
            displayName: "Lê Ngọc Sang",
            jobTitle: "Chuyên viên Vận chuyển",
            department: "Phòng Kho Vận",
            phone: "0909990001",
            photoURL: "🚛",
            level: 4,
            role: "user",
            division: "Khối Vận Hành",
            status: "offline",
          },
          {
            email: `nam.pd@${companyCode.toLowerCase()}.vn`,
            displayName: "Phan Đình Nam",
            jobTitle: "AI Copywriter Specialist",
            department: "Phòng Marketing",
            phone: "0909990002",
            photoURL: "💡",
            level: 4,
            role: "user",
            division: "Khối Marketing",
            status: "online",
          },
          {
            email: `linh.vt@${companyCode.toLowerCase()}.vn`,
            displayName: "Vũ Thùy Linh",
            jobTitle: "Chăm sóc khách hàng VIP",
            department: "Phòng Sales",
            phone: "0909990003",
            photoURL: "👩‍⚕️",
            level: 4,
            role: "user",
            division: "Khối Sales",
            status: "online",
          },
        ];

        // Tạo COO & CMO
        const createdUsers: Record<string, string> = {};

        const coo = new UserModel({
          ...mockEmployees[0],
          companyCode,
          companyName,
          password: await bcrypt.hash("123456", 10),
        });
        await coo.save();
        createdUsers["MOCK_hai"] = coo._id.toString();

        const cmo = new UserModel({
          ...mockEmployees[1],
          companyCode,
          companyName,
          password: await bcrypt.hash("123456", 10),
        });
        await cmo.save();
        createdUsers["MOCK_anh"] = cmo._id.toString();

        // Tạo các phòng ban
        const lpKv = new UserModel({
          ...mockEmployees[2],
          companyCode,
          companyName,
          password: await bcrypt.hash("123456", 10),
          parentId: createdUsers["MOCK_hai"],
        });
        await lpKv.save();
        createdUsers["MOCK_huy"] = lpKv._id.toString();

        const lpMkt = new UserModel({
          ...mockEmployees[3],
          companyCode,
          companyName,
          password: await bcrypt.hash("123456", 10),
          parentId: createdUsers["MOCK_anh"],
        });
        await lpMkt.save();
        createdUsers["MOCK_tuan"] = lpMkt._id.toString();

        const lpSales = new UserModel({
          ...mockEmployees[4],
          companyCode,
          companyName,
          password: await bcrypt.hash("123456", 10),
          parentId: createdUsers["MOCK_hai"],
        });
        await lpSales.save();
        createdUsers["MOCK_vy"] = lpSales._id.toString();

        // Tạo cấp dưới trực thuộc
        const cvVc = new UserModel({
          ...mockEmployees[5],
          companyCode,
          companyName,
          password: await bcrypt.hash("123456", 10),
          parentId: createdUsers["MOCK_huy"],
        });
        await cvVc.save();

        const aiCopy = new UserModel({
          ...mockEmployees[6],
          companyCode,
          companyName,
          password: await bcrypt.hash("123456", 10),
          parentId: createdUsers["MOCK_tuan"],
        });
        await aiCopy.save();

        const csKh = new UserModel({
          ...mockEmployees[7],
          companyCode,
          companyName,
          password: await bcrypt.hash("123456", 10),
          parentId: createdUsers["MOCK_vy"],
        });
        await csKh.save();

        users = await UserModel.find(filter).select("-password").sort({ createdAt: -1 });
      }
    }

    return users;
  },

  /**
   * Lấy danh sách tất cả doanh nghiệp
   */
  async getAllCompanies(): Promise<ICompany[]> {
    return await CompanyModel.find({}).sort({ createdAt: -1 });
  },

  /**
   * Cập nhật thông tin doanh nghiệp (Superadmin only)
   */
  async updateCompany(
    companyId: string,
    updateData: { name?: string; code?: string; ownerEmail?: string; enabledModules?: string[] },
  ): Promise<ICompany> {
    const company = await CompanyModel.findById(companyId);
    if (!company) {
      throw new Error("Không tìm thấy doanh nghiệp trên hệ thống.");
    }

    const oldCode = company.code;
    const oldName = company.name;

    const newCode = updateData.code ? updateData.code.toUpperCase().trim() : undefined;
    const newName = updateData.name ? updateData.name.trim() : undefined;
    const newOwnerEmail = updateData.ownerEmail ? updateData.ownerEmail.toLowerCase().trim() : undefined;
    const businessType = resolveBusinessType(company.businessType);
    const newEnabledModules = resolveCompanyModuleUpdate({
      ...updateData,
      businessType: company.businessType,
    });

    // 1. Nếu có thay đổi mã doanh nghiệp, kiểm tra tính duy nhất
    if (newCode && newCode !== oldCode) {
      const existingCompany = await CompanyModel.findOne({ code: newCode });
      if (existingCompany) {
        throw new Error(`Mã doanh nghiệp "${newCode}" đã tồn tại trên hệ thống.`);
      }
    }

    // 2. Cập nhật cơ sở dữ liệu cascade nếu thay đổi mã hoặc tên doanh nghiệp
    if ((newCode && newCode !== oldCode) || (newName && newName !== oldName)) {
      const codeToUse = newCode || oldCode;
      const nameToUse = newName || oldName;

      // Cập nhật Users
      if (newCode && newCode !== oldCode) {
        await UserModel.updateMany(
          { companyCode: oldCode },
          { $set: { companyCode: newCode, companyName: nameToUse } },
        );
      } else if (newName && newName !== oldName) {
        await UserModel.updateMany({ companyCode: oldCode }, { $set: { companyName: newName } });
      }

      // Nếu thay đổi code, cập nhật tất cả các collection khác
      if (newCode && newCode !== oldCode) {
        const { TrainingEnrollmentModel } = require("../model/training-enrollment.model");
        const { TrainingCourseModel } = require("../model/training-course.model");
        const { ProjectModel } = require("../model/project.model");
        const { KanbanTaskModel } = require("../model/kanban-task.model");

        await Promise.all([
          TrainingEnrollmentModel.updateMany({ companyCode: oldCode }, { $set: { companyCode: newCode } }),
          TrainingCourseModel.updateMany({ companyCode: oldCode }, { $set: { companyCode: newCode } }),
          ProjectModel.updateMany({ companyCode: oldCode }, { $set: { companyCode: newCode } }),
          KanbanTaskModel.updateMany({ companyCode: oldCode }, { $set: { companyCode: newCode } }),
          RolePermissionModel.updateMany({ companyCode: oldCode }, { $set: { companyCode: newCode } }),
        ]);
      }
    }

    // 3. Thực hiện lưu thông tin doanh nghiệp
    if (newName !== undefined) company.name = newName;
    if (newCode !== undefined) company.code = newCode;
    if (newOwnerEmail !== undefined) company.ownerEmail = newOwnerEmail;
    if (newEnabledModules !== undefined) {
      company.enabledModules = newEnabledModules;
      company.businessType = businessType;
    }

    const savedCompany = await company.save();
    clearModuleCache(oldCode);
    clearModuleCache(savedCompany.code);
    return savedCompany;
  },

  async getCompanyDriveConfig(companyCode: string): Promise<any> {
    const normalizedCode = String(companyCode || "")
      .trim()
      .toUpperCase();
    const company = await CompanyModel.findOne({ code: normalizedCode });
    if (!company) {
      throw new Error("Không tìm thấy doanh nghiệp trên hệ thống.");
    }
    return {
      companyCode: company.code,
      companyName: company.name,
      driveFolderLink: company.driveFolderLink || "",
      driveFolderId: company.driveFolderId || "",
      driveConnected: !!company.driveOAuth?.refreshToken,
      driveConnectedEmail: company.driveOAuth?.connectedEmail || "",
    };
  },

  /** Lưu OAuth Google Drive sau khi công ty kết nối thành công. */
  async saveDriveOAuth(companyCode: string, data: { refreshToken: string; email: string }): Promise<any> {
    const normalizedCode = String(companyCode || "")
      .trim()
      .toUpperCase();
    const company = await CompanyModel.findOne({ code: normalizedCode });
    if (!company) {
      throw new Error("Không tìm thấy doanh nghiệp trên hệ thống.");
    }
    company.driveOAuth = {
      refreshToken: data.refreshToken,
      connectedEmail: data.email || "",
      connectedAt: new Date(),
    };
    // Reset thư mục để tạo mới trong tài khoản vừa kết nối (nếu đổi tài khoản)
    company.driveFolderId = "";
    company.driveFolderLink = "";
    await company.save();
    return this.getCompanyDriveConfig(normalizedCode);
  },

  /** Ngắt kết nối Google Drive của doanh nghiệp. */
  async disconnectDrive(companyCode: string): Promise<any> {
    const normalizedCode = String(companyCode || "")
      .trim()
      .toUpperCase();
    const company = await CompanyModel.findOne({ code: normalizedCode });
    if (!company) {
      throw new Error("Không tìm thấy doanh nghiệp trên hệ thống.");
    }
    company.driveOAuth = { refreshToken: "", connectedEmail: "", connectedAt: null };
    company.driveFolderId = "";
    company.driveFolderLink = "";
    await company.save();
    return this.getCompanyDriveConfig(normalizedCode);
  },

  async registerUserForCompany(data: any, callerCompanyCode?: string, callerRole?: string): Promise<IUser> {
    assertPrivilegedRoleAssignment(callerRole, data.role);
    const {
      displayName,
      email,
      password,
      role,
      companyCode,
      companyName,
      parentId,
      level,
      department,
      division,
      phone,
      jobDescriptionLink,
      branchId,
      birthDate,
      qualification,
      monthlySalary,
    } = data;

    const finalCompanyCode = companyCode?.toUpperCase().trim() || "SYSTEM";
    if (role === "admin" && !(await CompanyModel.exists({ code: finalCompanyCode }))) {
      throw new Error("Vui lòng chọn doanh nghiệp tồn tại để tạo Admin.");
    }
    const emailLower = email.toLowerCase().trim();
    const existingUser = await UserModel.findOne({ email: emailLower });
    if (existingUser) {
      throw new Error(`Địa chỉ email "${emailLower}" đã được sử dụng cho một tài khoản khác.`);
    }

    // 1. Xác thực vai trò có tồn tại/hợp lệ
    let targetRoleLevel = DEFAULT_ROLE_LEVELS[role];
    if (targetRoleLevel === undefined) {
      const rolePerm = await RolePermissionModel.findOne({
        companyCode: finalCompanyCode,
        role,
      });
      if (!rolePerm) {
        throw new Error(`Vai trò "${role}" không tồn tại hoặc chưa được thiết lập phân quyền cho doanh nghiệp.`);
      }
      targetRoleLevel = rolePerm.level;
    }

    // 2. Kiểm tra phân cấp cấp bậc (Hierarchy Level Check) của người gán
    if (callerRole && callerRole !== "superadmin") {
      if (callerRole !== "admin") {
        throw new Error("Chỉ Admin hoặc Superadmin mới có quyền thay đổi vai trò của người dùng.");
      }

      const callerRolePerm = await RolePermissionModel.findOne({
        companyCode: callerCompanyCode,
        role: callerRole,
      });
      const callerLevel = callerRolePerm ? callerRolePerm.level : DEFAULT_ROLE_LEVELS[callerRole] || 4;

      if (!canAssignRoleOnUserCreation(callerRole, role, callerLevel, targetRoleLevel)) {
        throw new Error("Bạn không thể gán vai trò có cấp bậc tương đương hoặc cao hơn cấp bậc của bạn.");
      }
    }

    const validBranch = branchId
      ? await BranchModel.findOne({ _id: branchId, companyCode: finalCompanyCode, isActive: true }).lean()
      : null;
    if (branchId && !validBranch) throw new Error("Chi nhánh không hợp lệ hoặc không thuộc công ty.");

    const hashedPassword = await bcrypt.hash(password, 10);
    let finalDept =
      department ||
      (role === "admin"
        ? "Ban Giám Đốc"
        : role === "branch_owner"
          ? "Quản lý chi nhánh"
          : role === "manager"
            ? "Quản lý"
            : "Nhân sự");

    let finalDepartmentId = data.departmentId;
    if (!finalDepartmentId && finalDept) {
      const deptDoc = await DepartmentModel.findOne({
        companyCode: finalCompanyCode,
        name: { $regex: new RegExp(`^${escapeRegex(finalDept.trim())}$`, "i") },
      }).lean();
      if (deptDoc) {
        finalDepartmentId = deptDoc._id.toString();
        finalDept = deptDoc.name;
      }
    }

    const newUser = new UserModel({
      email: emailLower,
      password: hashedPassword,
      displayName: displayName.trim(),
      role,
      companyCode: finalCompanyCode,
      companyName: companyName?.trim(),
      branchId: branchId || undefined,
      parentId: parentId || undefined,
      level: level || (role === "admin" ? 1 : role === "branch_owner" ? 2 : role === "manager" ? 3 : 4),
      departmentId: finalDepartmentId || undefined,
      department: finalDept,
      division:
        division ||
        (role === "admin"
          ? "Ban Giám Đốc"
          : role === "branch_owner"
            ? "Quản lý chi nhánh"
            : role === "manager"
              ? "Quản lý"
              : "Nhân sự"),
      qualification: qualification?.trim() || "",
      jobTitle:
        role === "admin"
          ? "CEO"
          : role === "branch_owner"
            ? "Chủ chi nhánh"
            : role === "manager"
              ? "Quản lý phòng ban"
              : "Nhân viên",
      phone: phone || "Chưa cập nhật",
      jobDescriptionLink: jobDescriptionLink || "",
      monthlySalary: monthlySalary === undefined ? undefined : monthlySalary,
      birthDate: normalizeBirthDate(birthDate) || undefined,
      createdAt: new Date(),
      status: "offline",
      photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName.trim())}&background=random&color=fff`,
      isLeader: data.isLeader || false,
    });

    if (data.isLeader === true && finalDept) {
      await UserModel.updateMany(
        { companyCode: finalCompanyCode, department: finalDept },
        { $set: { isLeader: false } },
      );
    }

    const savedUser = await newUser.save();
    await reconcilePaidHolidayAttendance(finalCompanyCode);
    return savedUser;
  },

  /**
   * Cập nhật thông tin chi tiết một nhân sự (Admin/Superadmin)
   */
  async updateUser(
    userId: string,
    updateData: any,
    callerCompanyCode: string,
    callerRole: string,
  ): Promise<IUser | null> {
    assertPrivilegedRoleAssignment(callerRole, updateData.role);
    const user = await UserModel.findById(userId);
    if (!user) {
      throw new Error("Không tìm thấy người dùng");
    }

    if (updateData.birthDate !== undefined) updateData.birthDate = normalizeBirthDate(updateData.birthDate);

    if (updateData.password !== undefined) {
      if (typeof updateData.password === "string" && updateData.password.trim().length >= 6) {
        updateData.password = await bcrypt.hash(updateData.password.trim(), 10);
      } else {
        delete updateData.password;
      }
    }

    if (callerRole !== "superadmin") {
      delete updateData.companyCode;
      delete updateData.companyName;
      if (user.companyCode !== callerCompanyCode) {
        throw new Error("Bạn không có quyền chỉnh sửa nhân sự của doanh nghiệp khác.");
      }
      if (user.role === "superadmin") {
        throw new Error("Không thể chỉnh sửa tài khoản Superadmin.");
      }

      const callerRolePerm = await RolePermissionModel.findOne({ companyCode: callerCompanyCode, role: callerRole });
      const callerLevel = callerRolePerm ? callerRolePerm.level : DEFAULT_ROLE_LEVELS[callerRole] || 4;

      let currentTargetLevel = DEFAULT_ROLE_LEVELS[user.role];
      if (currentTargetLevel === undefined) {
        const currentTargetPerm = await RolePermissionModel.findOne({ companyCode: user.companyCode, role: user.role });
        currentTargetLevel = currentTargetPerm ? currentTargetPerm.level : 4;
      }

      if (currentTargetLevel <= callerLevel) {
        throw new Error("Bạn không có quyền chỉnh sửa tài khoản có cấp bậc tương đương hoặc cao hơn.");
      }
    }

    if (updateData.branchId !== undefined) {
      const targetCompany = updateData.companyCode || user.companyCode;
      if (updateData.branchId) {
        const validBranch = await BranchModel.findOne({
          _id: updateData.branchId,
          companyCode: targetCompany,
          isActive: true,
        }).lean();
        if (!validBranch) throw new Error("Chi nhánh không hợp lệ hoặc không thuộc công ty.");
      }
    }

    if (updateData.role && callerRole !== "superadmin") {
      if (callerRole !== "admin") {
        throw new Error("Chỉ Admin hoặc Superadmin mới có quyền thay đổi vai trò của người dùng.");
      }

      let targetLevel = DEFAULT_ROLE_LEVELS[updateData.role];
      if (targetLevel === undefined) {
        const targetRolePerm = await RolePermissionModel.findOne({
          companyCode: user.companyCode,
          role: updateData.role,
        });
        if (!targetRolePerm) {
          throw new Error(`Vai trò "${updateData.role}" không tồn tại hoặc chưa được thiết lập cho doanh nghiệp này.`);
        }
        targetLevel = targetRolePerm.level;
      }

      const callerRolePerm = await RolePermissionModel.findOne({ companyCode: callerCompanyCode, role: callerRole });
      const callerLevel = callerRolePerm ? callerRolePerm.level : DEFAULT_ROLE_LEVELS[callerRole] || 4;

      if (targetLevel <= callerLevel) {
        throw new Error("Bạn không thể gán vai trò có cấp bậc tương đương hoặc cao hơn cấp bậc của bạn.");
      }
    }

    if (updateData.department !== undefined) {
      if (updateData.department) {
        const targetCompany = updateData.companyCode || user.companyCode;
        const deptDoc = await DepartmentModel.findOne({
          companyCode: targetCompany,
          name: { $regex: new RegExp(`^${escapeRegex(String(updateData.department).trim())}$`, "i") },
        }).lean();
        if (deptDoc) {
          updateData.departmentId = deptDoc._id.toString();
          updateData.department = deptDoc.name;
        } else if (updateData.departmentId === undefined) {
          updateData.departmentId = null;
        }
      } else {
        updateData.departmentId = null;
      }
    } else if (updateData.departmentId !== undefined) {
      if (updateData.departmentId) {
        const targetCompany = updateData.companyCode || user.companyCode;
        const deptDoc = await DepartmentModel.findOne({
          companyCode: targetCompany,
          _id: updateData.departmentId,
        }).lean();
        if (deptDoc) {
          updateData.department = deptDoc.name;
        }
      } else {
        updateData.department = "";
      }
    }

    if (updateData.isLeader === true) {
      const targetCompany = user.companyCode;
      const targetDept = updateData.department !== undefined ? updateData.department : user.department;
      if (targetDept) {
        await UserModel.updateMany(
          { companyCode: targetCompany, department: targetDept, _id: { $ne: userId } },
          { $set: { isLeader: false } },
        );
      }
    }

    return await UserModel.findByIdAndUpdate(userId, { $set: updateData }, { returnDocument: "after" }).select(
      "-password",
    );
  },

  /**
   * Cập nhật hàng loạt thông tin nhân sự (ví dụ: kéo thả thay đổi sơ đồ)
   */
  async bulkUpdateUsers(updates: any[], callerCompanyCode: string, callerRole: string): Promise<void> {
    for (const update of updates) assertPrivilegedRoleAssignment(callerRole, update.role);
    for (const update of updates) {
      const { id, ...data } = update;
      const user = await UserModel.findById(id);
      if (!user) continue;

      if (callerRole !== "superadmin") {
        delete data.companyCode;
        delete data.companyName;
        if (user.companyCode !== callerCompanyCode) {
          throw new Error("Bạn không có quyền chỉnh sửa nhân sự của doanh nghiệp khác.");
        }
        if (user.role === "superadmin") {
          throw new Error("Không thể chỉnh sửa tài khoản Superadmin.");
        }

        const callerRolePerm = await RolePermissionModel.findOne({ companyCode: callerCompanyCode, role: callerRole });
        const callerLevel = callerRolePerm ? callerRolePerm.level : DEFAULT_ROLE_LEVELS[callerRole] || 4;

        let currentTargetLevel = DEFAULT_ROLE_LEVELS[user.role];
        if (currentTargetLevel === undefined) {
          const currentTargetPerm = await RolePermissionModel.findOne({
            companyCode: user.companyCode,
            role: user.role,
          });
          currentTargetLevel = currentTargetPerm ? currentTargetPerm.level : 4;
        }

        if (currentTargetLevel <= callerLevel) {
          throw new Error("Bạn không có quyền chỉnh sửa tài khoản có cấp bậc tương đương hoặc cao hơn.");
        }
      }

      if (data.role && callerRole !== "superadmin") {
        if (callerRole !== "admin") {
          throw new Error("Chỉ Admin hoặc Superadmin mới có quyền thay đổi vai trò của người dùng.");
        }

        const callerRolePerm = await RolePermissionModel.findOne({ companyCode: callerCompanyCode, role: callerRole });
        const callerLevel = callerRolePerm ? callerRolePerm.level : DEFAULT_ROLE_LEVELS[callerRole] || 4;

        let targetLevel = DEFAULT_ROLE_LEVELS[data.role];
        if (targetLevel === undefined) {
          const targetRolePerm = await RolePermissionModel.findOne({ companyCode: user.companyCode, role: data.role });
          if (!targetRolePerm) {
            throw new Error(`Vai trò "${data.role}" không tồn tại hoặc chưa được thiết lập cho doanh nghiệp này.`);
          }
          targetLevel = targetRolePerm.level;
        }

        if (targetLevel <= callerLevel) {
          throw new Error("Bạn không thể gán vai trò có cấp bậc tương đương hoặc cao hơn cấp bậc của bạn.");
        }
      }

      if (data.department !== undefined) {
        if (data.department) {
          const deptDoc = await DepartmentModel.findOne({
            companyCode: user.companyCode,
            name: { $regex: new RegExp(`^${escapeRegex(String(data.department).trim())}$`, "i") },
          }).lean();
          if (deptDoc) {
            data.departmentId = deptDoc._id.toString();
            data.department = deptDoc.name;
          } else if (data.departmentId === undefined) {
            data.departmentId = null;
          }
        } else {
          data.departmentId = null;
        }
      }

      await UserModel.findByIdAndUpdate(id, { $set: data });
    }
  },

  /**
   * Xóa nhân sự và điều chuyển cấp dưới trực thuộc
   */
  async deleteUser(userId: string, callerCompanyCode: string, callerRole: string): Promise<void> {
    const user = await UserModel.findById(userId);
    if (!user) {
      throw new Error("Không tìm thấy người dùng");
    }

    if (callerRole !== "superadmin") {
      if (user.companyCode !== callerCompanyCode) {
        throw new Error("Bạn không có quyền xóa nhân sự của doanh nghiệp khác.");
      }
      if (user.role === "superadmin" || user.role === "admin") {
        throw new Error("Không thể xóa tài khoản Quản trị viên.");
      }
    }

    await archiveHistoricalUser(user);

    const parentId = user.parentId || null;
    let parentLevel = 1;
    if (parentId) {
      const parentUser = await UserModel.findById(parentId);
      parentLevel = parentUser?.level || 1;
    }

    // Cập nhật tất cả cấp dưới trực thuộc của nhân sự bị xóa
    const children = await UserModel.find({ parentId: userId });
    for (const child of children) {
      child.parentId = parentId || undefined;
      child.level = parentLevel + 1;
      await child.save();
    }

    await UserModel.findByIdAndDelete(userId);
  },

  /**
   * Người dùng tự xóa tài khoản của chính mình
   */
  async deleteOwnAccount(
    userId: string,
    password?: string,
  ): Promise<{ deletionStatus: "deleted" | "requested"; dueAt?: Date }> {
    const user = await UserModel.findById(userId);
    if (!user) {
      throw new Error("Không tìm thấy người dùng.");
    }

    if (user.role === "superadmin") {
      throw new Error("Không thể xóa tài khoản Super Admin.");
    }

    if (user.password) {
      if (!password) {
        throw new Error("Vui lòng cung cấp mật khẩu để xác nhận xóa tài khoản.");
      }
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        throw new Error("Mật khẩu xác nhận không chính xác.");
      }
    }

    const { onboardingService, cleanupOnboardingAccount } = await import("./onboarding.service");
    if (user.role === "trial_user" && user.companyCode) {
      const request = await onboardingService.requestDeletion(user);
      return { deletionStatus: "requested", dueAt: request.dueAt };
    }
    if (
      user.role === "admin" &&
      user.companyCode &&
      (await UserModel.countDocuments({ companyCode: user.companyCode, role: "admin", disabledAt: null })) <= 1
    ) {
      const request = await onboardingService.requestDeletion(user);
      return { deletionStatus: "requested", dueAt: request.dueAt };
    }
    if (!user.companyCode) {
      const mongoose = await import("mongoose");
      const session = await mongoose.default.startSession();
      try {
        await session.withTransaction(async () => {
          const locked = await UserModel.findOneAndDelete(
            { _id: userId, companyCode: { $in: [null, ""] }, role: { $ne: "superadmin" } },
            { session },
          );
          if (!locked) throw new Error("Tài khoản đã thay đổi. Vui lòng tải lại trước khi xóa.");
          await cleanupOnboardingAccount(userId, user.email, session);
        });
      } finally {
        await session.endSession();
      }
      return { deletionStatus: "deleted" };
    }
    await archiveHistoricalUser(user);
    await cleanupOnboardingAccount(userId, user.email);

    const parentId = user.parentId || null;
    let parentLevel = 1;
    if (parentId) {
      const parentUser = await UserModel.findById(parentId);
      parentLevel = parentUser?.level || 1;
    }

    // Cập nhật tất cả cấp dưới trực thuộc của nhân sự bị xóa
    const children = await UserModel.find({ parentId: userId });
    for (const child of children) {
      child.parentId = parentId || undefined;
      child.level = parentLevel + 1;
      await child.save();
    }

    const { MobilePushDevice } = await import("../model/mobile-push.model");
    await MobilePushDevice.deleteMany({ uid: userId }).catch(() => {});

    await UserModel.findByIdAndDelete(userId);
    return { deletionStatus: "deleted" };
  },
};
