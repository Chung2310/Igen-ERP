import { Router } from "express";
import Joi from "joi";
import { authController } from "../controller/auth.controller";
import { requireAuth, requireRole, requirePermission, requireCompanyAccess, requireHierarchyAccess } from "../middleware/auth";
import { validateRequest } from "../middleware/validation";
import { authRateLimiter, loginAccountRateLimiter, refreshTokenRateLimiter } from "../middleware/rate-limit";
import { UserModel } from "../model/user.model";
import { branchController } from "../controller/branch.controller";

export const authRouter = Router();

// Định nghĩa regex cho email và số điện thoại Việt Nam
const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const vnPhoneRegex = /^(0|\+84|84)(3|5|7|8|9)[0-9]{8}$/;

const branchFields = {
  code: Joi.string().trim().min(1).max(32).pattern(/^[A-Za-z0-9_-]+$/).required(),
  name: Joi.string().trim().min(1).max(120).required(),
  address: Joi.string().trim().max(255).allow("").optional(),
  phone: Joi.string().trim().max(32).allow("").optional(),
  managerId: Joi.string().trim().max(64).allow("").optional(),
  locationConfig: Joi.object().unknown(true).optional(),
  isActive: Joi.boolean().optional(),
};
const createBranchSchema = { body: Joi.object(branchFields).unknown(false) };
const updateBranchSchema = { body: Joi.object({ ...branchFields, code: branchFields.code.optional(), name: branchFields.name.optional() }).min(1).unknown(false) };
const registerSchema = {
  body: Joi.object({
    email: Joi.string().pattern(emailRegex).required().messages({
      "any.required": "Trường 'email' là bắt buộc và không thể thiếu.",
      "string.empty": "Trường 'email' không được để trống.",
      "string.pattern.base": "Địa chỉ email không đúng định dạng.",
    }),
    password: Joi.string().min(6).required().messages({
      "any.required": "Trường 'password' là bắt buộc và không thể thiếu.",
      "string.empty": "Trường 'password' không được để trống.",
      "string.min": "Mật khẩu phải có ít nhất 6 ký tự.",
    }),
    displayName: Joi.string().required().messages({
      "any.required": "Trường 'displayName' là bắt buộc và không thể thiếu.",
      "string.empty": "Trường 'displayName' không được để trống.",
    }),
    photoURL: Joi.string().uri().optional().allow("").messages({
      "string.uri": "photoURL phải là một đường dẫn URL hợp lệ.",
    }),
    // Lưu ý bảo mật: KHÔNG cho phép client tự đặt role/companyCode/level/parentId qua
    // endpoint đăng ký công khai này — các trường đó chỉ được gán qua
    // register-company/register-user (đã kiểm tra xác thực + phân quyền).
    companyName: Joi.string().optional().allow(""),
    branchId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).optional().allow(""),
    jobTitle: Joi.string().optional().allow(""),
    department: Joi.string().optional().allow(""),
    division: Joi.string().optional().allow(""),
    monthlySalary: Joi.number().min(0).optional(),
    phone: Joi.string().pattern(vnPhoneRegex).optional().allow("").messages({
      "string.pattern.base": "Số điện thoại Việt Nam không đúng định dạng (ví dụ: 0987654321).",
    }),
  }),
};

const loginSchema = {
  body: Joi.object({
    email: Joi.string().pattern(emailRegex).required().messages({
      "any.required": "Trường 'email' là bắt buộc và không thể thiếu.",
      "string.empty": "Trường 'email' không được để trống.",
      "string.pattern.base": "Địa chỉ email không đúng định dạng.",
    }),
    password: Joi.string().required().messages({
      "any.required": "Trường 'password' là bắt buộc và không thể thiếu.",
      "string.empty": "Trường 'password' không được để trống.",
    }),
  }),
};

