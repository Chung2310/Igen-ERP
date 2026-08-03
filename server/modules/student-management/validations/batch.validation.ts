import Joi from "joi";

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export const createBatchSchema = Joi.object({
  companyCode: Joi.string().trim().min(1).optional(),
  code: Joi.string().required().messages({
    "any.required": "Mã lớp là bắt buộc.",
    "string.empty": "Mã lớp không được để trống.",
  }),
  name: Joi.string().trim().max(200).allow("", null).optional(),
  quota: Joi.number().integer().min(0).optional(),
  geoLocation: Joi.object({
    latitude: Joi.number().min(-90).max(90).allow(null).optional(),
    longitude: Joi.number().min(-180).max(180).allow(null).optional(),
    radiusMeters: Joi.number().integer().min(10).max(20000).optional(),
  }).allow(null).optional(),
  courseId: Joi.string().required().messages({
    "any.required": "Khóa học là bắt buộc.",
    "string.empty": "Khóa học không được để trống.",
  }),
  instructorId: Joi.string().allow("", null).optional(),
  instructorText: Joi.string().trim().max(120).allow("", null).optional(),
  daysOfWeek: Joi.array().items(Joi.number().integer().min(0).max(6)).min(1).required().messages({
    "any.required": "Lịch học trong tuần là bắt buộc.",
    "array.min": "Phải chọn ít nhất một ngày học trong tuần.",
  }),
  startTime: Joi.string().pattern(timePattern).required().messages({
    "any.required": "Giờ bắt đầu là bắt buộc.",
    "string.pattern.base": "Giờ bắt đầu phải có định dạng HH:mm.",
  }),
  endTime: Joi.string().pattern(timePattern).required().messages({
    "any.required": "Giờ kết thúc là bắt buộc.",
    "string.pattern.base": "Giờ kết thúc phải có định dạng HH:mm.",
  }),
  location: Joi.string().allow("", null).optional(),
  startDate: Joi.string().pattern(datePattern).required().messages({
    "any.required": "Ngày khai giảng là bắt buộc.",
    "string.pattern.base": "Ngày khai giảng phải có định dạng YYYY-MM-DD.",
  }),
  endDate: Joi.string().pattern(datePattern).required().messages({
    "any.required": "Ngày kết thúc là bắt buộc.",
    "string.pattern.base": "Ngày kết thúc phải có định dạng YYYY-MM-DD.",
  }),
  status: Joi.string().valid("Sắp khai giảng", "Đang học", "Đã kết thúc").optional(),
  customFields: Joi.object().unknown(true).optional(),
});

export const updateBatchSchema = Joi.object({
  expectedVersion: Joi.number().integer().min(0).optional(),
  code: Joi.string().optional(),
  name: Joi.string().trim().max(200).allow("", null).optional(),
  quota: Joi.number().integer().min(0).optional(),
  geoLocation: Joi.object({
    latitude: Joi.number().min(-90).max(90).allow(null).optional(),
    longitude: Joi.number().min(-180).max(180).allow(null).optional(),
    radiusMeters: Joi.number().integer().min(10).max(20000).optional(),
  }).allow(null).optional(),
  courseId: Joi.string().optional(),
  instructorId: Joi.string().allow("", null).optional(),
  instructorText: Joi.string().trim().max(120).allow("", null).optional(),
  daysOfWeek: Joi.array().items(Joi.number().integer().min(0).max(6)).min(1).optional(),
  startTime: Joi.string().pattern(timePattern).optional(),
  endTime: Joi.string().pattern(timePattern).optional(),
  location: Joi.string().allow("", null).optional(),
  startDate: Joi.string().pattern(datePattern).optional(),
  endDate: Joi.string().pattern(datePattern).optional(),
  status: Joi.string().valid("Sắp khai giảng", "Đang học", "Đã kết thúc").optional(),
  customFields: Joi.object().unknown(true).optional(),
});

export const addLearnerSchema = Joi.object({
  studentId: Joi.string().required().messages({
    "any.required": "Học viên là bắt buộc.",
    "string.empty": "Học viên không được để trống.",
  }),
});
