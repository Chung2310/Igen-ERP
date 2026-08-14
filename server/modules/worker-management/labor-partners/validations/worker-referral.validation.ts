import Joi from "joi";
import { isoDate, objectId } from "./labor-partner.validation";

export const createWorkerReferralSchema = Joi.object({
  workerId: objectId.required(),
  policyId: objectId.required(),
  commissionScheme: Joi.string().valid("official_monthly", "seasonal_hourly").required(),
  referredAt: isoDate.required(),
  employmentStartDate: isoDate.required(),
  effectiveFrom: isoDate.required(),
  effectiveTo: isoDate.allow(null).optional(),
  confirmationSource: Joi.string().valid("contract", "manual", "attendance").default("manual"),
  note: Joi.string().trim().allow("", null).optional(),
}).unknown(false);

export const referralIdParamSchema = Joi.object({ partnerId: objectId.required(), referralId: objectId.required() });
export const endWorkerReferralSchema = Joi.object({ effectiveTo: isoDate.required() }).unknown(false);
export const workerIdParamSchema = Joi.object({ workerId: objectId.required() });
