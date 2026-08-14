import Joi from "joi";

export const objectId = Joi.string().pattern(/^[0-9a-fA-F]{24}$/).messages({ "string.pattern.base": "Định dạng ID không hợp lệ." });
export const isoDate = Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).messages({ "string.pattern.base": "Ngày phải theo định dạng YYYY-MM-DD." });
const optionalText = Joi.string().trim().allow("", null).optional();

const partnerFields = {
  code: Joi.string().trim().max(80).required(),
  name: Joi.string().trim().max(255).required(),
  phone: Joi.string().trim().max(40).required(),
  email: Joi.string().trim().email().allow("", null).optional(),
  taxCode: optionalText,
  representative: optionalText,
  address: optionalText,
  bankName: optionalText,
  bankAccountNo: optionalText,
  bankAccountName: optionalText,
  // The partner form submits an empty string when no default policy is selected.
  // Keep that value valid; the service normalizes it to null before persistence.
  defaultPolicyId: objectId.allow("", null).optional(),
  status: Joi.string().valid("active", "inactive").optional(),
  note: optionalText,
};

export const createLaborPartnerSchema = Joi.object(partnerFields);
export const updateLaborPartnerSchema = Joi.object(partnerFields).fork(["code", "name", "phone"], (schema) => schema.optional()).min(1);
export const partnerIdParamSchema = Joi.object({ partnerId: objectId.required() });
const scopeQueryFields = { companyCode: Joi.string().trim().optional(), branchId: Joi.string().trim().optional() };
export const listLaborPartnerSchema = Joi.object({ ...scopeQueryFields, search: Joi.string().trim().allow("").optional(), status: Joi.string().valid("active", "inactive").optional(), page: Joi.number().integer().min(1).default(1), pageSize: Joi.number().integer().min(1).max(100).default(20) }).unknown(false);
export const listSettlementSchema = Joi.object({ ...scopeQueryFields, partnerId: objectId.optional(), status: Joi.string().valid("draft", "calculated", "approved", "partially_paid", "paid", "void").optional(), scheme: Joi.string().valid("official_monthly", "seasonal_hourly").optional(), periodStart: isoDate.optional(), periodEnd: isoDate.optional() }).unknown(false);
export const laborPartnerReportSchema = Joi.object({ ...scopeQueryFields, partnerId: objectId.optional(), status: Joi.string().valid("draft", "calculated", "approved", "partially_paid", "paid", "void").optional(), scheme: Joi.string().valid("official_monthly", "seasonal_hourly").optional(), periodFrom: isoDate.optional(), periodTo: isoDate.optional() }).unknown(false);
const manualSettlementEntry = Joi.object({ referralId: objectId.required(), officialMonths: Joi.number().integer().min(0).max(3).optional(), seasonalHours: Joi.number().min(0).optional() }).or("officialMonths", "seasonalHours").unknown(false);
export const calculateSettlementSchema = Joi.object({ partnerId: objectId.required(), periodAnchor: isoDate.required(), manualEntries: Joi.array().min(1).items(manualSettlementEntry).required() }).unknown(false);
export const settlementIdParamSchema = Joi.object({ settlementId: objectId.required() });
export const payoutIdParamSchema = Joi.object({ payoutId: objectId.required() });
export const approveSettlementSchema = Joi.object({ expectedVersion: Joi.number().integer().min(1).required() }).unknown(false);
export const voidSettlementSchema = Joi.object({ expectedVersion: Joi.number().integer().min(1).required(), reason: Joi.string().trim().max(500).allow("", null).optional() }).unknown(false);
export const createAdjustmentSchema = Joi.object({ amount: Joi.number().integer().invalid(0).required(), reason: Joi.string().trim().min(3).max(500).required(), periodAnchor: isoDate.required(), idempotencyKey: Joi.string().trim().min(1).max(200).required() }).unknown(false);
export const payoutSettlementSchema = Joi.object({ amount: Joi.number().integer().positive().required(), method: Joi.string().valid("cash", "bank_transfer").required(), reference: Joi.string().trim().allow("", null).optional(), note: Joi.string().trim().allow("", null).optional(), idempotencyKey: Joi.string().trim().min(1).max(200).required() }).unknown(false);
