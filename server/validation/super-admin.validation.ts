import Joi from "joi";

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const createSuperAdminSchema = {
  body: Joi.object({
    displayName: Joi.string().trim().min(2).max(100).required(),
    email: Joi.string().trim().lowercase().email().max(254).required(),
    password: Joi.string().min(12).max(128).required(),
  }).unknown(false),
};

export const getAuditEventsSchema = {
  query: Joi.object({
    page: Joi.number().integer().min(1).optional().default(1).messages({
      "number.base": "Tham số 'page' phải là một số nguyên.",
      "number.min": "Tham số 'page' phải lớn hơn hoặc bằng 1.",
    }),
    limit: Joi.number().integer().min(1).max(100).optional().default(20).messages({
      "number.base": "Tham số 'limit' phải là một số nguyên.",
      "number.min": "Tham số 'limit' phải lớn hơn hoặc bằng 1.",
      "number.max": "Tham số 'limit' không được vượt quá 100.",
    }),
    companyCode: Joi.string().trim().optional().messages({
      "string.base": "Tham số 'companyCode' phải là kiểu chuỗi.",
    }),
    environment: Joi.string().valid("staging", "production").optional().messages({
      "any.only": "Tham số 'environment' phải là 'staging' hoặc 'production'.",
    }),
    riskClass: Joi.string().valid("read_only", "standard", "sensitive", "dangerous").optional().messages({
      "any.only": "Tham số 'riskClass' phải là một trong: 'read_only', 'standard', 'sensitive', 'dangerous'.",
    }),
    result: Joi.string().valid("success", "partial", "failure").optional().messages({
      "any.only": "Tham số 'result' phải là một trong: 'success', 'partial', 'failure'.",
    }),
    correlationId: Joi.string().trim().max(128).optional(),
    entityType: Joi.string().trim().max(64).optional(),
    entityId: Joi.string().trim().max(128).optional(),
    projectId: Joi.string().trim().max(128).optional(),
    taskId: Joi.string().trim().max(128).optional(),
    workflowId: Joi.string().trim().max(128).optional(),
    tenantId: Joi.string().trim().max(128).optional(),
    actionType: Joi.string().trim().optional().messages({
      "string.base": "Tham số 'actionType' phải là kiểu chuỗi.",
    }),
    startDate: Joi.string().isoDate().optional().messages({
      "string.isoDate": "Tham số 'startDate' phải đúng định dạng ISO Date.",
    }),
    endDate: Joi.string().isoDate().optional().messages({
      "string.isoDate": "Tham số 'endDate' phải đúng định dạng ISO Date.",
    }),
    actorSuperAdminId: Joi.string().regex(objectIdRegex).optional().messages({
      "string.pattern.base": "Tham số 'actorSuperAdminId' phải đúng định dạng MongoDB ObjectId.",
    }),
    effectiveUserId: Joi.string().regex(objectIdRegex).optional().messages({
      "string.pattern.base": "Tham số 'effectiveUserId' phải đúng định dạng MongoDB ObjectId.",
    }),
  }),
};

export const getDashboardSummarySchema = {
  query: Joi.object({
    startDate: Joi.string().isoDate().optional().messages({
      "string.isoDate": "Tham số 'startDate' phải đúng định dạng ISO Date.",
    }),
    endDate: Joi.string().isoDate().optional().messages({
      "string.isoDate": "Tham số 'endDate' phải đúng định dạng ISO Date.",
    }),
  }),
};

export const revokeSessionSchema = {
  params: Joi.object({
    sessionId: Joi.string().required().messages({
      "any.required": "Mã phiên làm việc 'sessionId' là bắt buộc.",
      "string.base": "Mã phiên làm việc 'sessionId' phải là kiểu chuỗi.",
    }),
  }),
};

export const startEnrollmentSchema = {
  body: Joi.object({
    challengeId: Joi.string().required().messages({
      "any.required": "Mã thử thách 'challengeId' là bắt buộc.",
      "string.empty": "Mã thử thách không được để trống.",
    }),
  }),
};

export const confirmEnrollmentSchema = {
  body: Joi.object({
    challengeId: Joi.string().required().messages({
      "any.required": "Mã thử thách 'challengeId' là bắt buộc.",
      "string.empty": "Mã thử thách không được để trống.",
    }),
    token: Joi.string().regex(/^\d{6}$/).required().messages({
      "any.required": "Mã OTP 'token' là bắt buộc.",
      "string.pattern.base": "Mã OTP 'token' phải gồm 6 chữ số.",
    }),
  }),
};

export const verifyTotpSchema = {
  body: Joi.object({
    challengeId: Joi.string().required().messages({
      "any.required": "Mã thử thách 'challengeId' là bắt buộc.",
      "string.empty": "Mã thử thách không được để trống.",
    }),
    token: Joi.string().regex(/^\d{6}$/).required().messages({
      "any.required": "Mã OTP 'token' là bắt buộc.",
      "string.pattern.base": "Mã OTP 'token' phải gồm 6 chữ số.",
    }),
  }),
};

export const verifyRecoverySchema = {
  body: Joi.object({
    challengeId: Joi.string().required().messages({
      "any.required": "Mã thử thách 'challengeId' là bắt buộc.",
      "string.empty": "Mã thử thách không được để trống.",
    }),
    code: Joi.string().required().messages({
      "any.required": "Mã khôi phục 'code' là bắt buộc.",
      "string.empty": "Mã khôi phục không được để trống.",
    }),
  }),
};
