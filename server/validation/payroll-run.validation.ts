import Joi from "joi";

const expectedVersion = Joi.number().integer().min(0).required();
const validDateOnly = Joi.string().pattern(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/).custom((value, helpers) => {
  const parsed = new Date(value + "T00:00:00.000Z");
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
    ? value
    : helpers.error("date.format");
}).required().messages({ "date.format": "{{#label}} must be a valid ISO date" });

export const createOperationalRunSchema = Joi.object({
  periodKey: Joi.string().pattern(/^\d{4}-(0[1-9]|1[0-2])$/).required(),
  startDate: validDateOnly,
  endDate: validDateOnly,
  type: Joi.string().valid("regular", "supplemental").required(),
  parentRunId: Joi.string().trim().min(1).optional(),
  supplementalReason: Joi.string().trim().min(1).optional(),
}).custom((value, helpers) => {
  if (value.startDate > value.endDate) return helpers.error("date.order");
  if (value.type === "supplemental" && !value.parentRunId && !value.supplementalReason) {
    return helpers.error("supplemental.reference");
  }
  return value;
}).messages({
  "date.order": "endDate must be on or after startDate",
  "supplemental.reference": "Supplemental runs require parentRunId or supplementalReason",
});

export const syncAttendanceSchema = Joi.object({ expectedVersion });
export const lockAttendanceSchema = Joi.object({ expectedVersion });

export const calculateRunSchema = Joi.object({ expectedVersion });

export const workflowTransitionSchema = Joi.object({
  expectedVersion,
  reason: Joi.string().trim().min(1).max(1000).optional(),
  correlationId: Joi.string().trim().min(1).max(200).optional(),
});

export const rejectRunSchema = workflowTransitionSchema.keys({
  reason: Joi.string().trim().min(1).max(1000).required(),
});

export const reopenRunSchema = workflowTransitionSchema.keys({
  reason: Joi.string().trim().min(1).max(1000).required(),
});

const isoDateTime = Joi.string().isoDate();
const rate = Joi.number().min(0).max(1);

export const createPolicySchema = Joi.object({
  code: Joi.string().trim().min(1).max(64).required(),
  name: Joi.string().trim().min(1).max(200).required(),
  effectiveFrom: isoDateTime.required(),
  effectiveTo: isoDateTime.optional(),
  sourceReference: Joi.string().trim().max(500).optional(),
  baseSalary: Joi.number().integer().min(0).required(),
  regionalMinimumWage: Joi.number().integer().min(0).required(),
  socialCapMultiplier: Joi.number().min(1).default(20),
  unemploymentCapMultiplier: Joi.number().min(1).default(20),
  funds: Joi.array().min(1).items(Joi.object({
    code: Joi.string().valid("social", "health", "unemployment", "accident", "union").required(),
    employeeRate: rate.required(),
    employerRate: rate.required(),
    capBasis: Joi.string().valid("baseSalary", "regionalMinimum", "none").required(),
  })).required(),
  personalDeduction: Joi.number().integer().min(0).required(),
  dependentDeduction: Joi.number().integer().min(0).required(),
  taxBrackets: Joi.array().min(1).items(Joi.object({
    upTo: Joi.number().integer().min(1).optional(),
    rate: rate.required(),
  })).required(),
  shortTermWithholdingRate: rate.default(0.1),
  shortTermWithholdingThreshold: Joi.number().integer().min(0).default(2_000_000),
  nonResidentRate: rate.default(0.2),
  overtime: Joi.object({
    weekday: Joi.number().min(1).default(1.5),
    restDay: Joi.number().min(1).default(2),
    holiday: Joi.number().min(1).default(3),
    nightPremium: Joi.number().min(0).default(0.3),
    nightOvertimeBonus: Joi.number().min(0).default(0.2),
  }).default(),
  roundingUnit: Joi.number().integer().min(1).default(1),
});

export const createPaymentSchema = Joi.object({
  amount: Joi.number().integer().min(1).required(),
  idempotencyKey: Joi.string().trim().min(1).max(200).required(),
  lines: Joi.array().min(1).items(Joi.object({
    employeeId: Joi.string().trim().min(1).required(),
    amount: Joi.number().integer().min(1).required(),
  })).required(),
  paymentDate: isoDateTime.optional(),
  evidenceUrl: Joi.string().trim().uri({ scheme: ["http", "https"] }).max(2000).optional(),
  note: Joi.string().trim().max(1000).optional(),
  correlationId: Joi.string().trim().min(1).max(200).optional(),
});

export const paymentTransitionSchema = Joi.object({
  paymentDate: isoDateTime.optional(),
  evidenceUrl: Joi.string().trim().uri({ scheme: ["http", "https"] }).max(2000).optional(),
  note: Joi.string().trim().max(1000).optional(),
  correlationId: Joi.string().trim().min(1).max(200).optional(),
});

export const auditQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(200).default(50),
  action: Joi.string().trim().min(1).optional(),
}).unknown(true);

export const syncAttendanceHeadersSchema = Joi.object({
  "idempotency-key": Joi.string().trim().min(1).required(),
}).unknown(true);
