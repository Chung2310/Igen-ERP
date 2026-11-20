import Joi from 'joi';
import type { RequestValidationSchema } from '../middlewares/validate.js';
import { commonMessages, idParams, nonEmptyPatch, objectId, paginationQuery } from './commonValidator.js';
import { classifiedTrackingType, studioPlanFields, validateStudioSchedule } from './workoutPlanFields.js';

const generatedExercise = Joi.object({ name: Joi.string().trim().required(), muscleGroup: Joi.string().trim().required(), level: Joi.string().valid('BEGINNER', 'INTERMEDIATE', 'ADVANCED').required(), defaultTrackingType: classifiedTrackingType.required(), equipment: Joi.array().items(Joi.string()).default([]), description: Joi.string().allow('').default(''), technique: Joi.string().allow('').default(''), commonMistakes: Joi.array().items(Joi.string()).default([]), contraindications: Joi.array().items(Joi.string()).default([]), variants: Joi.array().items(Joi.string()).default([]) }).messages(commonMessages);
const templateFields = { ...studioPlanFields, generatedExercises: Joi.array().items(generatedExercise).max(50) };
export const createWorkoutTemplateSchema: RequestValidationSchema = { body: Joi.object({ ...templateFields, title: templateFields.title.required() }).custom((value, helpers) => { if (!value.sessions?.length && !value.scheduledExercises?.length) return helpers.message({ custom: 'Giáo án phải có buổi tập hoặc lịch bài tập.' }); if (value.scheduledExercises?.length && !value.durationDays) return helpers.message({ custom: 'Vui lòng nhập số ngày của giáo án.' }); return validateStudioSchedule(value, helpers); }).messages({ ...commonMessages, custom: '{{#message}}' }) };
export const listWorkoutTemplatesSchema: RequestValidationSchema = { query: Joi.object({ ...paginationQuery, status: Joi.string().valid('ACTIVE', 'ARCHIVED'), goal: Joi.string(), level: Joi.string() }).messages(commonMessages) };
export const workoutTemplateIdSchema: RequestValidationSchema = { params: idParams() };
export const updateWorkoutTemplateSchema: RequestValidationSchema = { params: idParams(), body: nonEmptyPatch(templateFields).custom(validateStudioSchedule).messages({ ...commonMessages, custom: '{{#message}}' }) };
const setLog = Joi.object({ reps: Joi.number().min(0), weight: Joi.number().min(0), rpe: Joi.number().min(0).max(10), rir: Joi.number().min(0), completed: Joi.boolean() }).messages(commonMessages);
const exerciseLog = Joi.object({ exerciseId: objectId, name: Joi.string().trim().required(), sets: Joi.array().items(setLog), notes: Joi.string().allow('') }).messages(commonMessages);
const completedSetResult = Joi.object({ reps: Joi.number().min(0), weight: Joi.number().min(0), addedWeight: Joi.number().min(0), rpe: Joi.number().min(0).max(10), rir: Joi.number().min(0), completed: Joi.boolean().required() }).unknown(false);
const trackingResult = Joi.alternatives().try(
  Joi.object({ sets: Joi.array().min(1).items(completedSetResult).required() }).unknown(false),
  Joi.object({ durationMinutes: Joi.number().min(0), distanceKm: Joi.number().min(0), paceSecondsPerKm: Joi.number().min(0), averageHeartRate: Joi.number().min(0), inclinePercent: Joi.number().min(0), calories: Joi.number().min(0), rpe: Joi.number().min(0).max(10) }).min(1).unknown(false),
  Joi.object({ rounds: Joi.number().integer().min(0), workSeconds: Joi.number().min(0), restSeconds: Joi.number().min(0), distanceMetersPerRound: Joi.number().min(0), repsPerRound: Joi.number().integer().min(0), rpe: Joi.number().min(0).max(10) }).min(1).unknown(false),
  Joi.object({ durationMinutes: Joi.number().min(0), reps: Joi.number().integer().min(0), side: Joi.string().valid('LEFT', 'RIGHT', 'BOTH'), discomfort: Joi.number().min(0).max(10) }).min(1).unknown(false),
);
const exerciseResult = Joi.object({ exerciseId: objectId, exerciseIndex: Joi.number().integer().min(0).required(), result: trackingResult.required(), notes: Joi.string().allow('') }).unknown(false);
const sessionBodyMeasurement = Joi.object({
  weight: Joi.number().positive(),
  bodyFatPercentage: Joi.number().min(0).max(100),
  muscleMass: Joi.number().min(0),
  measurements: Joi.object({ chest: Joi.number().min(0), waist: Joi.number().min(0), hips: Joi.number().min(0), arm: Joi.number().min(0), thigh: Joi.number().min(0), calf: Joi.number().min(0) }).min(1),
}).min(1).unknown(false);
const sessionProgressPhotos = Joi.array().min(1).max(4).items(Joi.object({
  photoUrl: Joi.string().trim().required(),
  angle: Joi.string().valid('FRONT', 'SIDE', 'BACK', 'OTHER').required(),
}).unknown(false));
const sessionCustomerSignature = Joi.object({
  signatureUrl: Joi.string().trim().required(),
  signedAt: Joi.date().iso(),
  signerName: Joi.string().trim().allow(''),
}).unknown(false);
// oxlint-disable-next-line unicorn/no-thenable -- Joi's conditional schema API requires the `then` key.
export const createWorkoutSessionSchema: RequestValidationSchema = { body: Joi.object({ customerId: objectId.required(), workoutPlanId: objectId.required(), workoutPlanVersion: Joi.number().integer().min(1).required(), sessionIndex: Joi.number().integer().min(0).required(), performedAt: Joi.date().iso().required(), attendance: Joi.string().valid('PRESENT', 'ABSENT', 'LATE').required(), exerciseResults: Joi.array().items(exerciseResult).required(), absenceReason: Joi.string().allow(''), feeling: Joi.string().allow(''), notes: Joi.string().allow(''), idempotencyKey: Joi.string().trim().required(), bodyMeasurement: Joi.when('attendance', { is: 'ABSENT', then: Joi.forbidden(), otherwise: sessionBodyMeasurement }), progressPhotos: Joi.when('attendance', { is: 'ABSENT', then: Joi.forbidden(), otherwise: sessionProgressPhotos }), customerSignature: Joi.when('attendance', { is: 'ABSENT', then: Joi.forbidden(), otherwise: sessionCustomerSignature }) }).messages(commonMessages) };
export const updateWorkoutSessionSchema: RequestValidationSchema = { params: idParams(), body: nonEmptyPatch({ performedAt: Joi.date().iso(), attendance: Joi.string().valid('PRESENT', 'ABSENT', 'LATE'), absenceReason: Joi.string().allow(''), exerciseLogs: Joi.array().items(exerciseLog), feeling: Joi.string().allow(''), notes: Joi.string().allow(''), customerId: Joi.forbidden(), templateId: Joi.forbidden(), planSnapshot: Joi.forbidden(), idempotencyKey: Joi.forbidden() }) };
export const listWorkoutSessionsSchema: RequestValidationSchema = { query: Joi.object({ ...paginationQuery, customerId: objectId.required(), attendance: Joi.string().valid('PRESENT', 'ABSENT', 'LATE'), from: Joi.date().iso(), to: Joi.date().iso() }).messages(commonMessages) };
const circumferenceFields = { chest: Joi.number().min(0), waist: Joi.number().min(0), hips: Joi.number().min(0), arm: Joi.number().min(0), thigh: Joi.number().min(0), calf: Joi.number().min(0) };
const measurementFields = { measuredAt: Joi.date().iso(), weight: Joi.number().positive(), bodyFatPercentage: Joi.number().min(0).max(100), muscleMass: Joi.number().min(0), measurements: Joi.object(circumferenceFields), ...circumferenceFields, notes: Joi.string().allow('') };
export const createBodyMeasurementSchema: RequestValidationSchema = { body: Joi.object({ customerId: objectId.required(), ...measurementFields, measuredAt: measurementFields.measuredAt.required() }).messages(commonMessages) };
export const updateBodyMeasurementSchema: RequestValidationSchema = { params: idParams(), body: nonEmptyPatch({ ...measurementFields, customerId: Joi.forbidden() }) };
export const bodyMeasurementIdSchema: RequestValidationSchema = { params: idParams() };
export const customerProgressSchema: RequestValidationSchema = { params: Joi.object({ customerId: objectId.required() }).messages(commonMessages) };
