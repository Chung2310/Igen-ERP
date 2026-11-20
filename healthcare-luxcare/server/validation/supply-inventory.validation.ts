import Joi from "joi";
const id = Joi.string().pattern(/^[a-f\d]{24}$/i);
const decimal = Joi.string().pattern(/^\d{1,16}(?:\.\d{1,6})?$/);
const draft = Joi.object({
  type: Joi.string().valid("opening", "receipt", "issue").required(),
  warehouseId: id.required(),
  reason: Joi.string().trim().min(1).max(1000).required(),
  recipientDepartment: Joi.string().trim().max(200).allow(""),
  supplierId: id,
  lines: Joi.array()
    .min(1)
    .max(200)
    .items(
      Joi.object({
        supplyId: id.required(),
        quantity: decimal.required(),
        unit: Joi.string().trim().max(60).required(),
        lotNumber: Joi.string().trim().max(120).allow(""),
        manufacturerKey: Joi.string().trim().max(120).allow(""),
        expiryDay: Joi.string()
          .pattern(/^\d{4}-\d{2}-\d{2}$/)
          .allow(""),
        lotId: id,
        totalValueMinor: Joi.number().integer().min(0).max(Number.MAX_SAFE_INTEGER),
      }).unknown(false),
    )
    .required(),
}).unknown(false);
export const inventoryDraftSchema = { body: draft };
export const inventoryIdSchema = { params: Joi.object({ id: id.required() }).unknown(false) };
export const inventoryUpdateSchema = {
  ...inventoryIdSchema,
  body: draft.keys({ revision: Joi.number().integer().min(1).required() }),
};
export const inventoryActionSchema = {
  ...inventoryIdSchema,
  body: Joi.object({
    revision: Joi.number().integer().min(1).required(),
    reason: Joi.string().trim().max(1000).allow("").default(""),
  }).unknown(false),
};
export const inventoryProfileSchema = {
  ...inventoryIdSchema,
  body: Joi.object({
    expectedVersion: Joi.number().integer().min(0).required(),
    baseUnit: Joi.string().trim().max(60).required(),
    precision: Joi.number().integer().min(0).max(6).required(),
    trackingMode: Joi.string().valid("none", "lot").required(),
    requiresExpiry: Joi.boolean().required(),
    conversions: Joi.array()
      .max(20)
      .items(Joi.object({ unit: Joi.string().trim().max(60).required(), factor: decimal.required() }).unknown(false))
      .required(),
  }).unknown(false),
};
