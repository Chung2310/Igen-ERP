import Joi from "joi";

export const registerSchema = Joi.object({
  email: Joi.string().email().required().messages({
    "string.email": "Định dạng email không hợp lệ.",
    "any.required": "Email là bắt buộc.",
    "string.empty": "Email không được để trống.",
  }),
  password: Joi.string().min(6).required().messages({
    "string.min": "Mật khẩu phải từ 6 ký tự trở lên.",
    "any.required": "Mật khẩu là bắt buộc.",
    "string.empty": "Mật khẩu không được để trống.",
  }),
  displayName: Joi.string().required().messages({
    "any.required": "Tên hiển thị là bắt buộc.",
    "string.empty": "Tên hiển thị không được để trống.",
  }),

});

export const createManagedUserSchema = Joi.object({
  email: Joi.string().email().required().messages({
    "string.email": "Định dạng email không hợp lệ.",
    "any.required": "Email là bắt buộc.",
    "string.empty": "Email không được để trống.",
  }),
  password: Joi.string().min(6).required().messages({
    "string.min": "Mật khẩu phải từ 6 ký tự trở lên.",
    "any.required": "Mật khẩu là bắt buộc.",
    "string.empty": "Mật khẩu không được để trống.",
  }),
  displayName: Joi.string().required().messages({
    "any.required": "Họ tên là bắt buộc.",
    "string.empty": "Họ tên không được để trống.",
  }),
  role: Joi.string().valid("admin", "user").required().messages({
    "any.required": "Vai trò là bắt buộc.",
    "any.only": "Vai trò không hợp lệ.",
  }),
  centerId: Joi.string().allow("").optional(),

  bankAccountNo: Joi.string().allow("").optional(),
  bankId: Joi.string().allow("").optional(),
  businessType: Joi.string().valid("driving", "language", "general").optional(),
  maxUsersLimit: Joi.number().integer().min(0).optional(),
  permissions: Joi.array().items(Joi.string()).optional(),
});

export const loginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    "string.email": "Định dạng email không hợp lệ.",
    "any.required": "Email là bắt buộc.",
    "string.empty": "Email không được để trống.",
  }),
  password: Joi.string().required().messages({
    "any.required": "Mật khẩu là bắt buộc.",
    "string.empty": "Mật khẩu không được để trống.",
  }),
});

export const bankSettingsSchema = Joi.object({
  bankAccountNo: Joi.string().allow("").optional().messages({
    "string.base": "Số tài khoản không hợp lệ.",
  }),
  bankId: Joi.string().allow("").optional().messages({
    "string.base": "Mã ngân hàng không hợp lệ.",
  }),
  bankAccountName: Joi.string().allow("").optional().messages({
    "string.base": "Tên chủ tài khoản không hợp lệ.",
  }),
  bankQrEnabled: Joi.boolean().optional(),
});

export const smtpSettingsSchema = Joi.object({
  smtpHost: Joi.string().allow("").optional(),
  smtpPort: Joi.number().integer().allow(null, "").optional(),
  smtpSecure: Joi.boolean().allow(null, "").optional(),
  smtpUser: Joi.string().allow("").optional(),
  smtpPass: Joi.string().allow("").optional(),
  smtpFrom: Joi.string().allow("").optional(),
  smtpSandboxEmail: Joi.string().email().allow("").optional().messages({
    "string.email": "Dinh dang email sandbox khong hop le.",
  }),
});

export const smsSettingsSchema = Joi.object({
  provider: Joi.string().valid("twilio", "stringee", "tingting").optional(),
  twilioAccountSid: Joi.string().allow("").optional(),
  twilioAuthToken: Joi.string().allow("").optional(),
  twilioFromNumber: Joi.string().allow("").optional(),
  twilioMessagingServiceSid: Joi.string().allow("").optional(),
  twilioStatusCallbackUrl: Joi.string().uri().allow("").optional().messages({
    "string.uri": "Dinh dang URL callback Twilio khong hop le.",
  }),
  stringeeApiUrl: Joi.string().uri().allow("").optional().messages({
    "string.uri": "Dinh dang URL API Stringee khong hop le.",
  }),
  stringeeApiKey: Joi.string().allow("").optional(),
  stringeeSecretKey: Joi.string().allow("").optional(),
  stringeeBrandname: Joi.string().allow("").optional(),
  stringeeSender: Joi.string().allow("").optional(),
  stringeeStatusCallbackUrl: Joi.string().uri().allow("").optional().messages({
    "string.uri": "Dinh dang URL callback Stringee khong hop le.",
  }),
  tingtingApiKey: Joi.string().allow("").optional(),
  tingtingSender: Joi.string().allow("").optional(),
});
