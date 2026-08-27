import Joi from "joi";
import { MODULE_KEYS } from "../interfaces/custom-field.interface";

export const standardFieldModuleParamSchema = Joi.object({
  moduleKey: Joi.string().valid(...MODULE_KEYS).required().messages({
    "any.only": "Module không hợp lệ.",
    "any.required": "Thiếu module.",
  }),
});

export const replaceStandardFieldsSchema = Joi.object({
  fields: Joi.array()
    .items(
      Joi.object({
        key: Joi.string().trim().required(),
        label: Joi.string().trim().required().messages({
          "string.empty": "Nhãn của trường không được để trống.",
        }),
        placeholder: Joi.string().allow("").optional(),
        isRequired: Joi.boolean().required(),
        isVisible: Joi.boolean().required(),
        isArchived: Joi.boolean().required(),
      }),
    )
    .max(200)
    .required(),
});

export const publicRegisterConfigQuerySchema = Joi.object({
  teacherId: Joi.string().trim().required().messages({
    "any.required": "Thiếu mã giáo viên trong đường dẫn đăng ký.",
    "string.empty": "Thiếu mã giáo viên trong đường dẫn đăng ký.",
  }),
  registrationCompanyCode: Joi.string().trim().allow("").optional(),
  companyCode: Joi.string().trim().allow("").optional(),
  registrationBranchId: Joi.string().trim().allow("").optional(),
  entityPreset: Joi.string().trim().allow("").optional(),
});
