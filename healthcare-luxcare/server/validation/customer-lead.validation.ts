import type { NextFunction, Request, Response } from "express";
import Joi from "joi";

const phoneRegex = /^(0|\+84)[0-9]{8,11}$/;

export const publicCustomerLeadSchema = Joi.object({
  companyCode: Joi.string().trim().uppercase().required().messages({
    "any.required": "Mã doanh nghiệp là bắt buộc",
    "string.empty": "Mã doanh nghiệp không được để trống",
  }),
  branchCode: Joi.string().trim().allow("").optional(),
  branchId: Joi.string().trim().allow("").optional(),
  fullName: Joi.string().trim().min(2).max(100).required().messages({
    "any.required": "Họ và tên là bắt buộc",
    "string.empty": "Vui lòng nhập họ và tên",
    "string.min": "Họ và tên phải có ít nhất 2 ký tự",
  }),
  phone: Joi.string().trim().pattern(phoneRegex).required().messages({
    "any.required": "Số điện thoại là bắt buộc",
    "string.empty": "Vui lòng nhập số điện thoại",
    "string.pattern.base": "Số điện thoại không hợp lệ (Ví dụ: 0912345678)",
  }),
  email: Joi.string().trim().email().allow("").optional().messages({
    "string.email": "Địa chỉ email không hợp lệ",
  }),
  address: Joi.string().trim().max(300).allow("").optional(),
  serviceInterest: Joi.string().trim().max(300).allow("").optional(),
  preferredContactTime: Joi.string().trim().max(100).allow("").optional(),
  notes: Joi.string().trim().max(1000).allow("").optional(),
  qrCampaign: Joi.string().trim().max(100).allow("").optional(),
}).unknown(false);

export const createCustomerLeadSchema = Joi.object({
  fullName: Joi.string().trim().min(2).max(100).required(),
  phone: Joi.string().trim().pattern(phoneRegex).required().messages({
    "string.pattern.base": "Số điện thoại không hợp lệ (Ví dụ: 0912345678)",
  }),
  email: Joi.string().trim().email().allow("").optional(),
  address: Joi.string().trim().max(300).allow("").optional(),
  serviceInterest: Joi.string().trim().max(300).allow("").optional(),
  preferredContactTime: Joi.string().trim().max(100).allow("").optional(),
  notes: Joi.string().trim().max(1000).allow("").optional(),
  branchId: Joi.string().trim().allow(null, "").optional(),
  source: Joi.string().trim().max(50).default("manual"),
  qrCampaign: Joi.string().trim().max(100).allow("").optional(),
  status: Joi.string().valid("new", "contacted", "in_consultation", "converted", "cancelled").default("new"),
  assignedTo: Joi.string().trim().allow(null, "").optional(),
}).unknown(false);

export const singleExternalLeadItemSchema = Joi.object({
  companyCode: Joi.string().trim().uppercase().optional(),
  fullName: Joi.string().trim().min(2).max(100).optional(),
  name: Joi.string().trim().min(2).max(100).optional(),
  phone: Joi.string().trim().pattern(phoneRegex).optional().messages({
    "string.pattern.base": "Số điện thoại không hợp lệ (Ví dụ: 0912345678)",
  }),
  phoneNumber: Joi.string().trim().pattern(phoneRegex).optional().messages({
    "string.pattern.base": "Số điện thoại không hợp lệ (Ví dụ: 0912345678)",
  }),
  telephone: Joi.string().trim().pattern(phoneRegex).optional().messages({
    "string.pattern.base": "Số điện thoại không hợp lệ (Ví dụ: 0912345678)",
  }),
  email: Joi.string().trim().email().allow("").optional(),
  address: Joi.string().trim().max(300).allow("").optional(),
  serviceInterest: Joi.string().trim().max(300).allow("").optional(),
  service: Joi.string().trim().max(300).allow("").optional(),
  preferredContactTime: Joi.string().trim().max(100).allow("").optional(),
  notes: Joi.string().trim().max(1000).allow("").optional(),
  note: Joi.string().trim().max(1000).allow("").optional(),
  branchCode: Joi.string().trim().allow("").optional(),
  branchId: Joi.string().trim().allow("").optional(),
  source: Joi.string().trim().max(50).default("external_app").optional(),
  campaign: Joi.string().trim().max(100).allow("").optional(),
  qrCampaign: Joi.string().trim().max(100).allow("").optional(),
  apiKey: Joi.string().trim().allow("").optional(),
})
  .or("fullName", "name")
  .or("phone", "phoneNumber", "telephone")
  .unknown(true);

export const batchExternalLeadObjectSchema = Joi.object({
  companyCode: Joi.string().trim().uppercase().optional(),
  source: Joi.string().trim().max(50).optional(),
  branchCode: Joi.string().trim().allow("").optional(),
  branchId: Joi.string().trim().allow("").optional(),
  campaign: Joi.string().trim().max(100).allow("").optional(),
  apiKey: Joi.string().trim().allow("").optional(),
  leads: Joi.array().items(singleExternalLeadItemSchema).min(1).max(200).optional(),
  customers: Joi.array().items(singleExternalLeadItemSchema).min(1).max(200).optional(),
  items: Joi.array().items(singleExternalLeadItemSchema).min(1).max(200).optional(),
  data: Joi.array().items(singleExternalLeadItemSchema).min(1).max(200).optional(),
})
  .or("leads", "customers", "items", "data")
  .unknown(true);

export const externalCustomerLeadSchema = Joi.alternatives().try(
  Joi.array().items(singleExternalLeadItemSchema).min(1).max(200),
  batchExternalLeadObjectSchema,
  singleExternalLeadItemSchema,
);

export const updateCustomerLeadSchema = Joi.object({
  fullName: Joi.string().trim().min(2).max(100).optional(),
  phone: Joi.string().trim().pattern(phoneRegex).optional(),
  email: Joi.string().trim().email().allow("").optional(),
  address: Joi.string().trim().max(300).allow("").optional(),
  serviceInterest: Joi.string().trim().max(300).allow("").optional(),
  preferredContactTime: Joi.string().trim().max(100).allow("").optional(),
  notes: Joi.string().trim().max(1000).allow("").optional(),
  source: Joi.string().trim().max(50).optional(),
  status: Joi.string().valid("new", "contacted", "in_consultation", "converted", "cancelled").optional(),
  assignedTo: Joi.string().trim().allow(null, "").optional(),
  branchId: Joi.string().trim().allow(null, "").optional(),
  addNote: Joi.string().trim().max(1000).optional(),
}).unknown(false);

export function validateBody(schema: Joi.Schema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.validate(req.body, { abortEarly: false, stripUnknown: false });
    if (result.error) {
      return res.status(400).json({
        status: "error",
        message: result.error.details.map((d) => d.message).join(", "),
      });
    }
    req.body = result.value;
    next();
  };
}
