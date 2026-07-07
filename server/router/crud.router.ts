import { Router } from "express";
import Joi from "joi";
import { crudController } from "../controller/crud.controller";
import { validateRequest } from "../middleware/validation";
import { requireAuth } from "../middleware/auth";

import { workflowLinkController } from "../controller/workflow-link.controller";

export const crudRouter = Router();

// Custom endpoints for workflow ↔ kanban-task link
crudRouter.post(
  "/workflows/:id/participants/:participantId/advance",
  requireAuth as any,
  workflowLinkController.advanceParticipant as any
);

crudRouter.get(
  "/workflows/:id/participants/:participantId/tasks",
  requireAuth as any,
  workflowLinkController.getParticipantTasks as any
);

const SUPPORTED_MODELS = [
  "products",
  "categories",
  "stock-logs",
  "crm-tickets",
  "marketing-contents",
  "projects",
  "kanban-tasks",
  "training-courses",
  "training-enrollments",
  "social-integrations",
  "workflows",
  "users",
  "hr-calendar-events",
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
  validateRequest(listSchema),
  crudController.getList as any
);

crudRouter.get(
  "/:modelName/:id",
  requireAuth as any,
  validateRequest(getByIdSchema),
  crudController.getById as any
);

crudRouter.post(
  "/:modelName",
  requireAuth as any,
  validateRequest(createSchema),
  crudController.create as any
);

crudRouter.patch(
  "/:modelName/:id",
  requireAuth as any,
  validateRequest(updateSchema),
  crudController.update as any
);

crudRouter.delete(
  "/:modelName/:id",
  requireAuth as any,
  validateRequest(deleteSchema),
  crudController.delete as any
);
