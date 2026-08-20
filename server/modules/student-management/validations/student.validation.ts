import Joi from "joi";

const objectIdPattern = /^[0-9a-fA-F]{24}$/;

export const objectIdSchema = Joi.string().pattern(objectIdPattern).messages({
  "string.pattern.base": "Định dạng ID không hợp lệ.",
});

export const idParamSchema = Joi.object({
  id: objectIdSchema.required(),
});

export const enrollmentStatusParamsSchema = Joi.object({
  id: objectIdSchema.required(),
  studentId: objectIdSchema.required(),
});


export const assignStudentBranchSchema = Joi.object({
  branchId: objectIdSchema.required(),
});
export const installmentParamsSchema = Joi.object({
  id: objectIdSchema.required(),
  no: Joi.number().integer().positive().required(),
});

const uploadedFileSchema = Joi.object({
  _id: Joi.any().optional(),
  name: Joi.string().required(),
  url: Joi.string().required(),
  type: Joi.string().required(),
  uploadToken: Joi.string().trim().optional(),
  uploadedAt: Joi.any().optional(),
});

export const createStudentSchema = Joi.object({
  fullName: Joi.string().required().messages({
    "any.required": "Họ và tên là bắt buộc.",
    "string.empty": "Họ và tên không được để trống.",
  }),
  phone: Joi.string().required().messages({
    "any.required": "Số điện thoại là bắt buộc.",
    "string.empty": "Số điện thoại không được để trống.",
  }),
  email: Joi.string().email().required().messages({
    "any.required": "Email là bắt buộc.",
    "string.empty": "Email không được để trống.",
    "string.email": "Định dạng email không hợp lệ.",
  }),
  referral: Joi.string().allow("").optional(),
  birthday: Joi.string().allow("").optional(),
  idCard: Joi.string().allow("").optional(),
  rank: Joi.string().allow("").optional(),
  courseId: objectIdSchema.allow("").optional(),
  registrationDate: Joi.string().required().messages({
    "any.required": "Ngày đăng ký là bắt buộc.",
  }),
  enrollmentDate: Joi.string().allow("").optional(),
  fee: Joi.string().allow("").optional(),
  address: Joi.string().allow("").optional(),
  idCardFront: Joi.string().allow("").optional(),
  idCardBack: Joi.string().allow("").optional(),
  idCardFrontFile: uploadedFileSchema.optional(),
  idCardBackFile: uploadedFileSchema.optional(),
  portraitFile: uploadedFileSchema.optional(),
  status: Joi.alternatives().try(
    Joi.array().items(Joi.string().valid("Chờ KSK", "Đã KSK", "Đã nộp HS", "Đang học", "Đang thi", "Đã đậu", "Thi lại", "Nghỉ học", "Nợ học phí")),
    Joi.string().valid("Chờ KSK", "Đã KSK", "Đã nộp HS", "Đang học", "Đang thi", "Đã đậu", "Thi lại", "Nghỉ học", "Nợ học phí")
  ).optional(),
  centerId: Joi.string().allow("").optional(),
  partnerId: Joi.string().allow("").optional(),
  customFields: Joi.object().unknown(true).optional(),
});