const updateProfileSchema = {
  body: Joi.object({
    displayName: Joi.string().optional().messages({
      "string.empty": "Tên hiển thị không được để trống.",
    }),
    photoURL: Joi.string().uri().optional().allow("").messages({
      "string.uri": "Ảnh đại diện phải là một đường dẫn URL hợp lệ.",
    }),
    facebookIntegration: Joi.object({
      isConnected: Joi.boolean().required(),
      pageId: Joi.string().allow(""),
      pageName: Joi.string().allow(""),
      pageAccessToken: Joi.string().allow(""),
      connectedAt: Joi.date().optional(),
      isMock: Joi.boolean().optional(),
    }).optional().allow(null),
    tiktokIntegration: Joi.object({
      isConnected: Joi.boolean().required(),
      username: Joi.string().allow(""),
      displayName: Joi.string().allow(""),
      avatarUrl: Joi.string().uri().optional().allow(""),
      accessToken: Joi.string().allow(""),
      refreshToken: Joi.string().optional().allow(""),
      tokenExpiredAt: Joi.date().optional().allow(null),
      clientKey: Joi.string().optional().allow(""),
      clientSecret: Joi.string().optional().allow(""),
      scopes: Joi.array().items(Joi.string()).optional(),
      connectedAt: Joi.date().optional(),
      privacyLevel: Joi.string().optional(),
      isMock: Joi.boolean().optional(),
    }).optional().allow(null),
    zaloIntegration: Joi.object({
      isConnected: Joi.boolean().required(),
      oaId: Joi.string().allow(""),
      oaName: Joi.string().allow(""),
      accessToken: Joi.string().allow(""),
      refreshToken: Joi.string().allow(""),
      tokenExpiredAt: Joi.date().optional(),
      connectedAt: Joi.date().optional(),
      isMock: Joi.boolean().optional(),
    }).optional().allow(null),
    aiAutoReplyConfig: Joi.object({
      enabled: Joi.boolean().required(),
      autoClassify: Joi.boolean().required(),
      autoCloseDeal: Joi.boolean().required(),
      autoFeedback: Joi.boolean().required(),
      replyDelay: Joi.number().required(),
      advancedInstructions: Joi.string().allow(""),
      trainingKnowledge: Joi.string().allow(""),
      model: Joi.string().allow("").optional(),
      disabledAt: Joi.string().isoDate().allow(null).optional(),
    }).optional().allow(null),
  }),
};

// Đăng ký tài khoản mới: chặn brute-force theo từng email + backstop theo IP chống spray từ 1 IP.
authRouter.post("/register", loginAccountRateLimiter, authRateLimiter, validateRequest(registerSchema), authController.register);

// Đăng nhập: chặn brute-force theo từng tài khoản đích + backstop theo IP (không khoá oan văn phòng NAT).
authRouter.post("/login", loginAccountRateLimiter, authRateLimiter, validateRequest(loginSchema), authController.login);

// Làm mới Access Token bằng Refresh Token
authRouter.post("/refresh-token", refreshTokenRateLimiter, authController.refreshToken);

// Đăng xuất tài khoản (yêu cầu Access Token)
authRouter.post("/logout", requireAuth as any, authController.logout as any);

// Lấy thông tin tài khoản hiện tại (yêu cầu Access Token)
authRouter.get("/me", requireAuth as any, authController.getMe as any);

authRouter.get("/telegram-link", requireAuth as any, authController.getTelegramLinkStatus as any);
authRouter.post("/telegram-link", requireAuth as any, authController.createTelegramLinkCode as any);
authRouter.delete("/telegram-link", requireAuth as any, authController.unlinkTelegram as any);

// Cập nhật thông tin tài khoản hiện tại (yêu cầu Access Token)
authRouter.patch("/profile", requireAuth as any, validateRequest(updateProfileSchema), authController.updateProfile as any);

const changePasswordSchema = {
  body: Joi.object({
    password: Joi.string().min(6).required().messages({
      "any.required": "Trường 'password' là bắt buộc.",
      "string.empty": "Trường 'password' không được để trống.",
      "string.min": "Mật khẩu phải có ít nhất 6 ký tự.",
    }),
  }),
};

// Thay đổi mật khẩu người dùng hiện tại (yêu cầu Access Token)
authRouter.post("/change-password", authRateLimiter, requireAuth as any, validateRequest(changePasswordSchema), authController.changePassword as any);

const registerCompanySchema = {
  body: Joi.object({
    companyName: Joi.string().required().messages({
      "any.required": "Tên doanh nghiệp là bắt buộc.",
      "string.empty": "Tên doanh nghiệp không được để trống.",
    }),
    companyCode: Joi.string().required().messages({
      "any.required": "Mã doanh nghiệp là bắt buộc.",
      "string.empty": "Mã doanh nghiệp không được để trống.",
    }),
    ownerName: Joi.string().required().messages({
      "any.required": "Tên người đại diện là bắt buộc.",
      "string.empty": "Tên người đại diện không được để trống.",
    }),
    ownerEmail: Joi.string().pattern(emailRegex).required().messages({
      "any.required": "Email người đại diện là bắt buộc.",
      "string.empty": "Email không được để trống.",
      "string.pattern.base": "Email người đại diện không đúng định dạng.",
    }),
    ownerPassword: Joi.string().min(6).required().messages({
      "any.required": "Mật khẩu là bắt buộc.",
      "string.empty": "Mật khẩu không được để trống.",
      "string.min": "Mật khẩu phải có ít nhất 6 ký tự.",
    }),
    enabledModules: Joi.array().items(Joi.string()).optional(),
  }),
};

