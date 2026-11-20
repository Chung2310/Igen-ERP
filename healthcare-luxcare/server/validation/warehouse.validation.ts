import Joi from "joi";

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const listWarehouseSchema = {
  query: Joi.object({
    branchId: Joi.string().trim().allow("").optional(),
    search: Joi.string().trim().allow("").optional(),
    activeOnly: Joi.boolean().truthy("true", "1").falsy("false", "0").optional(),
  }),
};

export const getWarehouseSchema = {
  params: Joi.object({
    id: Joi.string().regex(objectIdRegex).required().messages({
      "any.required": "Mã kho 'id' là bắt buộc.",
      "string.pattern.base": "Mã kho 'id' không đúng định dạng MongoDB ObjectId.",
    }),
  }),
};

export const createWarehouseSchema = {
  body: Joi.object({
    branchId: Joi.string().trim().allow("").optional(),
    code: Joi.string().trim().uppercase().required().messages({
      "any.required": "Mã kho là bắt buộc.",
      "string.empty": "Mã kho không được để trống.",
    }),
    name: Joi.string().trim().required().messages({
      "any.required": "Tên kho là bắt buộc.",
      "string.empty": "Tên kho không được để trống.",
    }),
    location: Joi.string().trim().allow("").optional(),
    managerName: Joi.string().trim().allow("").optional(),
    managerPhone: Joi.string().trim().allow("").optional(),
    description: Joi.string().trim().allow("").optional(),
    isActive: Joi.boolean().optional(),
  }),
};

export const updateWarehouseSchema = {
  params: Joi.object({
    id: Joi.string().regex(objectIdRegex).required().messages({
      "any.required": "Mã kho 'id' là bắt buộc.",
      "string.pattern.base": "Mã kho 'id' không đúng định dạng MongoDB ObjectId.",
    }),
  }),
  body: Joi.object({
    branchId: Joi.string().trim().allow("").optional(),
    code: Joi.string().trim().uppercase().optional(),
    name: Joi.string().trim().optional(),
    location: Joi.string().trim().allow("").optional(),
    managerName: Joi.string().trim().allow("").optional(),
    managerPhone: Joi.string().trim().allow("").optional(),
    description: Joi.string().trim().allow("").optional(),
    isActive: Joi.boolean().optional(),
  }),
};

export const deleteWarehouseSchema = {
  params: Joi.object({
    id: Joi.string().regex(objectIdRegex).required().messages({
      "any.required": "Mã kho 'id' là bắt buộc.",
      "string.pattern.base": "Mã kho 'id' không đúng định dạng MongoDB ObjectId.",
    }),
  }),
};
