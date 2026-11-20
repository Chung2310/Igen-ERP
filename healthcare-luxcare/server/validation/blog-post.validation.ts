import type { NextFunction, Request, Response } from "express";
import Joi from "joi";

const attachmentSchema = Joi.object({
  url: Joi.string().required().messages({
    "any.required": "Đường dẫn tệp đính kèm là bắt buộc",
  }),
  name: Joi.string().trim().max(255).allow("").optional().default(""),
  type: Joi.string().trim().max(100).allow("").optional().default(""),
  size: Joi.number().min(0).optional().default(0),
});

export const createBlogPostSchema = Joi.object({
  title: Joi.string().trim().max(300).allow("").optional(),
  content: Joi.string()
    .trim()
    .max(10000)
    .when("attachments", {
      is: Joi.array().min(1),
      then: Joi.string().allow("").optional().default(""),
      otherwise: Joi.string().min(1).required().messages({
        "any.required": "Nội dung bài viết không được để trống",
        "string.empty": "Vui lòng nhập nội dung bài viết",
        "string.max": "Nội dung không được vượt quá 10,000 ký tự",
      }),
    }),
  tags: Joi.array().items(Joi.string().trim().max(50)).max(10).optional().default(["Thông báo"]),
  isPinned: Joi.boolean().optional().default(false),
  attachmentsPublic: Joi.boolean().strict().optional().default(false),
  attachments: Joi.array().items(attachmentSchema).max(10).optional().default([]),
}).unknown(false);

export const attachmentVisibilitySchema = Joi.object({
  attachmentsPublic: Joi.boolean().strict().required(),
}).unknown(false);

export const updateBlogPostSchema = Joi.object({
  title: Joi.string().trim().max(300).allow("").optional(),
  content: Joi.string().trim().min(1).max(10000).optional(),
  tags: Joi.array().items(Joi.string().trim().max(50)).max(10).optional(),
  isPinned: Joi.boolean().optional(),
  attachments: Joi.array().items(attachmentSchema).max(10).optional(),
}).unknown(false);

export function validateBody(schema: Joi.Schema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.validate(req.body, { abortEarly: false, stripUnknown: false });
    if (result.error) {
      return res.status(400).json({
        status: "error",
        message: result.error.details.map((d) => d.message).join(", "),
      });
    }
    req.body = result.value;
    next();
  };
}