// Đăng ký doanh nghiệp và tài khoản Admin (yêu cầu Access Token và vai trò superadmin)
authRouter.post("/register-company", requireAuth as any, requireRole(["superadmin"]) as any, validateRequest(registerCompanySchema), authController.registerCompany as any);

const registerUserSchema = {
  body: Joi.object({
    displayName: Joi.string().required().messages({
      "any.required": "Tên thành viên là bắt buộc.",
      "string.empty": "Tên thành viên không được để trống.",
    }),
    email: Joi.string().pattern(emailRegex).required().messages({
      "any.required": "Email thành viên là bắt buộc.",
      "string.empty": "Email không được để trống.",
      "string.pattern.base": "Email thành viên không đúng định dạng.",
    }),
    password: Joi.string().min(6).required().messages({
      "any.required": "Mật khẩu là bắt buộc.",
      "string.empty": "Mật khẩu không được để trống.",
      "string.min": "Mật khẩu phải có ít nhất 6 ký tự.",
    }),
    role: Joi.string().required().messages({
      "any.required": "Vai trò thành viên là bắt buộc.",
    }),
    companyCode: Joi.string().optional().allow(""),
    companyName: Joi.string().optional().allow(""),
    parentId: Joi.string().optional().allow(""),
    level: Joi.number().integer().optional(),
    department: Joi.string().optional().allow(""),
    division: Joi.string().optional().allow(""),
    heygenAccess: Joi.object({
      avatarIds: Joi.array().items(Joi.string().allow("")).optional(),
      avatarId: Joi.string().optional().allow(""),
      voiceId: Joi.string().optional().allow(""),
      apiKey: Joi.string().optional().allow(""),
    }).optional(),
    monthlySalary: Joi.number().min(0).optional(),
    birthDate: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional().allow("", null),
    phone: Joi.string().pattern(vnPhoneRegex).optional().allow("").messages({
      "string.pattern.base": "Số điện thoại Việt Nam không đúng định dạng (ví dụ: 0987654321).",
    }),
  }),
};

// Đăng ký thành viên mới của doanh nghiệp (yêu cầu Access Token và quyền user:manage)
authRouter.post("/register-user", requireAuth as any, requirePermission("user:manage") as any, validateRequest(registerUserSchema), authController.registerUser as any);

const getUsersSchema = {
  query: Joi.object({
    companyCode: Joi.string().optional().allow(""),
    branchId: Joi.string().optional().allow(""),
  }),
};

// Lấy danh sách thành viên cùng công ty cho tất cả user (để dùng trong tính năng chia sẻ tài nguyên, chat...)
authRouter.get("/users/colleagues", requireAuth as any, authController.getColleagues as any);

// Lấy danh sách thành viên doanh nghiệp (yêu cầu Access Token và quyền user:read)
// hr:read cũng được chấp nhận: xem danh sách nhân sự là một phần tự nhiên của "Xem nhân sự"
// (sơ đồ tổ chức, lịch, giao việc trong module HR đều cần roster này để hiển thị).
authRouter.get("/users", requireAuth as any, requirePermission(["user:read", "hr:read"]) as any, validateRequest(getUsersSchema), authController.getUsers as any);

// Lấy danh sách tất cả doanh nghiệp (yêu cầu Access Token và vai trò superadmin)
authRouter.get("/companies", requireAuth as any, requireRole(["superadmin"]) as any, authController.getCompanies as any);
authRouter.get("/branches", requireAuth as any, requirePermission(["user:read", "hr:read"]) as any, branchController.list as any);
authRouter.post("/branches", requireAuth as any, requirePermission("user:manage") as any, validateRequest(createBranchSchema), branchController.create as any);
authRouter.patch("/branches/:id", requireAuth as any, requirePermission("user:manage") as any, validateRequest(updateBranchSchema), branchController.update as any);

const updateCompanySchema = {
  params: Joi.object({
    id: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required(),
  }),
  body: Joi.object({
    enabledModules: Joi.array().items(Joi.string()).optional(),
    name: Joi.string().optional().allow(""),
    code: Joi.string().optional().allow(""),
    ownerEmail: Joi.string().pattern(emailRegex).optional().allow("").messages({
      "string.pattern.base": "Email chủ doanh nghiệp không đúng định dạng.",
    }),
  }),
};

const companyCodeParamSchema = {
  params: Joi.object({
    code: Joi.string().min(1).required(),
  }),
};

const updateCompanyHeyGenSchema = {
  params: companyCodeParamSchema.params,
  body: Joi.object({
    apiKey: Joi.string().allow("").optional(),
    defaultAvatarId: Joi.string().allow("").optional(),
    defaultVoiceId: Joi.string().allow("").optional(),
    isConnected: Joi.boolean().optional(),
    connectedAt: Joi.date().optional().allow(null),
    lastSyncAt: Joi.date().optional().allow(null),
  }),
};

