import Joi from "joi";

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const getNotificationsSchema = {
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
    read: Joi.boolean().optional().messages({
      "boolean.base": "Tham số 'read' phải là kiểu boolean.",
    }),
    type: Joi.string().valid("kho", "task", "training", "he-thong").optional().messages({
      "any.only": "Tham số 'type' phải là một trong các giá trị: 'kho', 'task', 'training', 'he-thong'.",
    }),
  }),
};

export const createNotificationSchema = {
  body: Joi.object({
    title: Joi.string().trim().required().messages({
      "any.required": "Tiêu đề thông báo 'title' là bắt buộc.",
      "string.empty": "Tiêu đề thông báo không được để trống.",
    }),
    body: Joi.string().trim().required().messages({
      "any.required": "Nội dung thông báo 'body' là bắt buộc.",
      "string.empty": "Nội dung thông báo không được để trống.",
    }),
    type: Joi.string().valid("kho", "task", "training", "he-thong").required().messages({
      "any.required": "Phân loại thông báo 'type' là bắt buộc.",
      "any.only": "Phân loại thông báo phải là một trong các giá trị: 'kho', 'task', 'training', 'he-thong'.",
    }),
    recipientUid: Joi.string().regex(objectIdRegex).required().messages({
      "any.required": "Mã người nhận 'recipientUid' là bắt buộc.",
      "string.pattern.base": "Mã người nhận 'recipientUid' phải đúng định dạng MongoDB ObjectId.",
    }),
    action: Joi.object({
      tab: Joi.string().trim().required().messages({
        "any.required": "Trường 'tab' của action là bắt buộc.",
      }),
      subTab: Joi.string().trim().optional(),
    }).optional(),
  }),
};

export const notificationIdParamsSchema = {
  params: Joi.object({
    id: Joi.string().regex(objectIdRegex).required().messages({
      "any.required": "Mã thông báo 'id' là bắt buộc.",
      "string.pattern.base": "Mã thông báo 'id' không đúng định dạng MongoDB ObjectId.",
    }),
  }),
};
