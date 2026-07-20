import Joi from "joi";

export const createPartnerSchema = Joi.object({
  name: Joi.string().required().messages({
    "any.required": "Tên đối tác là bắt buộc.",
    "string.empty": "Tên đối tác không được để trống.",
  }),
  phone: Joi.string().required().messages({
    "any.required": "Số điện thoại là bắt buộc.",
    "string.empty": "Số điện thoại không được để trống.",
  }),
  email: Joi.string().email().allow("").optional().messages({
    "string.email": "Định dạng email không hợp lệ.",
  }),
  commissionType: Joi.string().valid("percentage", "fixed").optional().messages({
    "any.only": "Loại hoa hồng chỉ được phép là 'fixed' hoặc 'percentage'.",
  }),
  commissionValue: Joi.number().min(0).optional().messages({
    "number.min": "Giá trị hoa hồng không được âm.",
  }),
  bankName: Joi.string().allow("").optional(),
  bankAccountNo: Joi.string().allow("").optional(),
  bankAccountName: Joi.string().allow("").optional(),
  isActive: Joi.boolean().optional(),
  notes: Joi.string().allow("").optional(),
  centerId: Joi.string().allow("").optional(),
  customFields: Joi.object().unknown(true).optional(),
});

export const updatePartnerSchema = Joi.object({
  expectedVersion: Joi.number().integer().min(0).optional(),
  name: Joi.string().optional(),
  phone: Joi.string().optional(),
  email: Joi.string().email().allow("").optional(),
  commissionType: Joi.string().valid("percentage", "fixed").optional(),
  commissionValue: Joi.number().min(0).optional(),
  bankName: Joi.string().allow("").optional(),
  bankAccountNo: Joi.string().allow("").optional(),
  bankAccountName: Joi.string().allow("").optional(),
  isActive: Joi.boolean().optional(),
  notes: Joi.string().allow("").optional(),
  customFields: Joi.object().unknown(true).optional(),
});

export const createPayoutSchema = Joi.object({
  amount: Joi.number().min(1).required().messages({
    "any.required": "Số tiền chi trả là bắt buộc.",
    "number.min": "Số tiền chi trả phải lớn hơn 0.",
  }),
  date: Joi.string().required().messages({
    "any.required": "Ngày chi trả là bắt buộc.",
  }),
  method: Joi.string().valid("Tiền mặt", "Chuyển khoản").required().messages({
    "any.required": "Phương thức chi trả là bắt buộc.",
    "any.only": "Phương thức chi trả chỉ được là 'Tiền mặt' hoặc 'Chuyển khoản'.",
  }),
  note: Joi.string().allow("").optional(),
});

export const createCommissionLevelSchema = Joi.object({
  name: Joi.string().required().messages({
    "any.required": "Tên cấp bậc hoa hồng là bắt buộc.",
    "string.empty": "Tên cấp bậc hoa hồng không được để trống.",
  }),
  minTuition: Joi.number().min(0).required().messages({
    "any.required": "Doanh số tối thiểu là bắt buộc.",
    "number.min": "Doanh số tối thiểu không được nhỏ hơn 0.",
  }),
  commissionRate: Joi.number().min(0).max(100).required().messages({
    "any.required": "Tỷ lệ hoa hồng là bắt buộc.",
    "number.min": "Tỷ lệ hoa hồng không được nhỏ hơn 0%.",
    "number.max": "Tỷ lệ hoa hồng không được vượt quá 100%.",
  }),
  centerId: Joi.string().optional(),
});
