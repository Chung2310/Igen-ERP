import Joi from "joi";

export const createNotificationSchema = Joi.object({
  title: Joi.string().required().messages({
    "any.required": "Tiêu đề thông báo là bắt buộc.",
  }),
  content: Joi.string().required().messages({
    "any.required": "Nội dung thông báo là bắt buộc.",
  }),
  recipients: Joi.string().required().messages({
    "any.required": "Người nhận là bắt buộc.",
  }),
  recipientCount: Joi.number().min(0).required(),
  channels: Joi.array().items(Joi.string()).required().messages({
    "any.required": "Kênh gửi thông báo là bắt buộc.",
  }),
  status: Joi.string().valid("Đã gửi", "Đang gửi", "Thất bại").required().messages({
    "any.required": "Trạng thái là bắt buộc.",
  }),
  // Danh sách ID học viên gửi thành công (để cập nhật installmentStatus — không lưu vào DB)
  studentIds: Joi.array().items(Joi.string()).optional(),
  // Thông tin đợt thu học phí (optional)
  installmentPlan: Joi.object({
    installmentNo: Joi.number().integer().min(1).required().messages({
      "number.min": "Số đợt phải từ 1 trở lên.",
    }),
    percent: Joi.number().min(1).max(100).required().messages({
      "number.min": "Phần trăm đợt phải lớn hơn 0.",
      "number.max": "Phần trăm đợt không được vượt quá 100.",
    }),
    label: Joi.string().allow("").optional(),
  }).optional(),
});

