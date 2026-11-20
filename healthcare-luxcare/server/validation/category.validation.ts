import Joi from "joi";

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const listCategorySchema = {
  query: Joi.object({
    search: Joi.string().trim().allow("").optional(),
    activeOnly: Joi.boolean().truthy("true", "1").falsy("false", "0").optional(),
  }),
};

export const getCategorySchema = {
  params: Joi.object({
    id: Joi.string().regex(objectIdRegex).required().messages({
      "any.required": "Mã phân loại 'id' là bắt buộc.",
      "string.pattern.base": "Mã phân loại 'id' không đúng định dạng MongoDB ObjectId.",
    }),
  }),
};

export const createCategorySchema = {
  body: Joi.object({
    code: Joi.string().trim().uppercase().required().messages({
      "any.required": "Mã phân loại là bắt buộc.",
      "string.empty": "Mã phân loại không được để trống.",
    }),
    name: Joi.string().trim().required().messages({
      "any.required": "Tên phân loại là bắt buộc.",
      "string.empty": "Tên phân loại không được để trống.",
    }),
    description: Joi.string().trim().allow("").optional(),
    color: Joi.string().trim().allow("").optional(),
    icon: Joi.string().trim().allow("").optional(),
    isActive: Joi.boolean().optional(),
  }),
};

export const updateCategorySchema = {
  params: Joi.object({
    id: Joi.string().regex(objectIdRegex).required().messages({
      "any.required": "Mã phân loại 'id' là bắt buộc.",
      "string.pattern.base": "Mã phân loại 'id' không đúng định dạng MongoDB ObjectId.",
    }),
  }),
  body: Joi.object({
    code: Joi.string().trim().uppercase().optional(),
    name: Joi.string().trim().optional(),
    description: Joi.string().trim().allow("").optional(),
    color: Joi.string().trim().allow("").optional(),
    icon: Joi.string().trim().allow("").optional(),
    isActive: Joi.boolean().optional(),
  }),
};

export const deleteCategorySchema = {
  params: Joi.object({
    id: Joi.string().regex(objectIdRegex).required().messages({
      "any.required": "Mã phân loại 'id' là bắt buộc.",
      "string.pattern.base": "Mã phân loại 'id' không đúng định dạng MongoDB ObjectId.",
    }),
  }),
};
