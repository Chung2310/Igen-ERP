import Joi from 'joi';
import type { RequestValidationSchema } from '../middlewares/validate.js';
import { commonMessages, idParams, nonEmptyPatch, objectId, paginationQuery } from './commonValidator.js';

const systemFields = { ptId: Joi.forbidden(), status: Joi.forbidden(), publishedAt: Joi.forbidden(), version: Joi.forbidden() };
export const contentListSchema: RequestValidationSchema = { query: Joi.object({ ...paginationQuery, status: Joi.string().valid('DRAFT', 'PUBLISHED'), customerId: objectId, sortBy: Joi.string().optional(), sortOrder: Joi.string().valid('asc', 'desc').optional() }).messages(commonMessages) };
export const contentIdSchema: RequestValidationSchema = { params: idParams() };
const segmentalSchema = Joi.object({
  rightArm: Joi.number().allow(null),
  leftArm: Joi.number().allow(null),
  trunk: Joi.number().allow(null),
  rightLeg: Joi.number().allow(null),
  leftLeg: Joi.number().allow(null),
}).allow(null);

const inbodyFields = {
  customerId: objectId,
  measurementDate: Joi.date().iso(),
  weight: Joi.number().positive(),
  height: Joi.number().min(0).allow(null),
  bmi: Joi.number().min(0).allow(null),
  bodyFatPercentage: Joi.number().min(0).max(100).allow(null),
  bodyFatMass: Joi.number().min(0).allow(null),
  muscleMass: Joi.number().min(0).allow(null),
  bmr: Joi.number().min(0).allow(null),
  visceralFatLevel: Joi.number().min(0).allow(null),
  inbodyScore: Joi.number().min(0).allow(null),
  bodyWater: Joi.number().min(0).allow(null),
  boneMineral: Joi.number().min(0).allow(null),
  waistHipRatio: Joi.number().min(0).allow(null),
  segmentalMuscle: segmentalSchema,
  segmentalFat: segmentalSchema,
  consultationNotes: Joi.string().allow('', null),
  source: Joi.string().valid('MANUAL', 'AI_SCAN'),
  strengths: Joi.string().allow('', null),
  priorities: Joi.string().allow('', null),
  recommendation: Joi.string().allow('', null),
};
export const inbodySchemas = { create: { body: Joi.object({ ...inbodyFields, customerId: objectId.required(), measurementDate: Joi.date().iso().required(), weight: Joi.number().positive().required() }).messages(commonMessages) }, update: { body: nonEmptyPatch({ ...inbodyFields, ...systemFields }) } } satisfies Record<string, RequestValidationSchema>;
export const confirmInbodyOcrSchema: RequestValidationSchema = {
  params: idParams(),
  body: nonEmptyPatch({
    customerId: objectId.optional().allow(null),
    measurementDate: Joi.date().iso().allow(null),
    weight: Joi.number().positive().allow(null),
    height: Joi.number().min(0).allow(null),
    bodyFatPercentage: Joi.number().min(0).max(100).allow(null),
    bmi: Joi.number().min(0).allow(null),
    bodyFatMass: Joi.number().min(0).allow(null),
    muscleMass: Joi.number().min(0).allow(null),
    bmr: Joi.number().min(0).allow(null),
    visceralFatLevel: Joi.number().min(0).allow(null),
    inbodyScore: Joi.number().min(0).allow(null),
    bodyWater: Joi.number().min(0).allow(null),
    boneMineral: Joi.number().min(0).allow(null),
    waistHipRatio: Joi.number().min(0).allow(null),
    segmentalMuscle: segmentalSchema,
    segmentalFat: segmentalSchema,
    consultationNotes: Joi.string().allow('', null),
    strengths: Joi.string().allow('', null),
    priorities: Joi.string().allow('', null),
    recommendation: Joi.string().allow('', null),
  }),
};
const goalFields = { customerId: objectId, type: Joi.string().valid('WEIGHT_LOSS', 'FAT_LOSS', 'WEIGHT_GAIN', 'MUSCLE_GAIN', 'RECOMPOSITION', 'FITNESS'), title: Joi.string().trim(), deadline: Joi.date().iso(), targetValue: Joi.number().allow(null), sessionsPerWeek: Joi.number().integer().min(1).max(14), targetUnit: Joi.string().allow('', null), cardioNotes: Joi.string().allow('', null), evaluationNotes: Joi.string().allow('', null) };
export const goalSchemas = { create: { body: Joi.object({ ...goalFields, customerId: objectId.required(), type: goalFields.type.required(), title: goalFields.title.required(), deadline: goalFields.deadline.required() }).messages(commonMessages) }, update: { body: nonEmptyPatch({ ...goalFields, ...systemFields }) } } satisfies Record<string, RequestValidationSchema>;
const planExercise = Joi.object({ name: Joi.string().trim().required(), sets: Joi.number().integer().min(1), reps: Joi.string(), notes: Joi.string().allow('') }).messages(commonMessages);
const planSession = Joi.object({ name: Joi.string().trim().required(), exercises: Joi.array().items(planExercise).required() }).messages(commonMessages);
const workoutFields = { customerId: objectId, title: Joi.string().trim(), sessions: Joi.array().items(planSession), startDate: Joi.date().iso(), endDate: Joi.date().iso(), notes: Joi.string().allow('') };
export const workoutPlanSchemas = { create: { body: Joi.object({ ...workoutFields, customerId: objectId.required(), title: workoutFields.title.required(), sessions: workoutFields.sessions.required() }).messages(commonMessages) }, update: { body: nonEmptyPatch({ ...workoutFields, ...systemFields }) } } satisfies Record<string, RequestValidationSchema>;
const validateNutritionDates = (value: Record<string, unknown>, helpers: any) => {
  if (value.startDate && value.endDate) {
    const start = new Date(value.startDate as string).getTime();
    const end = new Date(value.endDate as string).getTime();
    if (end < start) {
      return helpers.message({ custom: 'Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.' });
    }
    const diffDays = Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1;
    if (diffDays > 31) {
      return helpers.message({ custom: 'Khoảng thời gian áp dụng thực đơn tối đa là 1 tháng (31 ngày).' });
    }
  }
  return value;
};
const macros = Joi.object({
  protein: Joi.number().min(0).required(),
  carbs: Joi.number().min(0).required(),
  fat: Joi.number().min(0).required(),
}).messages(commonMessages);

