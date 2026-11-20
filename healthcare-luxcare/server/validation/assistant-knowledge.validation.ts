import Joi from "joi";
export const verifySpotCheckSchema = {
  body: Joi.object({
    contentHash: Joi.string().required(),
    flagIds: Joi.array().items(Joi.string().max(100)).unique().required(),
    note: Joi.string().trim().max(1000).allow(""),
  }).unknown(false).required(),
};
const fields = {
  documentType: Joi.string().valid("company_profile", "policy", "procedure", "faq", "general", "medical", "guideline"),
  category: Joi.string().trim().max(100).allow(""),
  visibility: Joi.string().valid("company", "restricted"),
  branchIds: Joi.array().items(Joi.string().trim().max(100)).unique().max(100),
  departmentIds: Joi.array().items(Joi.string().trim().max(100)).unique().max(100),
  replaces: Joi.string().hex().length(24).allow(null, ""),
  effectiveFrom: Joi.date().iso().allow(null, ""),
  effectiveTo: Joi.date().iso().allow(null, ""),
};
const scopeCheck = (value: any, helpers: Joi.CustomHelpers) => {
  if (value.visibility === "restricted" && !value.branchIds?.length && !value.departmentIds?.length)
    return helpers.message({ custom: "Phạm vi hạn chế cần ít nhất một chi nhánh hoặc phòng ban." });
  return value;
};
export const knowledgeMetadataSchema = { body: Joi.object(fields).unknown(false).custom(scopeCheck) };
export const createKnowledgeDocumentSchema = {
  body: Joi.object({
    ...fields,
    title: Joi.string().trim().min(2).max(200).required(),
    text: Joi.string().trim().min(3).max(500_000).required(),
  })
    .unknown(false)
    .custom(scopeCheck),
};
export const syncKnowledgeResourceSchema = {
  body: Joi.object({ ...fields, text: Joi.string().trim().min(3).max(500_000).required() })
    .unknown(false)
    .custom(scopeCheck),
  params: Joi.object({ resourceId: Joi.string().hex().length(24).required() }),
};
export const assistantKnowledgeIdSchema = { params: Joi.object({ id: Joi.string().hex().length(24).required() }) };
export const updateKnowledgeMetadataSchema = {
  ...assistantKnowledgeIdSchema,
  body: knowledgeMetadataSchema.body.min(1).required(),
};
export const testKnowledgeSearchSchema = {
  body: Joi.object({
    query: Joi.string().trim().min(2).max(1000).required(),
    topK: Joi.number().integer().min(1).max(10).default(5),
    category: fields.category,
    documentType: fields.documentType,
  }).unknown(false),
};
export const suggestReplacementSchema = {
  body: Joi.object({
    title: Joi.string().trim().max(300).allow(""),
    number: Joi.string().trim().max(100).allow(""),
  }).unknown(false),
};
