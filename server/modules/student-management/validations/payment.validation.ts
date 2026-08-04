import Joi from "joi";
import { objectIdSchema } from "./student.validation";
import { PAYMENT_DATE_PATTERN } from "../utils/payment-date.util";

export const createPaymentSchema = Joi.object({
  studentId: objectIdSchema.required().messages({
    "any.required": "ID học viên là bắt buộc.",
  }),
  studentName: Joi.string().required().messages({
    "any.required": "Tên học viên là bắt buộc.",
  }),
  amount: Joi.number().positive().required().messages({
    "any.required": "Số tiền thanh toán là bắt buộc.",
    "number.positive": "Số tiền phải lớn hơn 0.",
  }),
  method: Joi.string().valid("Tiền mặt", "Chuyển khoản").required(),
  // Siết định dạng để không sinh thêm dữ liệu không quy đổi được sang paidOn.
  date: Joi.string().pattern(PAYMENT_DATE_PATTERN).required().messages({
    "any.required": "Ngày thanh toán là bắt buộc.",
    "string.pattern.base": "Ngày thanh toán phải đúng định dạng DD/MM/YYYY hoặc YYYY-MM-DD.",
  }),
  note: Joi.string().allow("").optional(),
});
