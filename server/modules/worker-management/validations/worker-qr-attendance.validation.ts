import Joi from "joi";
import { objectIdSchema } from "./worker-project.validation";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export const createQrSessionSchema = Joi.object({
  projectId: objectIdSchema.required().messages({
    "any.required": "Mã dự án là bắt buộc.",
    "string.empty": "Mã dự án không được để trống.",
  }),
  date: Joi.string().pattern(datePattern).required().messages({
    "any.required": "Ngày điểm danh là bắt buộc.",
    "string.pattern.base": "Định dạng ngày điểm danh phải là YYYY-MM-DD.",
  }),
  durationMinutes: Joi.number().integer().min(1).max(1440).optional(),
});

export const sessionIdParamSchema = Joi.object({
  sessionId: Joi.string().required().messages({
    "any.required": "Mã phiên điểm danh là bắt buộc.",
  }),
});

export const workerQrCheckinSchema = Joi.object({
  token: Joi.string().required().messages({
    "any.required": "Token mã QR là bắt buộc.",
  }),
  phone: Joi.string().required().messages({
    "any.required": "Số điện thoại là bắt buộc.",
  }),
  fingerprint: Joi.string().allow("", null).optional(),
  latitude: Joi.number().min(-90).max(90).optional(),
  longitude: Joi.number().min(-180).max(180).optional(),
});
