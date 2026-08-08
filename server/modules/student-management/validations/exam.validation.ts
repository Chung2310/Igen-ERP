import Joi from "joi";
import { objectIdSchema } from "./student.validation";

export const createExamSchema = Joi.object({
  companyCode: Joi.string().trim().min(1).optional(),
  name: Joi.string().required().messages({
    "any.required": "Tên kỳ thi là bắt buộc.",
    "string.empty": "Tên kỳ thi không được để trống.",
  }),
  status: Joi.string().valid("Sắp diễn ra", "Đã xác nhận", "Đã hoàn thành", "Đã hủy").required().messages({
    "any.required": "Trạng thái kỳ thi là bắt buộc.",
  }),
  rank: Joi.string().allow("").optional(),
  tentativeDate: Joi.string().required().messages({
    "any.required": "Ngày dự kiến thi là bắt buộc.",
  }),
  officialDate: Joi.string().allow("").optional(),
  location: Joi.string().required().messages({
    "any.required": "Địa điểm thi là bắt buộc.",
  }),
  batchId: objectIdSchema.required(),
  maxScore: Joi.number().min(1).max(10000).default(100),
  passScore: Joi.number().min(0).max(10000).optional(),
  studentCount: Joi.number().optional(),
  passCount: Joi.number().optional(),
  failCount: Joi.number().optional(),
  customFields: Joi.object().unknown(true).optional(),
});

export const updateExamSchema = Joi.object({
  expectedVersion: Joi.number().integer().min(0).optional(),
  name: Joi.string().optional(),
  status: Joi.string().valid("Sắp diễn ra", "Đã xác nhận", "Đã hoàn thành", "Đã hủy").optional(),
  rank: Joi.string().allow("").optional(),
  tentativeDate: Joi.string().optional(),
  officialDate: Joi.string().allow("").optional(),
  location: Joi.string().optional(),
  batchId: objectIdSchema.optional(),
  maxScore: Joi.number().min(1).max(10000).optional(),
  passScore: Joi.number().min(0).max(10000).optional(),
  studentCount: Joi.number().optional(),
  passCount: Joi.number().optional(),
  failCount: Joi.number().optional(),
  customFields: Joi.object().unknown(true).optional(),
});

export const assignStudentSchema = Joi.object({
  studentId: objectIdSchema.optional(),
  studentIds: Joi.array().items(objectIdSchema).optional(),
  examId: Joi.string().allow("").optional(),
  examName: Joi.string().allow("").optional(),
  examDate: Joi.string().allow("").optional(),
}).or("studentId", "studentIds");

export const unassignStudentSchema = Joi.object({
  studentId: objectIdSchema.required().messages({
    "any.required": "ID học viên là bắt buộc.",
  }),
});

export const updateStudentResultSchema = Joi.object({
  overallResult: Joi.string().valid("Đậu", "Trượt", "Chưa có").required().messages({
    "any.required": "Kết quả thi (overallResult) là bắt buộc.",
    "any.only": "Kết quả thi chỉ được phép là 'Đậu', 'Trượt' hoặc 'Chưa có'.",
  }),
});

export const gradeExamSchema = Joi.object({
  results: Joi.array().items(Joi.object({ studentId: objectIdSchema.required(), score: Joi.number().min(0).required(), note: Joi.string().allow("").max(1000).default("") })).min(1).required(),
});

export const examStudentParamsSchema = Joi.object({
  id: objectIdSchema.required(),
  studentId: objectIdSchema.required(),
});

export const importResultsSchema = Joi.object({
  results: Joi.array().items(
    Joi.object({
      phone: Joi.string().required().messages({
        "any.required": "Số điện thoại là bắt buộc.",
      }),
      overallResult: Joi.string().valid("Đậu", "Trượt", "Chưa có").required().messages({
        "any.required": "Kết quả thi là bắt buộc.",
        "any.only": "Kết quả thi chỉ được phép là 'Đậu', 'Trượt' hoặc 'Chưa có'.",
      }),
      theory: Joi.number().optional().default(0),
      practice: Joi.number().optional().default(0),
      simulation: Joi.number().optional().default(0),
    })
  ).required().messages({
    "any.required": "Danh sách kết quả cập nhật là bắt buộc.",
  }),
  preview: Joi.boolean().optional(),
  importUpload: Joi.object({
    uploadToken: Joi.string().trim().required(),
    fileName: Joi.string().trim().required(),
  }).optional(),
});
