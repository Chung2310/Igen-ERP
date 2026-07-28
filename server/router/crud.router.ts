import { Router } from "express";
import Joi from "joi";
import { crudController } from "../controller/crud.controller";
import { validateRequest } from "../middleware/validation";
import { requireAuth, requirePermission } from "../middleware/auth";
import { requireModule } from "../middleware/require-module";
import type { ModuleKey } from "../config/module-keys";

export const crudRouter = Router();

export const CRUD_MODEL_MODULE_MAP: Record<string, ModuleKey> = {
  products: "inventory",
  categories: "inventory",
  "stock-logs": "inventory",
  "kanban-tasks": "hr",
  workflows: "hr",
  projects: "hr",
  "hr-calendar-events": "hr",
  "timekeeping-logs": "hr",
  "training-courses": "hr",
  "training-enrollments": "hr",
};

const crudModuleGuard = (req: any, res: any, next: any) => {
  const moduleKey = CRUD_MODEL_MODULE_MAP[String(req.params.modelName || "").toLowerCase()];
  return moduleKey ? requireModule(moduleKey)(req, res, next) : next();
};

const CRUD_MODEL_READ_PERMISSION: Record<string, string | string[]> = {
  products: "stock:read",
  categories: "stock:read",
  "stock-logs": "stock:read",
  "kanban-tasks": "kanban:read",
  projects: "project:read",
  "hr-calendar-events": "timekeeping:read",
  "timekeeping-logs": ["timekeeping:read", "timekeeping:manage", "payroll:manage"],
  workflows: "hr:read",
  "training-courses": "hr:read",
  "training-enrollments": "hr:read",
  "hr-leave-templates": "hr:read",
  "hr-leave-applications": "hr:read",
  users: "user:read",
};

const CRUD_MODEL_MANAGE_PERMISSION: Record<string, string | string[]> = {
  products: "stock:manage",
  categories: "stock:manage",
  "stock-logs": "stock:manage",
  "kanban-tasks": "kanban:manage",
  projects: "project:manage",
  "hr-calendar-events": "timekeeping:manage",
  "timekeeping-logs": ["timekeeping:manage", "payroll:manage"],
  users: "user:manage",
};

const crudReadPermissionGuard = (req: any, res: any, next: any) => {
  const code = CRUD_MODEL_READ_PERMISSION[String(req.params.modelName || "").toLowerCase()];
  return code ? requirePermission(code)(req, res, next) : next();
};

const crudManagePermissionGuard = (req: any, res: any, next: any) => {
  const modelName = String(req.params.modelName || "").toLowerCase();
  const code = modelName === "timekeeping-logs" && req.method !== "PATCH"
    ? "timekeeping:manage"
    : CRUD_MODEL_MANAGE_PERMISSION[modelName];
  return code ? requirePermission(code)(req, res, next) : next();
};

const SUPPORTED_MODELS = [
  "products",
  "categories",
  "stock-logs",
  "projects",
  "kanban-tasks",
  "training-courses",
  "training-enrollments",
  "workflows",
  "users",
  "hr-calendar-events",
  "hr-leave-templates",
  "hr-leave-applications",
  "timekeeping-logs",
];

const listSchema = {
  params: Joi.object({
    modelName: Joi.string().valid(...SUPPORTED_MODELS).required().messages({
      "any.only": "Tên Model không được hỗ trợ hoặc không hợp lệ.",
      "any.required": "Tên Model là tham số bắt buộc.",
    }),
  }),
  query: Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).optional(),
    sort: Joi.string().optional(),
    search: Joi.string().optional().allow(""),
  }).unknown(true), // Cho phép bộ lọc động khác
};

const getByIdSchema = {
  params: Joi.object({
    modelName: Joi.string().valid(...SUPPORTED_MODELS).required().messages({
      "any.only": "Tên Model không được hỗ trợ hoặc không hợp lệ.",
      "any.required": "Tên Model là tham số bắt buộc.",
    }),
    id: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required().messages({
      "string.pattern.base": "Mã ID tài nguyên phải là định dạng MongoDB ObjectId hợp lệ.",
      "any.required": "Mã ID tài nguyên là bắt buộc.",
    }),
  }),
};

const createSchema = {
  params: Joi.object({
    modelName: Joi.string().valid(...SUPPORTED_MODELS).required().messages({
      "any.only": "Tên Model không được hỗ trợ hoặc không hợp lệ.",
      "any.required": "Tên Model là tham số bắt buộc.",
    }),
  }),
  body: Joi.object().required().messages({
    "object.base": "Dữ liệu gửi lên phải là một đối tượng hợp lệ.",
    "any.required": "Dữ liệu body là bắt buộc.",
  }),
};

const updateSchema = {
  params: Joi.object({
    modelName: Joi.string().valid(...SUPPORTED_MODELS).required().messages({
      "any.only": "Tên Model không được hỗ trợ hoặc không hợp lệ.",
      "any.required": "Tên Model là tham số bắt buộc.",
    }),
    id: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required().messages({
      "string.pattern.base": "Mã ID tài nguyên phải là định dạng MongoDB ObjectId hợp lệ.",
      "any.required": "Mã ID tài nguyên là bắt buộc.",
    }),
  }),
  body: Joi.object().required().messages({
    "object.base": "Dữ liệu gửi lên phải là một đối tượng hợp lệ.",
    "any.required": "Dữ liệu body là bắt buộc.",
  }),
};

const deleteSchema = {
  params: Joi.object({
    modelName: Joi.string().valid(...SUPPORTED_MODELS).required().messages({
      "any.only": "Tên Model không được hỗ trợ hoặc không hợp lệ.",
      "any.required": "Tên Model là tham số bắt buộc.",
    }),
    id: Joi.string().regex(/^[0-9a-fA-F]{24}$/).required().messages({
      "string.pattern.base": "Mã ID tài nguyên phải là định dạng MongoDB ObjectId hợp lệ.",
      "any.required": "Mã ID tài nguyên là bắt buộc.",
    }),
  }),
};

// Đăng ký các API CRUD có bảo vệ bằng requireAuth
crudRouter.get(
  "/:modelName",
  requireAuth as any,
  crudModuleGuard,
  crudReadPermissionGuard,
  validateRequest(listSchema),
  crudController.getList as any
);

crudRouter.get(
  "/:modelName/:id",
  requireAuth as any,
  crudModuleGuard,
  crudReadPermissionGuard,
  validateRequest(getByIdSchema),
  crudController.getById as any
);

crudRouter.post(
  "/:modelName",
  requireAuth as any,
  crudModuleGuard,
  crudManagePermissionGuard,
  validateRequest(createSchema),
  crudController.create as any
);

crudRouter.patch(
  "/:modelName/:id",
  requireAuth as any,
  crudModuleGuard,
  crudManagePermissionGuard,
  validateRequest(updateSchema),
  crudController.update as any
);

crudRouter.delete(
  "/:modelName/:id",
  requireAuth as any,
  crudModuleGuard,
  crudManagePermissionGuard,
  validateRequest(deleteSchema),
  crudController.delete as any
);
