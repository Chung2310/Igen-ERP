import { Router } from "express";
import Joi from "joi";
import { authController } from "../controller/auth.controller";
import { requireAuth, requireRole } from "../middleware/auth";
import { validateRequest } from "../middleware/validation";

export const authRouter = Router();

const registerSchema = {
  body: Joi.object({
    email: Joi.string().email().required().messages({
      "any.required": "Trường 'email' là bắt buộc và không thể thiếu.",
      "string.empty": "Trường 'email' không được để trống.",
      "string.email": "Định dạng 'email' không hợp lệ.",
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
    role: Joi.string().valid("user", "manager", "admin", "superadmin").optional().messages({
      "any.only": "Vai trò người dùng không hợp lệ.",
    }),
    companyCode: Joi.string().optional().allow(""),
    companyName: Joi.string().optional().allow(""),
    jobTitle: Joi.string().optional().allow(""),
    department: Joi.string().optional().allow(""),
    division: Joi.string().optional().allow(""),
    phone: Joi.string().optional().allow(""),
    level: Joi.number().integer().optional(),
    parentId: Joi.string().optional().allow(""),
  }),
};

const loginSchema = {
  body: Joi.object({
    email: Joi.string().email().required().messages({
      "any.required": "Trường 'email' là bắt buộc và không thể thiếu.",
      "string.empty": "Trường 'email' không được để trống.",
      "string.email": "Định dạng 'email' không hợp lệ.",
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
      connectedAt: Joi.date().optional(),
      privacyLevel: Joi.string().optional(),
      isMock: Joi.boolean().optional(),
    }).optional().allow(null),
  }),
};

// Đăng ký tài khoản mới
authRouter.post("/register", validateRequest(registerSchema), authController.register);

// Đăng nhập tài khoản
authRouter.post("/login", validateRequest(loginSchema), authController.login);

// Làm mới Access Token bằng Refresh Token
authRouter.post("/refresh-token", authController.refreshToken);

// Đăng xuất tài khoản
authRouter.post("/logout", authController.logout);

// Lấy thông tin tài khoản hiện tại (yêu cầu Access Token)
authRouter.get("/me", requireAuth as any, authController.getMe as any);

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
authRouter.post("/change-password", requireAuth as any, validateRequest(changePasswordSchema), authController.changePassword as any);

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
    ownerEmail: Joi.string().email().required().messages({
      "any.required": "Email người đại diện là bắt buộc.",
      "string.empty": "Email không được để trống.",
      "string.email": "Email không đúng định dạng.",
    }),
    ownerPassword: Joi.string().min(6).required().messages({
      "any.required": "Mật khẩu là bắt buộc.",
      "string.empty": "Mật khẩu không được để trống.",
      "string.min": "Mật khẩu phải có ít nhất 6 ký tự.",
    }),
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
    email: Joi.string().email().required().messages({
      "any.required": "Email thành viên là bắt buộc.",
      "string.empty": "Email không được để trống.",
      "string.email": "Email không đúng định dạng.",
    }),
    password: Joi.string().min(6).required().messages({
      "any.required": "Mật khẩu là bắt buộc.",
      "string.empty": "Mật khẩu không được để trống.",
      "string.min": "Mật khẩu phải có ít nhất 6 ký tự.",
    }),
    role: Joi.string().valid("user", "manager", "admin").required().messages({
      "any.required": "Vai trò thành viên là bắt buộc.",
      "any.only": "Vai trò thành viên không hợp lệ.",
    }),
    companyCode: Joi.string().optional().allow(""),
    companyName: Joi.string().optional().allow(""),
    parentId: Joi.string().optional().allow(""),
    level: Joi.number().integer().optional(),
    department: Joi.string().optional().allow(""),
    division: Joi.string().optional().allow(""),
    phone: Joi.string().optional().allow(""),
  }),
};

// Đăng ký thành viên mới của doanh nghiệp (yêu cầu Access Token và vai trò superadmin hoặc admin)
authRouter.post("/register-user", requireAuth as any, requireRole(["superadmin", "admin"]) as any, validateRequest(registerUserSchema), authController.registerUser as any);