const testCompanyHeyGenSchema = {
  params: companyCodeParamSchema.params,
  body: Joi.object({
    apiKey: Joi.string().allow("").optional(),
  }),
};

authRouter.patch(
  "/companies/:id",
  requireAuth as any,
  requireRole(["superadmin"]) as any,
  validateRequest(updateCompanySchema),
  authController.updateCompany as any
);




// Google Drive per-company qua OAuth (Quản lý tài nguyên)
// Lưu ý: callback phải đặt TRƯỚC route "/companies/:code/drive" để không bị nuốt bởi ":code".
authRouter.get(
  "/companies/drive/oauth-callback",
  authController.driveOAuthCallback as any
);

authRouter.get(
  "/companies/:code/drive",
  requireAuth as any,
  validateRequest(companyCodeParamSchema),
  authController.getCompanyDriveConfig as any
);

authRouter.get(
  "/companies/:code/drive/oauth-url",
  requireAuth as any,
  requirePermission("resource:manage") as any,
  validateRequest(companyCodeParamSchema),
  authController.getDriveOAuthUrl as any
);

authRouter.post(
  "/companies/:code/drive/disconnect",
  requireAuth as any,
  requirePermission("resource:manage") as any,
  validateRequest(companyCodeParamSchema),
  authController.disconnectDrive as any
);


const bulkUpdateUsersSchema = {
  body: Joi.object({
    updates: Joi.array().items(
      Joi.object({
        id: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required().messages({
          "any.required": "Trường 'id' là bắt buộc đối với mỗi cập nhật.",
          "string.pattern.base": "ID người dùng không đúng định dạng.",
        }),
        parentId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).optional().allow(null, ""),
        level: Joi.number().integer().optional(),
        role: Joi.string().optional(),
        department: Joi.string().optional().allow(""),
        division: Joi.string().optional().allow(""),
        jobTitle: Joi.string().optional().allow(""),
      })
    ).required().messages({
      "any.required": "Danh sách 'updates' là bắt buộc.",
    }),
  }),
};

const updateUserSchema = {
  params: Joi.object({
    id: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required().messages({
      "any.required": "ID người dùng là bắt buộc.",
      "string.pattern.base": "ID người dùng không đúng định dạng.",
    }),
  }),
  body: Joi.object({
    role: Joi.string().optional(),
    parentId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).optional().allow(null, ""),
    level: Joi.number().integer().optional(),
    department: Joi.string().optional().allow(""),
    division: Joi.string().optional().allow(""),
    jobTitle: Joi.string().optional().allow(""),
    displayName: Joi.string().optional().allow(""),
    companyCode: Joi.string().optional().allow(""),
    companyName: Joi.string().optional().allow(""),
    branchId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).optional().allow("", null),
    heygenAccess: Joi.object({
      avatarIds: Joi.array().items(Joi.string().allow("")).optional(),
      avatarId: Joi.string().optional().allow(""),
      voiceId: Joi.string().optional().allow(""),
      apiKey: Joi.string().optional().allow(""),
    }).optional(),
    monthlySalary: Joi.number().min(0).optional(),
    birthDate: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional().allow("", null),
    phone: Joi.string().pattern(vnPhoneRegex).optional().allow("").messages({
      "string.pattern.base": "Số điện thoại Việt Nam không đúng định dạng (ví dụ: 0987654321).",
    }),
  }),
};

const deleteUserSchema = {
  params: Joi.object({
    id: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required().messages({
      "any.required": "ID người dùng cần xóa là bắt buộc.",
      "string.pattern.base": "ID người dùng không đúng định dạng.",
    }),
  }),
};

// Cập nhật cấu trúc sơ đồ tổ chức hàng loạt (yêu cầu Access Token và quyền user:manage)
authRouter.patch("/users/bulk", requireAuth as any, requirePermission("user:manage") as any, validateRequest(bulkUpdateUsersSchema), authController.bulkUpdateUsers as any);

// Cập nhật chi tiết một thành viên (yêu cầu Access Token, quyền user:manage, thuộc cùng công ty và thuộc nhánh quản lý nếu là manager)
authRouter.patch("/users/:id", requireAuth as any, requirePermission("user:manage") as any, requireCompanyAccess(UserModel, "id") as any, requireHierarchyAccess("id") as any, validateRequest(updateUserSchema), authController.updateUser as any);

// Xóa thành viên và điều chuyển cấp dưới (yêu cầu Access Token, quyền user:manage, thuộc cùng công ty và thuộc nhánh quản lý nếu là manager)
authRouter.delete("/users/:id", requireAuth as any, requirePermission("user:manage") as any, requireCompanyAccess(UserModel, "id") as any, requireHierarchyAccess("id") as any, validateRequest(deleteUserSchema), authController.deleteUser as any);
