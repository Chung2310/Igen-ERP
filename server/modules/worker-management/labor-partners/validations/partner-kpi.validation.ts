import Joi from "joi";
import { isoDate, objectId } from "./labor-partner.validation";

const scopeFields = { companyCode: Joi.string().trim().optional(), branchId: Joi.string().trim().optional() };

export const listPartnerKpiSchema = Joi.object({ ...scopeFields, periodAnchor: isoDate.required() }).unknown(false);
export const partnerKpiPartnerParamSchema = Joi.object({ partnerId: objectId.required() });
export const upsertPartnerKpiSchema = Joi.object({
  periodAnchor: isoDate.required(),
  targetReferrals: Joi.number().integer().min(0).max(100000).required(),
  note: Joi.string().trim().max(500).allow("", null).optional(),
}).unknown(false);
