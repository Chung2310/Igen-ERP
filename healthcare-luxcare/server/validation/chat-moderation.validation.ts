import Joi from "joi";

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const createReportSchema = {
  body: Joi.object({
    reportedUserId: Joi.string().pattern(objectIdRegex).required().messages({
      "any.required": "Mã người dùng bị báo cáo là bắt buộc.",
      "string.pattern.base": "Mã người dùng phải đúng định dạng MongoDB ObjectId.",
    }),
    roomId: Joi.string().pattern(objectIdRegex).required().messages({
      "any.required": "Mã phòng chat là bắt buộc.",
      "string.pattern.base": "Mã phòng chat phải đúng định dạng MongoDB ObjectId.",
    }),
    messageId: Joi.string().pattern(objectIdRegex).optional().allow(null, "").messages({
      "string.pattern.base": "Mã tin nhắn phải đúng định dạng MongoDB ObjectId.",
    }),
    reason: Joi.string()
      .valid("spam", "harassment", "inappropriate", "fraud", "other")
      .required()
      .messages({
        "any.required": "Lý do báo cáo là bắt buộc.",
        "any.only": "Lý do báo cáo phải là một trong các giá trị: spam, harassment, inappropriate, fraud, other.",
      }),
    details: Joi.string().max(1000).optional().allow("").messages({
      "string.max": "Chi tiết báo cáo không được vượt quá 1000 ký tự.",
    }),
  }),
};

export const updateReportStatusSchema = {
  params: Joi.object({
    reportId: Joi.string().pattern(objectIdRegex).required().messages({
      "any.required": "Mã báo cáo là bắt buộc.",
      "string.pattern.base": "Mã báo cáo phải đúng định dạng MongoDB ObjectId.",
    }),
  }),
  body: Joi.object({
    removeMessage: Joi.boolean().strict().optional().default(false),
    status: Joi.string()
      .valid("pending", "reviewed", "resolved", "dismissed")
      .required()
      .messages({
        "any.required": "Trạng thái báo cáo là bắt buộc.",
        "any.only": "Trạng thái phải là: pending, reviewed, resolved, hoặc dismissed.",
      }),
    adminNotes: Joi.string().max(1000).optional().allow("").messages({
      "string.max": "Ghi chú xử lý không được vượt quá 1000 ký tự.",
    }),
  }),
};

export const blockUserSchema = {
  body: Joi.object({
    blockedUserId: Joi.string().pattern(objectIdRegex).required().messages({
      "any.required": "Mã người dùng cần chặn là bắt buộc.",
      "string.pattern.base": "Mã người dùng phải đúng định dạng MongoDB ObjectId.",
    }),
    reason: Joi.string().max(500).optional().allow("").messages({
      "string.max": "Lý do chặn không được vượt quá 500 ký tự.",
    }),
  }),
};

export const targetUserIdParamSchema = {
  params: Joi.object({
    targetUserId: Joi.string().pattern(objectIdRegex).required().messages({
      "any.required": "Mã người dùng mục tiêu là bắt buộc.",
      "string.pattern.base": "Mã người dùng phải đúng định dạng MongoDB ObjectId.",
    }),
  }),
};

export const reportIdParamSchema = {
  params: Joi.object({
    reportId: Joi.string().pattern(objectIdRegex).required().messages({
      "any.required": "Mã báo cáo là bắt buộc.",
      "string.pattern.base": "Mã báo cáo phải đúng định dạng MongoDB ObjectId.",
    }),
  }),
};
