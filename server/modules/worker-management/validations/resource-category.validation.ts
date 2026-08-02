import Joi from "joi";

export const createResourceCategorySchema = Joi.object({
  name: Joi.string().required().messages({
    "any.required": "Tên phân loại là bắt buộc.",
    "string.empty": "Tên phân loại không được để trống.",
  }),
});
