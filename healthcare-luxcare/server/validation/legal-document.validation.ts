import Joi from "joi";

const date = Joi.string()
  .pattern(/^\d{4}-\d{2}-\d{2}$/)
  .custom((value, helpers) => {
    const parsed = new Date(`${value}T00:00:00+07:00`);
    if (!Number.isFinite(parsed.getTime()) || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value)
      return helpers.error("any.invalid");
    return parsed;
  });
export const legalMetadataSchema = Joi.object({
  number: Joi.string().trim().uppercase().max(150).required(),
  title: Joi.string().trim().max(300).required(),
  issuer: Joi.string().trim().max(300).required(),
  issuedAt: date.required(),
  effectiveFrom: date.required(),
  effectiveTo: date.optional(),
  sourceUrl: Joi.string()
    .uri({ scheme: ["https"] })
    .max(2000)
    .required(),
  applicability: Joi.string().trim().max(2000).required(),
  companyCodes: Joi.array()
    .items(
      Joi.string()
        .trim()
        .uppercase()
        .pattern(/^[A-Z0-9][A-Z0-9_-]{0,49}$/),
    )
    .unique()
    .max(500)
    .required(),
  replaces: Joi.string().hex().length(24).optional(),
  amends: Joi.string().hex().length(24).optional(),
  sectionChanges: Joi.array()
    .items(
      Joi.object({
        action: Joi.string().valid("replace", "repeal", "add").required(),
        targetKey: Joi.string()
          .pattern(/^[a-z0-9][a-z0-9/_-]{0,99}$/)
          .required(),
        targetLabel: Joi.string().trim().max(200).required(),
        sourceKeys: Joi.array()
          .items(Joi.string().pattern(/^[a-z0-9][a-z0-9/_-]{0,99}$/))
          .min(1)
          .max(100)
          .unique()
          .required(),
        previousAmendmentId: Joi.string().hex().length(24).optional(),
      }).unknown(false),
    )
    .max(100)
    .unique("targetKey")
    .default([]),
})
  .unknown(false)
  .custom((value, helpers) => {
    if (value.effectiveTo && value.effectiveTo <= value.effectiveFrom) return helpers.error("any.invalid");
    if (value.replaces && value.amends) return helpers.error("any.invalid");
    if (!value.amends && value.sectionChanges.length) return helpers.error("any.invalid");
    return value;
  });
