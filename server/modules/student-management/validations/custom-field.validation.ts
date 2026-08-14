import Joi from "joi";
import { DYNAMIC_FIELD_TYPES, MODULE_KEYS } from "../interfaces/custom-field.interface";
import { isSafeCustomFieldPattern, MAX_CUSTOM_FIELD_PATTERN_LENGTH } from "../utils/custom-field-pattern.util";

const objectIdPattern = /^[0-9a-fA-F]{24}$/;
const selectTypes = [] as const;
const textTypes = ["text", "email", "phone", "url"] as const;
const numericTypes = ["percent", "currency"] as const;
const dateTypes = ["dateTime"] as const;
const fileTypes = ["file", "image"] as const;
const MAX_FILE_SIZE_MB = 100;

const safePatternSchema = Joi.string().max(MAX_CUSTOM_FIELD_PATTERN_LENGTH).custom((value, helpers) => (
  isSafeCustomFieldPattern(value) ? value : helpers.error("string.pattern.unsafe")
)).messages({
  "string.pattern.unsafe": "Biểu thức kiểm tra không an toàn hoặc quá phức tạp.",
});

const optionSchema = Joi.object({
  label: Joi.string().trim().min(1).required(),
  value: Joi.string().trim().min(1).required(),
}).unknown(false);

const textValidationSchema = Joi.object({
  minLength: Joi.number().integer().min(0),
  maxLength: Joi.number().integer().min(0),
  pattern: safePatternSchema,
}).unknown(false);

const numericValidationSchema = Joi.object({
  min: Joi.number(),
  max: Joi.number(),
  decimals: Joi.number().integer().min(0).max(10),
}).unknown(false);

const dateValidationSchema = Joi.object({
  minDate: Joi.string().isoDate(),
  maxDate: Joi.string().isoDate(),
  minTime: Joi.string().pattern(/^([01]\d|2[0-3]):[0-5]\d$/),
  maxTime: Joi.string().pattern(/^([01]\d|2[0-3]):[0-5]\d$/),
  minDateTime: Joi.string().isoDate(),
  maxDateTime: Joi.string().isoDate(),
}).unknown(false);

const fileValidationSchema = Joi.object({
  maxSizeMb: Joi.number().min(1).max(MAX_FILE_SIZE_MB),
  maxFiles: Joi.number().integer().positive(),
  allowedMimeTypes: Joi.array().items(Joi.string().trim().min(1)).unique(),
}).unknown(false);

const emptyValidationSchema = Joi.object({}).unknown(false);

const validationSchema = Joi.object({
  minLength: Joi.number().integer().min(0),
  maxLength: Joi.number().integer().min(0),
  pattern: safePatternSchema,
  min: Joi.number(),
  max: Joi.number(),
  decimals: Joi.number().integer().min(0).max(10),
  minDate: Joi.string().isoDate(),
  maxDate: Joi.string().isoDate(),
  minTime: Joi.string().pattern(/^([01]\d|2[0-3]):[0-5]\d$/),
  maxTime: Joi.string().pattern(/^([01]\d|2[0-3]):[0-5]\d$/),
  minDateTime: Joi.string().isoDate(),
  maxDateTime: Joi.string().isoDate(),
  maxSizeMb: Joi.number().min(1).max(MAX_FILE_SIZE_MB),
  maxFiles: Joi.number().integer().positive(),
  allowedMimeTypes: Joi.array().items(Joi.string().trim().min(1)).unique(),
}).unknown(false);

function withTypeSpecificValidation(schema: Joi.ObjectSchema) {
  const typedSchema = schema
    .when(Joi.object({ type: Joi.valid(...textTypes) }).unknown(), { then: Joi.object({ validation: textValidationSchema }) })
    .when(Joi.object({ type: Joi.valid(...numericTypes) }).unknown(), { then: Joi.object({ validation: numericValidationSchema }) })
    .when(Joi.object({ type: Joi.valid(...dateTypes) }).unknown(), { then: Joi.object({ validation: dateValidationSchema }) })
    .when(Joi.object({ type: Joi.valid(...fileTypes) }).unknown(), { then: Joi.object({ validation: fileValidationSchema }) })
    .when(Joi.object({ type: Joi.valid("singleSelect", "multiSelect", "checkbox", "switch") }).unknown(), { then: Joi.object({ validation: emptyValidationSchema }) });

  return typedSchema.custom((value, helpers) => {
    const validation = (helpers.original as { validation?: unknown }).validation;
    if (validation && typeof validation === "object" && ["__proto__", "prototype", "constructor"].some(key => Object.prototype.hasOwnProperty.call(validation, key))) {
      return helpers.error("any.invalid");
    }
    return value;
  });
}

function requireSelectOptions(schema: Joi.ObjectSchema) {
  if (!selectTypes.length) return schema;
  return schema.when(Joi.object({ type: Joi.valid(...selectTypes) }).unknown(), {
    then: Joi.object({ options: sharedFieldSchema.options.required() }),
  });
}

const fileValueSchema = Joi.object({
  url: Joi.string().uri().required(),
  fileName: Joi.string().trim().min(1).required(),
  mimeType: Joi.string().trim().min(1),
  size: Joi.number().min(0),
  reference: Joi.string().trim().min(1),
}).unknown(false);

const defaultValueSchema = Joi.alternatives().try(
  Joi.string(),
  Joi.number(),
  Joi.boolean(),
  Joi.valid(null),
  Joi.array().items(Joi.string()),
  fileValueSchema,
  Joi.array().items(fileValueSchema),
);

const sharedFieldSchema = {
  label: Joi.string().trim().min(1).max(200),
  type: Joi.string().valid(...DYNAMIC_FIELD_TYPES),
  placeholder: Joi.string().allow("").max(500),
  defaultValue: defaultValueSchema,
  options: Joi.array().items(optionSchema).min(1).unique((left, right) => left.label === right.label || left.value === right.value),
  validation: validationSchema,
  isVisible: Joi.boolean(),
  isRequired: Joi.boolean(),
  order: Joi.number().integer().min(0),
  moduleKey: Joi.forbidden(),
  tenantId: Joi.forbidden(),
  key: Joi.forbidden(),
  createdBy: Joi.forbidden(),
  updatedBy: Joi.forbidden(),
};

export const moduleParamSchema = Joi.object({
  moduleKey: Joi.string().valid(...MODULE_KEYS).required(),
}).unknown(false);

export const fieldParamsSchema = Joi.object({
  moduleKey: Joi.string().valid(...MODULE_KEYS).required(),
  id: Joi.string().pattern(objectIdPattern).required(),
}).unknown(false);

export const listQuerySchema = Joi.object({
  includeArchived: Joi.boolean().truthy("true").falsy("false").default(false),
  tenantId: Joi.string().trim().min(1).optional(),
}).unknown(false);

export const createFieldSchema = requireSelectOptions(withTypeSpecificValidation(Joi.object({
  ...sharedFieldSchema,
  label: sharedFieldSchema.label.required(),
  type: sharedFieldSchema.type.required(),
})
  .unknown(false)));

export const updateFieldSchema = requireSelectOptions(withTypeSpecificValidation(Joi.object(sharedFieldSchema)
  .min(1)
  .unknown(false)));
