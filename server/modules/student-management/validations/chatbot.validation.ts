import Joi from "joi";

export const chatSchema = Joi.object({
  messages: Joi.array().items(
    Joi.object({
      role: Joi.string().valid("user", "assistant", "system").required().messages({
        "any.required": "Vai trò (role) của tin nhắn là bắt buộc.",
        "any.only": "Vai trò (role) của tin nhắn phải là 'user', 'assistant' hoặc 'system'.",
        "string.empty": "Vai trò (role) của tin nhắn không được để trống.",
      }),
      content: Joi.string().required().messages({
        "any.required": "Nội dung tin nhắn là bắt buộc.",
        "string.empty": "Nội dung tin nhắn không được để trống.",
      }),
    })
  ).min(1).required().messages({
    "any.required": "Danh sách tin nhắn là bắt buộc.",
    "array.min": "Danh sách tin nhắn phải có ít nhất 1 tin nhắn.",
    "array.base": "Danh sách tin nhắn phải là một mảng.",
  }),
});
