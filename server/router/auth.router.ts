import { Router } from "express";
import Joi from "joi";
import { authController } from "../controller/auth.controller";
import { requireAuth, requireRole, requirePermission, requireCompanyAccess, requireHierarchyAccess } from "../middleware/auth";
import { validateRequest } from "../middleware/validation";
import { UserModel } from "../model/user.model";

export const authRouter = Router();

// Định nghĩa regex cho email và số điện thoại Việt Nam
const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const vnPhoneRegex = /^(0|\+84|84)(3|5|7|8|9)[0-9]{8}$/;

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
    role: Joi.string().optional(),
    companyCode: Joi.string().optional().allow(""),
    companyName: Joi.string().optional().allow(""),
    jobTitle: Joi.string().optional().allow(""),
    department: Joi.string().optional().allow(""),
    division: Joi.string().optional().allow(""),
    phone: Joi.string().pattern(vnPhoneRegex).optional().allow("").messages({
      "string.pattern.base": "Số điện thoại Việt Nam không đúng định dạng (ví dụ: 0987654321).",
    }),
    level: Joi.number().integer().optional(),
    parentId: Joi.string().optional().allow(""),
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
  }),
};

// Lấy danh sách thành viên doanh nghiệp (yêu cầu Access Token và quyền user:read)
authRouter.get("/users", requireAuth as any, requirePermission("user:read") as any, validateRequest(getUsersSchema), authController.getUsers as any);

// Lấy danh sách tất cả doanh nghiệp (yêu cầu Access Token và vai trò superadmin)
authRouter.get("/companies", requireAuth as any, requireRole(["superadmin"]) as any, authController.getCompanies as any);

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
