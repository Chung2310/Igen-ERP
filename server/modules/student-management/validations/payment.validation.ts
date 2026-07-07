import Joi from "joi";
import { objectIdSchema } from "./student.validation";

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
  date: Joi.string().required().messages({
    "any.required": "Ngày thanh toán là bắt buộc.",
  }),
  note: Joi.string().allow("").optional(),
});
