import Joi from "joi";

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const listSupplierSchema = {
  query: Joi.object({
    search: Joi.string().trim().allow("").optional(),
    activeOnly: Joi.boolean().truthy("true", "1").falsy("false", "0").optional(),
  }),
};

export const getSupplierSchema = {
  params: Joi.object({
    id: Joi.string().regex(objectIdRegex).required().messages({
      "any.required": "Mã nhà cung cấp 'id' là bắt buộc.",
      "string.pattern.base": "Mã nhà cung cấp 'id' không đúng định dạng MongoDB ObjectId.",
    }),
  }),
};

export const createSupplierSchema = {
  body: Joi.object({
    code: Joi.string().trim().uppercase().required().messages({
      "any.required": "Mã nhà cung cấp là bắt buộc.",
      "string.empty": "Mã nhà cung cấp không được để trống.",
    }),
    name: Joi.string().trim().required().messages({
      "any.required": "Tên nhà cung cấp là bắt buộc.",
      "string.empty": "Tên nhà cung cấp không được để trống.",
    }),
    shortName: Joi.string().trim().allow("").optional(),
    contactPerson: Joi.string().trim().allow("").optional(),
    phone: Joi.string().trim().allow("").optional(),
    email: Joi.string().trim().email({ tlds: false }).allow("").optional().messages({
      "string.email": "Email không hợp lệ.",
    }),
    address: Joi.string().trim().allow("").optional(),
    taxCode: Joi.string().trim().allow("").optional(),
    notes: Joi.string().trim().allow("").optional(),
    isActive: Joi.boolean().optional(),
  }),
};

export const updateSupplierSchema = {
  params: Joi.object({
    id: Joi.string().regex(objectIdRegex).required().messages({
      "any.required": "Mã nhà cung cấp 'id' là bắt buộc.",
      "string.pattern.base": "Mã nhà cung cấp 'id' không đúng định dạng MongoDB ObjectId.",
    }),
  }),
  body: Joi.object({
    code: Joi.string().trim().uppercase().optional(),
    name: Joi.string().trim().optional(),
    shortName: Joi.string().trim().allow("").optional(),
    contactPerson: Joi.string().trim().allow("").optional(),
    phone: Joi.string().trim().allow("").optional(),
    email: Joi.string().trim().email({ tlds: false }).allow("").optional().messages({
      "string.email": "Email không hợp lệ.",
    }),
    address: Joi.string().trim().allow("").optional(),
    taxCode: Joi.string().trim().allow("").optional(),
    notes: Joi.string().trim().allow("").optional(),
    isActive: Joi.boolean().optional(),
  }),
};

export const deleteSupplierSchema = {
  params: Joi.object({
    id: Joi.string().regex(objectIdRegex).required().messages({
      "any.required": "Mã nhà cung cấp 'id' là bắt buộc.",
      "string.pattern.base": "Mã nhà cung cấp 'id' không đúng định dạng MongoDB ObjectId.",
    }),
  }),
};
