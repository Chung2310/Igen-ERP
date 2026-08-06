import Joi from "joi";

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const hexColor = /^#[0-9a-fA-F]{6}$/;

export const batchProgressColorsSchema = Joi.object({
  green: Joi.string().pattern(hexColor).required(),
  yellow: Joi.string().pattern(hexColor).required(),
  red: Joi.string().pattern(hexColor).required(),
  black: Joi.string().pattern(hexColor).required(),
});

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
  roadmapId: Joi.string().allow("", null).optional(),
  roadmapStepId: Joi.string().allow("", null).optional(),
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
  status: Joi.string().valid("Sắp khai giảng", "Đang học", "Đã kết thúc", "Đã hủy").optional(),
  customFields: Joi.object().unknown(true).optional(),
});

export const updateBatchSchema = Joi.object({
  expectedVersion: Joi.number().integer().min(0).optional(),
  // Mã lớp và tên lớp bị khóa sau khi tạo. Vẫn nhận ở đây để payload cũ không
  // bị Joi chặn thẳng; BatchService.updateBatch mới là nơi từ chối khi giá trị
  // thực sự thay đổi (gửi lại đúng giá trị hiện tại thì không sao).
  code: Joi.string().optional(),
  name: Joi.string().trim().max(200).allow("", null).optional(),
  quota: Joi.number().integer().min(0).optional(),
  geoLocation: Joi.object({
    latitude: Joi.number().min(-90).max(90).allow(null).optional(),
    longitude: Joi.number().min(-180).max(180).allow(null).optional(),
    radiusMeters: Joi.number().integer().min(10).max(20000).optional(),
  }).allow(null).optional(),
  courseId: Joi.string().optional(),
  roadmapId: Joi.string().allow("", null).optional(),
  roadmapStepId: Joi.string().allow("", null).optional(),
  instructorId: Joi.string().allow("", null).optional(),
  instructorText: Joi.string().trim().max(120).allow("", null).optional(),
  daysOfWeek: Joi.array().items(Joi.number().integer().min(0).max(6)).min(1).optional(),
  startTime: Joi.string().pattern(timePattern).optional(),
  endTime: Joi.string().pattern(timePattern).optional(),
  location: Joi.string().allow("", null).optional(),
  startDate: Joi.string().pattern(datePattern).optional(),
  endDate: Joi.string().pattern(datePattern).optional(),
  status: Joi.string().valid("Sắp khai giảng", "Đang học", "Đã kết thúc", "Đã hủy").optional(),
  customFields: Joi.object().unknown(true).optional(),
});

export const addLearnerSchema = Joi.object({
  studentId: Joi.string().required().messages({
    "any.required": "Học viên là bắt buộc.",
    "string.empty": "Học viên không được để trống.",
  }),
});

export const updateEnrollmentStatusSchema = Joi.object({
  status: Joi.string().valid("Đang học", "Bảo lưu", "Chờ xếp học lại", "Học lại", "Hoàn thành khóa", "Chờ xếp lớp tiếp theo", "Không còn nhu cầu học").required().messages({
    "any.required": "Trạng thái bảo lưu là bắt buộc.",
    "any.only": "Chỉ có thể chuyển sang Đang học hoặc Bảo lưu.",
  }),
  reason: Joi.string().trim().max(500).allow("", null).optional(),
  retakeFee: Joi.number().min(0).optional(),
  targetBatchId: Joi.string().pattern(/^[0-9a-fA-F]{24}$/).allow("", null).optional(),
  expectedReturnAt: Joi.string().pattern(datePattern).allow("", null).optional().messages({
    "string.pattern.base": "Ngày dự kiến quay lại phải có định dạng YYYY-MM-DD.",
  }),
});
