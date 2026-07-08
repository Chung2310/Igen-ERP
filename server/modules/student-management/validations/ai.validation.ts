import Joi from "joi";

export const analyzeStudentSchema = Joi.object({
  fullName: Joi.string().required().messages({
    "any.required": "Họ và tên là bắt buộc.",
    "string.empty": "Họ và tên không được để trống.",
  }),
  phone: Joi.string().required().messages({
    "any.required": "Số điện thoại là bắt buộc.",
    "string.empty": "Số điện thoại không được để trống.",
  }),
  rank: Joi.string().valid("A1", "A2", "B1", "B2", "C").required().messages({
    "any.required": "Hạng bằng đăng ký là bắt buộc.",
    "any.only": "Hạng bằng đăng ký không hợp lệ.",
  }),
  registrationDate: Joi.string().required().messages({
    "any.required": "Ngày đăng ký là bắt buộc.",
    "string.empty": "Ngày đăng ký không được để trống.",
  }),
  fee: Joi.string().required().messages({
    "any.required": "Học phí là bắt buộc.",
    "string.empty": "Học phí không được để trống.",
  }),
  status: Joi.string().required().messages({
    "any.required": "Trạng thái học viên là bắt buộc.",
    "string.empty": "Trạng thái học viên không được để trống.",
  }),
}).unknown(true);
