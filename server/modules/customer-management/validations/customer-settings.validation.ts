import Joi from "joi";

const tierSchema = Joi.object({
  code: Joi.string().lowercase().regex(/^[a-z0-9-]{1,30}$/).required().messages({
    "any.required": "Mã hạng 'code' là bắt buộc.",
    "string.empty": "Mã hạng không được để trống.",
    "string.pattern.base": "Mã hạng chỉ được phép chứa chữ thường không dấu, số và dấu gạch ngang (tối đa 30 ký tự).",
  }),
  name: Joi.string().trim().max(50).required().messages({
    "any.required": "Tên hạng 'name' là bắt buộc.",
    "string.empty": "Tên hạng không được để trống.",
    "string.max": "Tên hạng tối đa 50 ký tự.",
  }),
  minSpend: Joi.number().integer().min(0).required().messages({
    "any.required": "Mức chi tiêu tối thiểu 'minSpend' là bắt buộc.",
    "number.base": "Mức chi tiêu tối thiểu phải là một số.",
    "number.integer": "Mức chi tiêu tối thiểu phải là số nguyên.",
    "number.min": "Mức chi tiêu tối thiểu phải lớn hơn hoặc bằng 0.",
  }),
});

export const updateCustomerSettingsSchema = {
  body: Joi.object({
    customerTiers: Joi.array().min(1).max(10).items(tierSchema).required().messages({
      "any.required": "Danh sách phân hạng 'customerTiers' là bắt buộc.",
      "array.base": "Danh sách phân hạng phải là một mảng.",
      "array.min": "Phải có ít nhất 1 phân hạng khách hàng.",
      "array.max": "Tối đa chỉ cho phép 10 phân hạng khách hàng.",
    }),
  }).unknown(false),
};
