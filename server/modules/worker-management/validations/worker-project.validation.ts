import Joi from "joi";

const objectIdPattern = /^[0-9a-fA-F]{24}$/;
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export const objectIdSchema = Joi.string().pattern(objectIdPattern).messages({
  "string.pattern.base": "Định dạng ID không hợp lệ.",
});

export const idParamSchema = Joi.object({
  id: objectIdSchema.required(),
});

export const workerIdParamSchema = Joi.object({
  id: objectIdSchema.required(),
  workerId: objectIdSchema.required(),
});

export const createWorkerProjectSchema = Joi.object({
  code: Joi.string().required().messages({
    "any.required": "Mã dự án là bắt buộc.",
    "string.empty": "Mã dự án không được để trống.",
  }),
  name: Joi.string().trim().required().messages({
    "any.required": "Tên dự án là bắt buộc.",
    "string.empty": "Tên dự án không được để trống.",
  }),
  quota: Joi.number().integer().min(0).optional(),
  workerIds: Joi.array().items(objectIdSchema).optional(),
  daysOfWeek: Joi.array().items(Joi.number().integer().min(0).max(6)).optional(),
  startTime: Joi.string().pattern(timePattern).optional().messages({
    "string.pattern.base": "Giờ bắt đầu phải có định dạng HH:mm.",
  }),
  endTime: Joi.string().pattern(timePattern).optional().messages({
    "string.pattern.base": "Giờ kết thúc phải có định dạng HH:mm.",
  }),
  location: Joi.string().allow("", null).optional(),
  geoLocation: Joi.object({
    latitude: Joi.number().min(-90).max(90).required().messages({
      "any.required": "Vĩ độ là bắt buộc.",
    }),
    longitude: Joi.number().min(-180).max(180).required().messages({
      "any.required": "Kinh độ là bắt buộc.",
    }),
    radiusMeters: Joi.number().integer().min(10).max(20000).required().messages({
      "any.required": "Bán kính là bắt buộc.",
    }),
  }).allow(null).optional(),
  startDate: Joi.string().pattern(datePattern).optional().messages({
    "string.pattern.base": "Ngày bắt đầu phải có định dạng YYYY-MM-DD.",
  }),
  endDate: Joi.string().pattern(datePattern).optional().messages({
    "string.pattern.base": "Ngày kết thúc phải có định dạng YYYY-MM-DD.",
  }),
  status: Joi.string().valid("planned", "active", "completed").optional(),
  note: Joi.string().allow("", null).optional(),
});

export const updateWorkerProjectSchema = Joi.object({
  code: Joi.string().optional(),
  name: Joi.string().trim().optional(),
  quota: Joi.number().integer().min(0).optional(),
  workerIds: Joi.array().items(objectIdSchema).optional(),
  daysOfWeek: Joi.array().items(Joi.number().integer().min(0).max(6)).optional(),
  startTime: Joi.string().pattern(timePattern).optional(),
  endTime: Joi.string().pattern(timePattern).optional(),
  location: Joi.string().allow("", null).optional(),
  geoLocation: Joi.object({
    latitude: Joi.number().min(-90).max(90).required(),
    longitude: Joi.number().min(-180).max(180).required(),
    radiusMeters: Joi.number().integer().min(10).max(20000).required(),
  }).allow(null).optional(),
  startDate: Joi.string().pattern(datePattern).optional(),
  endDate: Joi.string().pattern(datePattern).optional(),
  status: Joi.string().valid("planned", "active", "completed").optional(),
  note: Joi.string().allow("", null).optional(),
});

export const addWorkerSchema = Joi.object({
  workerId: objectIdSchema.required().messages({
    "any.required": "Mã nhân công là bắt buộc.",
    "string.empty": "Mã nhân công không được để trống.",
  }),
});
