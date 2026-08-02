import Joi from "joi";

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export const createResourceSchema = Joi.object({
  companyCode: Joi.string().trim().min(1).optional(),
  name: Joi.string().required().messages({
    "any.required": "Tên tài nguyên là bắt buộc.",
    "string.empty": "Tên tài nguyên không được để trống.",
  }),
  type: Joi.string().required().messages({
    "any.required": "Loại tài nguyên là bắt buộc.",
    "string.empty": "Loại tài nguyên không được để trống.",
  }),
  identifier: Joi.string().required().messages({
    "any.required": "Mã định danh (số phòng/biển số/serial) là bắt buộc.",
  }),
  capacity: Joi.string().required().messages({
    "any.required": "Sức chứa là bắt buộc.",
  }),
  status: Joi.string().valid("AVAILABLE", "OCCUPIED", "MAINTENANCE").optional(),
  customFields: Joi.object().unknown(true).optional(),
});

export const updateResourceSchema = Joi.object({
  expectedVersion: Joi.number().integer().min(0).optional(),
  name: Joi.string().optional(),
  type: Joi.string().optional(),
  identifier: Joi.string().optional(),
  capacity: Joi.string().optional(),
  status: Joi.string().valid("AVAILABLE", "OCCUPIED", "MAINTENANCE").optional(),
  customFields: Joi.object().unknown(true).optional(),
});

export const createBookingSchema = Joi.object({
  purpose: Joi.string().required().messages({
    "any.required": "Mục đích sử dụng là bắt buộc.",
  }),
  by: Joi.string().required().messages({
    "any.required": "Người đăng ký là bắt buộc.",
  }),
  date: Joi.string().pattern(datePattern).required().messages({
    "any.required": "Ngày sử dụng là bắt buộc.",
    "string.pattern.base": "Ngày phải theo định dạng YYYY-MM-DD.",
  }),
  startTime: Joi.string().pattern(timePattern).required().messages({
    "any.required": "Giờ bắt đầu là bắt buộc.",
    "string.pattern.base": "Giờ bắt đầu phải theo định dạng HH:mm.",
  }),
  endTime: Joi.string().pattern(timePattern).required().messages({
    "any.required": "Giờ kết thúc là bắt buộc.",
    "string.pattern.base": "Giờ kết thúc phải theo định dạng HH:mm.",
  }),
});
