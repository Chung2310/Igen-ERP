import Joi from "joi";
import { objectIdSchema } from "./worker-project.validation";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export const markAttendanceSchema = Joi.object({
  projectId: objectIdSchema.required().messages({
    "any.required": "Mã dự án là bắt buộc.",
    "string.empty": "Mã dự án không được để trống.",
  }),
  workerId: objectIdSchema.required().messages({
    "any.required": "Mã nhân công là bắt buộc.",
    "string.empty": "Mã nhân công không được để trống.",
  }),
  latitude: Joi.number().min(-90).max(90).optional(),
  longitude: Joi.number().min(-180).max(180).optional(),
  deviceInfo: Joi.string().allow("", null).optional(),
});

export const listAttendanceQuerySchema = Joi.object({
  projectId: objectIdSchema.required().messages({
    "any.required": "Mã dự án là bắt buộc.",
    "string.empty": "Mã dự án không được để trống.",
  }),
  from: Joi.string().pattern(datePattern).optional().messages({
    "string.pattern.base": "Định dạng ngày bắt đầu phải là YYYY-MM-DD.",
  }),
  to: Joi.string().pattern(datePattern).optional().messages({
    "string.pattern.base": "Định dạng ngày kết thúc phải là YYYY-MM-DD.",
  }),
  date: Joi.string().pattern(datePattern).optional().messages({
    "string.pattern.base": "Định dạng ngày phải là YYYY-MM-DD.",
  }),
});

export const adjustAttendanceSchema = Joi.object({
  checkInAt: Joi.string().isoDate().allow(null).optional().messages({
    "string.isoDate": "Giờ vào phải là chuỗi định dạng ISO date hợp lệ.",
  }),
  checkOutAt: Joi.string().isoDate().allow(null).optional().messages({
    "string.isoDate": "Giờ về phải là chuỗi định dạng ISO date hợp lệ.",
  }),
  note: Joi.string().allow("", null).optional(),
});
