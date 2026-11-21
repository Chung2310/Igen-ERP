import Joi from "joi";
import { objectIdSchema } from "./worker-project.validation";
import { calendarDateSchema } from "./calendar-date.validation";

export const createQrSessionSchema = Joi.object({
  projectId: objectIdSchema.required().messages({
    "any.required": "Mã dự án là bắt buộc.",
    "string.empty": "Mã dự án không được để trống.",
  }),
  date: calendarDateSchema("ngày điểm danh").required().messages({
    "any.required": "Ngày điểm danh là bắt buộc.",
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
  phone: Joi.string().allow("", null).optional().messages({
    "any.required": "Số điện thoại là bắt buộc.",
  }),
  fingerprint: Joi.string().allow("", null).optional(),
  latitude: Joi.number().min(-90).max(90).optional(),
  longitude: Joi.number().min(-180).max(180).optional(),
});
