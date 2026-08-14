import Joi from "joi";
import { isoDate, objectId } from "./labor-partner.validation";

const money = Joi.number().integer().min(0);
const positiveMoney = Joi.number().integer().min(1);
const roundingMode = Joi.string().valid("floor", "nearest", "ceil");
const milestone = Joi.object({
  month: Joi.number().integer().min(1).max(3).required(),
  amount: money.required(),
  eligibilityRule: Joi.string().valid("contract_active", "manual_confirmation", "attendance_threshold").required(),
  minWorkedDays: Joi.number().integer().min(0).allow(null).optional(),
  minWorkedHours: Joi.number().min(0).allow(null).optional(),
});
const tier = Joi.object({ minHours: Joi.number().min(0).required(), maxHours: Joi.number().greater(Joi.ref("minHours")).allow(null).optional(), hourlyRate: money.required() });

export const commissionPolicySchema = Joi.object({
  name: Joi.string().trim().max(160).required(),
  effectiveFrom: isoDate.required(),
  effectiveTo: isoDate.allow(null).optional(),
  settlementCycle: Joi.object({ type: Joi.string().valid("calendar_month", "cutoff_day").required(), cutoffDay: Joi.when("type", { is: "cutoff_day", then: Joi.number().integer().min(1).max(28).required(), otherwise: Joi.valid(null).optional() }) }).required(),
  official: Joi.object({ enabled: Joi.boolean().required(), maxMonths: Joi.when("enabled", { is: true, then: Joi.number().integer().min(1).max(3).required(), otherwise: Joi.valid(null).optional() }), milestones: Joi.array().items(milestone).default([]) }).required(),
  seasonal: Joi.object({
    enabled: Joi.boolean().required(),
    aggregationScope: Joi.when("enabled", { is: true, then: Joi.string().valid("partner_period", "partner_project_period").required(), otherwise: Joi.valid(null).optional() }),
    tierMode: Joi.when("enabled", { is: true, then: Joi.string().valid("flat", "progressive").required(), otherwise: Joi.valid(null).optional() }),
    minHoursPerWorker: Joi.number().min(0).allow(null).optional(),
    maxEligibleHoursPerWorker: Joi.number().min(0).allow(null).optional(),
    hourRounding: Joi.object({ unitMinutes: Joi.number().valid(1, 5, 15, 30, 60).required(), mode: roundingMode.required() }).required(),
    moneyRounding: Joi.object({ unitVnd: positiveMoney.required(), mode: roundingMode.required() }).required(),
    tiers: Joi.array().items(tier).default([]),
  }).required(),
}).unknown(false);

export const policyIdParamSchema = Joi.object({ policyId: objectId.required() });
export const policyCloneSchema = Joi.object({ effectiveFrom: isoDate.required(), name: Joi.string().trim().max(160).optional() }).unknown(false);