export const updateStudentSchema = Joi.object({
  expectedVersion: Joi.number().integer().min(0).optional(),
  fullName: Joi.string().optional(),
  phone: Joi.string().optional(),
  // Email may be omitted in a partial update, but can never be cleared.
  email: Joi.string().email().optional(),
  referral: Joi.string().allow("").optional(),
  birthday: Joi.string().allow("").optional(),
  idCard: Joi.string().allow("").optional(),
  rank: Joi.string().allow("").optional(),
  courseId: objectIdSchema.allow("").optional(),
  registrationDate: Joi.string().optional(),
  enrollmentDate: Joi.string().allow("").optional(),
  fee: Joi.string().optional(),
  address: Joi.string().allow("").optional(),
  status: Joi.alternatives().try(
    Joi.array().items(Joi.string().valid("Chờ KSK", "Đã KSK", "Đã nộp HS", "Đang học", "Đang thi", "Đã đậu", "Thi lại", "Nghỉ học", "Nợ học phí")),
    Joi.string().valid("Chờ KSK", "Đã KSK", "Đã nộp HS", "Đang học", "Đang thi", "Đã đậu", "Thi lại", "Nghỉ học", "Nợ học phí")
  ).optional(),
  healthCheckDate: Joi.string().allow("").optional(),
  healthCheckNotes: Joi.string().allow("").optional(),
  healthCheckFiles: Joi.array().items(uploadedFileSchema).optional(),
  idCardFrontFile: uploadedFileSchema.allow(null).optional(),
  idCardBackFile: uploadedFileSchema.allow(null).optional(),
  portraitFile: uploadedFileSchema.allow(null).optional(),
  progress: Joi.object({
    theory: Joi.object({
      completed: Joi.boolean().optional(),
      score: Joi.any().optional(),
      lastDate: Joi.string().allow("").optional(),
    }).optional(),
    practice: Joi.object({
      hoursDone: Joi.number().optional(),
      totalHours: Joi.number().optional(),
    }).optional(),
    cabin: Joi.object({
      hoursDone: Joi.number().optional(),
      totalHours: Joi.number().optional(),
    }).optional(),
    dat: Joi.object({
      kmDone: Joi.number().optional(),
      totalKm: Joi.number().optional(),
    }).optional(),
    sim: Joi.object({
      completed: Joi.boolean().optional(),
      lastDate: Joi.string().allow("").optional(),
    }).optional(),
  }).optional(),
  exams: Joi.array().optional(),
  paymentHistory: Joi.array().optional(),
  examId: Joi.string().allow("").optional(),
  examName: Joi.string().allow("").optional(),
  examDate: Joi.string().allow("").optional(),
  idCardFront: Joi.string().allow("").optional(),
  idCardBack: Joi.string().allow("").optional(),
  centerId: Joi.string().allow("").optional(),
  partnerId: Joi.string().allow("").optional(),
  customFields: Joi.object().unknown(true).optional(),
});

export const publicRegisterStudentSchema = Joi.object({
  fullName: Joi.string().required().messages({
    "any.required": "Họ và tên là bắt buộc.",
    "string.empty": "Họ và tên không được để trống.",
  }),
  phone: Joi.string().required().pattern(/^(0[35789]\d{8})$/).messages({
    "any.required": "Số điện thoại là bắt buộc.",
    "string.empty": "Số điện thoại không được để trống.",
    "string.pattern.base": "Số điện thoại không hợp lệ (phải gồm 10 chữ số bắt đầu bằng 03, 05, 07, 08 hoặc 09).",
  }),
  referral: Joi.string().allow("").optional(),
  // Từ đây trở xuống chỉ kiểm tra ĐỊNH DẠNG. Trường nào bắt buộc là do cấu hình
  // trường của từng công ty quyết định, được kiểm ở controller (publicRegister)
  // để form công khai khớp đúng với popup thêm học viên.
  email: Joi.string().email().optional().messages({
    "any.required": "Email là bắt buộc.",
    "string.empty": "Email không được để trống.",
    "string.email": "Định dạng email không hợp lệ.",
  }),
  birthday: Joi.string().allow("").optional().pattern(/^\d{1,2}\/\d{1,2}\/\d{4}$/).messages({
    "string.pattern.base": "Ngày sinh không đúng định dạng DD/MM/YYYY.",
  }),
  idCard: Joi.string().allow("").optional().pattern(/^\d{12}$/).messages({
    "string.pattern.base": "Số CCCD phải có đúng 12 chữ số.",
  }),
  rank: Joi.string().allow("").optional(),
  enrollmentDate: Joi.string().allow("").optional().pattern(/^\d{1,2}\/\d{1,2}\/\d{4}$/).messages({
    "string.pattern.base": "Ngày nhập học không đúng định dạng DD/MM/YYYY.",
  }),
  address: Joi.string().allow("").optional(),
  idCardFrontFile: uploadedFileSchema.optional(),
  idCardBackFile: uploadedFileSchema.optional(),
  portraitFile: uploadedFileSchema.optional(),
  teacherId: objectIdSchema.required().messages({
    "any.required": "ID giáo viên là bắt buộc.",
    "string.empty": "ID giáo viên không được để trống.",
  }),
});
