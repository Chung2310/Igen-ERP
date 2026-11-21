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
  registrationToken: Joi.string().trim().max(4096).required().messages({
    "any.required": "Thiếu mã đăng ký trong đường dẫn.",
    "string.empty": "Thiếu mã đăng ký trong đường dẫn.",
  }),
});

export const publicRegistrationLinkSchema = Joi.object({
  companyCode: Joi.string().trim().uppercase().max(100).allow("").optional(),
  branchId: Joi.string().trim().max(100).allow("").optional(),
  entityPreset: Joi.string().valid("student", "candidate", "worker", "customer").optional(),
});
