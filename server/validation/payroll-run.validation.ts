import Joi from "joi";

const expectedVersion = Joi.number().integer().min(0).required();
const validDateOnly = Joi.string().pattern(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/).custom((value, helpers) => {
  const parsed = new Date(value + "T00:00:00.000Z");
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
    ? value
    : helpers.error("date.format");
}).required().messages({ "date.format": "{{#label}} must be a valid ISO date" });

export const createOperationalRunSchema = Joi.object({
  periodKey: Joi.string().pattern(/^\d{4}-\d{2}$/).required(),
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

export const syncAttendanceHeadersSchema = Joi.object({
  "idempotency-key": Joi.string().trim().min(1).required(),
}).unknown(true);
