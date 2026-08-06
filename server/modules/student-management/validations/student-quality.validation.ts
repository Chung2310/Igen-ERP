import Joi from "joi";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export const studentQualityListSchema = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
  search: Joi.string().trim().max(120).allow("").optional(),
  batchId: Joi.string().trim().optional(),
  courseId: Joi.string().trim().optional(),
  instructorId: Joi.string().trim().optional(),
  studentStatus: Joi.string().trim().max(80).optional(),
  warningLevel: Joi.string().valid("risk", "watch", "good", "unrated").optional(),
  ownerFilter: Joi.string().trim().optional(),
});

export const studentQualityParamsSchema = Joi.object({
  batchId: Joi.string().required(),
  studentId: Joi.string().required(),
});

export const miniTestParamsSchema = studentQualityParamsSchema.keys({
  miniTestId: Joi.string().required(),
});

export const updateStudentQualitySchema = Joi.object({
  attitudeNote: Joi.string().trim().max(4000).allow("").optional(),
  teacherAssessment: Joi.string().trim().max(4000).allow("").optional(),
}).min(1);

export const createMiniTestSchema = Joi.object({
  title: Joi.string().trim().max(200).required(),
  date: Joi.string().pattern(datePattern).required(),
  score: Joi.number().min(0).required(),
  maxScore: Joi.number().greater(0).required(),
  note: Joi.string().trim().max(2000).allow("").optional(),
}).custom((value, helpers) => value.score <= value.maxScore ? value : helpers.error("any.invalid"))
  .messages({ "any.invalid": "Điểm không được lớn hơn thang điểm." });

export const updateMiniTestSchema = Joi.object({
  title: Joi.string().trim().max(200).optional(),
  date: Joi.string().pattern(datePattern).optional(),
  score: Joi.number().min(0).optional(),
  maxScore: Joi.number().greater(0).optional(),
  note: Joi.string().trim().max(2000).allow("").optional(),
}).min(1);

export const assignmentScoreParamsSchema = studentQualityParamsSchema.keys({
  assignmentId: Joi.string().required(),
});

export const gradeAssignmentSchema = Joi.object({
  score: Joi.number().min(0).max(10000).required(),
  feedback: Joi.string().trim().max(2000).allow("").optional(),
});

export const qualityThresholdSchema = Joi.object({
  riskAttendance: Joi.number().min(0).max(100).required(), riskAssignment: Joi.number().min(0).max(100).required(), riskMiniTest: Joi.number().min(0).max(100).required(),
  watchAttendance: Joi.number().min(0).max(100).required(), watchAssignment: Joi.number().min(0).max(100).required(), watchMiniTest: Joi.number().min(0).max(100).required(),
  assignmentMaxScore: Joi.number().min(1).max(10000).required(),
});
