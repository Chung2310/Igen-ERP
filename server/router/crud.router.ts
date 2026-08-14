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
  "hr-leave-templates": "hr",
  "hr-leave-applications": "hr",
  "timekeeping-logs": "hr",
  "training-courses": "hr",
  "training-enrollments": "hr",
};

const crudModuleGuard = (req: any, res: any, next: any) => {
  const moduleKey = CRUD_MODEL_MODULE_MAP[String(req.params.modelName || "").toLowerCase()];
  return moduleKey ? requireModule(moduleKey)(req, res, next) : next();
};

type CrudPermissionRequirement = string | string[];
type CrudSelfServicePolicy = "self-service";

export const SUPPORTED_CRUD_MODELS = [
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
] as const;

/**
 * Every generic CRUD model has an explicit policy. Leave self-service routes
 * are still authenticated by requireAuth; ownership and approval scope are
 * enforced by crudController.
 */
export const CRUD_MODEL_PERMISSION_POLICY: Record<string, {
  read: CrudPermissionRequirement | CrudSelfServicePolicy;
  manage: CrudPermissionRequirement | CrudSelfServicePolicy;
}> = {
  products: { read: "inventory:read", manage: "inventory:manage" },
  categories: { read: "inventory:read", manage: "inventory:manage" },
  "stock-logs": { read: "inventory:read", manage: "inventory:manage" },
  "kanban-tasks": { read: "work:read", manage: "work:manage" },
  projects: { read: "work:read", manage: "work:manage" },
  "training-courses": { read: "hr:read", manage: "hr:manage" },
  "training-enrollments": { read: "hr:read", manage: "hr:manage" },
  workflows: { read: "hr:read", manage: "hr:manage" },
  users: { read: "access:read", manage: "access:manage" },
  "hr-calendar-events": { read: "timekeeping:read", manage: "timekeeping:manage" },
  "hr-leave-templates": { read: "self-service", manage: "timekeeping:manage" },
  "hr-leave-applications": { read: "self-service", manage: "self-service" },
  "timekeeping-logs": {
    read: ["timekeeping:read", "timekeeping:manage", "payroll:manage"],
    manage: ["timekeeping:manage", "payroll:manage"],
  },
};

const rejectUnknownCrudPolicy = (res: any) => res.status(403).json({
  status: "error",
  message: "Không có chính sách quyền cho model CRUD này.",
});

const runCrudPermissionPolicy = (action: "read" | "manage", req: any, res: any, next: any) => {
  const modelName = String(req.params.modelName || "").toLowerCase();
  const policy = CRUD_MODEL_PERMISSION_POLICY[modelName];
  if (!policy) return rejectUnknownCrudPolicy(res);

  let requirement = policy[action];
  if (modelName === "timekeeping-logs" && action === "manage" && req.method !== "PATCH") {
    requirement = "timekeeping:manage";
  }
  if (requirement === "self-service") return next();
  return requirePermission(requirement)(req, res, next);
};

export const crudReadPermissionGuard = (req: any, res: any, next: any) =>
  runCrudPermissionPolicy("read", req, res, next);

export const crudManagePermissionGuard = (req: any, res: any, next: any) =>
  runCrudPermissionPolicy("manage", req, res, next);

const listSchema = {
  params: Joi.object({
    modelName: Joi.string().valid(...SUPPORTED_CRUD_MODELS).required().messages({
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
    modelName: Joi.string().valid(...SUPPORTED_CRUD_MODELS).required().messages({
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
    modelName: Joi.string().valid(...SUPPORTED_CRUD_MODELS).required().messages({
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
    modelName: Joi.string().valid(...SUPPORTED_CRUD_MODELS).required().messages({
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
    modelName: Joi.string().valid(...SUPPORTED_CRUD_MODELS).required().messages({
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