// AI and mobile editors retain the complete per-day schedule alongside the weekly menu.
const nutritionDailyPlans = Joi.array().max(31).items(Joi.object({
  dayOfWeek: Joi.string().allow(''),
  dayNumber: Joi.number().integer().min(1).max(31),
  date: Joi.date().iso().allow(null, ''),
  meals: Joi.array().items(Joi.object().unknown(true)).required(),
}).unknown(true)).allow(null);

const nutritionFields = {
  customerId: objectId,
  title: Joi.string().trim(),
  targetCalories: Joi.number().positive(),
  macros,
  bmr: Joi.number().min(0).allow(null),
  tdee: Joi.number().min(0).allow(null),
  startDate: Joi.date().iso().allow(null),
  endDate: Joi.date().iso().allow(null),
  durationDays: Joi.number().integer().min(1).max(31).allow(null),
  menu: Joi.array(),
  dailyPlans: nutritionDailyPlans,
  createdByAi: Joi.boolean().allow(null),
  reviewStatus: Joi.string().valid('NOT_REQUIRED', 'PT_REVIEW_REQUIRED', 'APPROVED', 'REJECTED').allow(null),
  notes: Joi.string().allow('', null),
};
export const nutritionPlanSchemas = { create: { body: Joi.object({ ...nutritionFields, customerId: objectId.required(), title: nutritionFields.title.required(), targetCalories: nutritionFields.targetCalories.required(), macros: macros.required() }).custom(validateNutritionDates).messages(commonMessages) }, update: { body: nonEmptyPatch({ ...nutritionFields, ...systemFields }).custom(validateNutritionDates).messages(commonMessages) } } satisfies Record<string, RequestValidationSchema>;
const sessionSchema = Joi.object({ sessionNumber: Joi.number().min(1), name: Joi.string().allow('', null), focus: Joi.string().allow('', null), exercises: Joi.array().items(Joi.string()) }).unknown(true);
const week = Joi.object({ week: Joi.number().integer().min(1).required(), focus: Joi.string().trim().required(), sessionTargets: Joi.number().min(0).allow(null), sessions: Joi.array().items(sessionSchema) }).messages(commonMessages);
const phase = Joi.object({ order: Joi.number().integer().min(1).required(), name: Joi.string().trim().required(), durationWeeks: Joi.number().integer().min(1).required(), goals: Joi.array().items(Joi.string()), weeks: Joi.array().items(week) }).messages(commonMessages);
const phases = Joi.array().min(1).items(phase).custom((value: Array<{ order: number }>, helpers) => new Set(value.map((item) => item.order)).size === value.length ? value : helpers.error('array.unique'));
export const listRoadmapsSchema: RequestValidationSchema = { query: Joi.object({ ...paginationQuery, customerId: objectId, status: Joi.string().valid('DRAFT', 'PUBLISHED'), search: Joi.string().trim().allow('') }).messages(commonMessages) };
const roadmapBaseline = Joi.object().pattern(Joi.string(), Joi.number()).messages(commonMessages);
const roadmapStrategy = Joi.object().unknown(true);
export const createRoadmapSchema: RequestValidationSchema = { body: Joi.object({ customerId: objectId.required(), title: Joi.string().trim().required(), baseline: roadmapBaseline, strategy: roadmapStrategy, phases: phases.required() }).messages(commonMessages) };
export const updateRoadmapSchema: RequestValidationSchema = { params: idParams(), body: nonEmptyPatch({ title: Joi.string().trim(), baseline: roadmapBaseline, strategy: roadmapStrategy, phases, customerId: objectId, ...systemFields }) };
const exerciseVideo = Joi.object({
  title: Joi.string().trim().max(120).required(),
  url: Joi.string().trim().uri({ scheme: ['http', 'https'] }).max(2048).required(),
  source: Joi.string().valid('UPLOAD', 'LINK').required(),
}).messages(commonMessages);
const classifiedTrackingType = Joi.string().valid('STRENGTH', 'BODYWEIGHT', 'CARDIO', 'INTERVAL', 'MOBILITY');
const exerciseFields = { name: Joi.string().trim(), muscleGroup: Joi.string().trim().allow(''), muscleGroups: Joi.array().items(Joi.string().trim()), level: Joi.string().valid('BEGINNER', 'INTERMEDIATE', 'ADVANCED'), defaultTrackingType: classifiedTrackingType, equipment: Joi.array().items(Joi.string()), scope: Joi.string().valid('GLOBAL', 'PRIVATE'), description: Joi.string().allow(''), videoUrl: Joi.string().uri().allow('', null), videos: Joi.array().items(exerciseVideo).max(20), technique: Joi.string().allow(''), commonMistakes: Joi.array().items(Joi.string()), contraindications: Joi.array().items(Joi.string()), variants: Joi.array().items(Joi.string()) };
export const listExercisesSchema: RequestValidationSchema = { query: Joi.object({ ...paginationQuery, level: exerciseFields.level, defaultTrackingType: Joi.string().valid('UNCLASSIFIED', 'STRENGTH', 'BODYWEIGHT', 'CARDIO', 'INTERVAL', 'MOBILITY'), muscleGroup: Joi.string().allow(''), keyword: Joi.string().allow(''), search: Joi.string().allow('') }).messages(commonMessages) };
export const createExerciseSchema: RequestValidationSchema = { body: Joi.object({ ...exerciseFields, name: exerciseFields.name.required(), level: exerciseFields.level.required(), defaultTrackingType: classifiedTrackingType.required() }).or('muscleGroup', 'muscleGroups').messages(commonMessages) };
const reviewedAiExercise = Joi.object({
  name: exerciseFields.name.required(),
  muscleGroup: exerciseFields.muscleGroup,
  muscleGroups: exerciseFields.muscleGroups,
  level: exerciseFields.level.required(),
  defaultTrackingType: classifiedTrackingType.required(),
  equipment: exerciseFields.equipment.default([]),
  description: exerciseFields.description.default(''),
  technique: exerciseFields.technique.default(''),
  commonMistakes: exerciseFields.commonMistakes.default([]),
  contraindications: exerciseFields.contraindications.default([]),
  variants: exerciseFields.variants.default([]),
}).or('muscleGroup', 'muscleGroups').unknown(false).messages(commonMessages);
export const bulkCreateExercisesSchema: RequestValidationSchema = {
  body: Joi.object({ exercises: Joi.array().items(reviewedAiExercise).min(1).max(10).required() }).messages(commonMessages),
};
export const checkExerciseDuplicatesSchema: RequestValidationSchema = {
  body: Joi.object({ names: Joi.array().items(Joi.string().trim().allow('')).max(10).required() }).messages(commonMessages),
};
export const updateExerciseSchema: RequestValidationSchema = { params: idParams(), body: nonEmptyPatch({ ...exerciseFields, scope: Joi.forbidden(), ownerPtId: Joi.forbidden() }) };
export const createMuscleGroupSchema: RequestValidationSchema = {
  body: Joi.object({
    name: Joi.string().trim().min(1).max(100).required(),
  }).messages(commonMessages),
};
