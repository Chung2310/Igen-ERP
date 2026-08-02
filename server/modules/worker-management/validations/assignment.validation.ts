import Joi from "joi";

const objectIdPattern = /^[0-9a-fA-F]{24}$/;
const objectIdSchema = Joi.string().pattern(objectIdPattern).messages({
  "string.pattern.base": "Định dạng ID không hợp lệ.",
});

export const createAssignmentSchema = Joi.object({
  title: Joi.string().required().messages({
    "any.required": "Tiêu đề bài tập là bắt buộc.",
    "string.empty": "Tiêu đề bài tập không được để trống.",
  }),
  description: Joi.string().allow("").optional(),
  batchId: objectIdSchema.required().messages({
    "any.required": "Lớp học nhận bài tập là bắt buộc.",
  }),
  dueDate: Joi.date().iso().greater("now").optional().messages({
    "date.greater": "Hạn nộp bài phải là thời gian trong tương lai.",
  }),
  attachments: Joi.array()
    .items(
      Joi.object({
        name: Joi.string().required(),
        url: Joi.string().required(),
        type: Joi.string().required(),
      }),
    )
    .optional(),
});

export const updateAssignmentSchema = Joi.object({
  title: Joi.string().optional().messages({
    "string.empty": "Tiêu đề bài tập không được để trống.",
  }),
  description: Joi.string().allow("").optional(),
  dueDate: Joi.date().iso().greater("now").optional().messages({
    "date.greater": "Hạn nộp bài phải là thời gian trong tương lai.",
  }),
  attachments: Joi.array()
    .items(
      Joi.object({
        name: Joi.string().required(),
        url: Joi.string().required(),
        type: Joi.string().required(),
      }),
    )
    .optional(),
});

export const submitProofSchema = Joi.object({
  studentNotes: Joi.string().allow("").optional(),
  attachments: Joi.array()
    .min(1)
    .items(
      Joi.object({
        name: Joi.string().required(),
        url: Joi.string().required(),
        type: Joi.string().required(),
      }),
    )
    .required()
    .messages({
      "any.required": "Vui lòng đính kèm tệp minh chứng bài làm.",
      "array.min": "Cần tải lên ít nhất 1 tệp minh chứng bài làm.",
    }),
});

export const uploadProofFileSchema = Joi.object({
  file: Joi.string()
    .pattern(/^data:(image|application|video)\/[a-zA-Z0-9.+-]+;base64,/)
    .required()
    .messages({
      "any.required": "Trường 'file' là bắt buộc và không thể thiếu.",
      "string.empty": "Nội dung 'file' không được để trống.",
      "string.pattern.base":
        "Tệp minh chứng phải là dữ liệu ảnh/tài liệu được mã hóa base64 hợp lệ.",
    }),
});

export const gradeSubmissionSchema = Joi.object({
  score: Joi.number().min(0).max(10).required().messages({
    "any.required": "Điểm số là bắt buộc.",
    "number.min": "Điểm số không được nhỏ hơn 0.",
    "number.max": "Điểm số không được lớn hơn 10.",
  }),
  feedback: Joi.string().allow("").optional(),
});
