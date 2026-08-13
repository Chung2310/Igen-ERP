import Joi from "joi";

export const createCourseSchema = Joi.object({
  companyCode: Joi.string().trim().min(1).optional(),
  code: Joi.string().required().messages({
    "any.required": "Mã khóa học là bắt buộc.",
    "string.empty": "Mã khóa học không được để trống.",
  }),
  title: Joi.string().required().messages({
    "any.required": "Tên khóa học là bắt buộc.",
    "string.empty": "Tên khóa học không được để trống.",
  }),
  category: Joi.string().required().messages({
    "any.required": "Danh mục khóa học là bắt buộc.",
    "string.empty": "Danh mục khóa học không được để trống.",
  }),
  fee: Joi.string().allow("").optional(),
  duration: Joi.string().required().messages({
    "any.required": "Số buổi học là bắt buộc.",
  }),
  maxLearners: Joi.number().min(1).optional(),
  activeBatches: Joi.number().min(0).optional(),
  status: Joi.string().valid("Hoạt động", "Tạm dừng").optional(),
  customFields: Joi.object().unknown(true).optional(),
});

export const updateCourseSchema = Joi.object({
  expectedVersion: Joi.number().integer().min(0).optional(),
  code: Joi.string().optional(),
  title: Joi.string().optional(),
  category: Joi.string().optional(),
  fee: Joi.string().allow("").optional(),
  duration: Joi.string().optional(),
  maxLearners: Joi.number().min(1).optional(),
  activeBatches: Joi.number().min(0).optional(),
  status: Joi.string().valid("Hoạt động", "Tạm dừng").optional(),
  customFields: Joi.object().unknown(true).optional(),
});
