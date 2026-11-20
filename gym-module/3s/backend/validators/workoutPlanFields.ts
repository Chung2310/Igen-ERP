/* oxlint-disable unicorn/no-thenable -- Joi's conditional schema API requires the `then` key. */
import Joi from 'joi';
import { commonMessages, objectId } from './commonValidator.js';

export const classifiedTrackingType = Joi.string().valid('STRENGTH', 'BODYWEIGHT', 'CARDIO', 'INTERVAL', 'MOBILITY');

const strengthPrescription = Joi.object({
  sets: Joi.number().integer().min(1),
  reps: Joi.string().allow(''),
  targetWeight: Joi.number().min(0),
  targetRpe: Joi.number().min(0).max(10),
  targetRir: Joi.number().min(0),
  restSeconds: Joi.number().min(0),
}).unknown(false);

const bodyweightPrescription = Joi.object({
  sets: Joi.number().integer().min(1),
  reps: Joi.string().allow(''),
  addedWeight: Joi.number().min(0),
  targetRpe: Joi.number().min(0).max(10),
  targetRir: Joi.number().min(0),
  restSeconds: Joi.number().min(0),
}).unknown(false);

const cardioPrescription = Joi.object({
  durationMinutes: Joi.number().positive(),
  distanceKm: Joi.number().positive(),
  targetPaceSecondsPerKm: Joi.number().positive(),
  targetHeartRate: Joi.number().positive(),
  inclinePercent: Joi.number().min(0),
  targetRpe: Joi.number().min(0).max(10),
}).unknown(false);

const intervalPrescription = Joi.object({
  rounds: Joi.number().integer().min(1),
  workSeconds: Joi.number().positive(),
  restSeconds: Joi.number().min(0),
  distanceMetersPerRound: Joi.number().positive(),
  repsPerRound: Joi.number().integer().positive(),
  targetRpe: Joi.number().min(0).max(10),
}).unknown(false);

const mobilityPrescription = Joi.object({
  durationMinutes: Joi.number().positive(),
  reps: Joi.number().integer().positive(),
  side: Joi.string().valid('LEFT', 'RIGHT', 'BOTH'),
  targetDiscomfort: Joi.number().min(0).max(10),
}).unknown(false);

const trackingPrescription = Joi.alternatives().conditional('trackingType', {
  switch: [
    { is: 'STRENGTH', then: strengthPrescription.required() },
    { is: 'BODYWEIGHT', then: bodyweightPrescription.required() },
    { is: 'CARDIO', then: cardioPrescription.required() },
    { is: 'INTERVAL', then: intervalPrescription.required() },
    { is: 'MOBILITY', then: mobilityPrescription.required() },
  ],
});

const studioExerciseFields = {
  exerciseId: objectId,
  name: Joi.string().trim().required(),
  muscleGroup: Joi.string().trim().allow('', null),
  trackingType: classifiedTrackingType.required(),
  prescription: trackingPrescription.required(),
  sets: Joi.number().integer().min(1),
  reps: Joi.string().allow(''),
  weight: Joi.alternatives().try(Joi.string(), Joi.number()),
  rpe: Joi.number().min(0).max(10),
  rir: Joi.number().min(0),
  tempo: Joi.string().allow(''),
  restSeconds: Joi.number().min(0),
  notes: Joi.string().allow(''),
};

const studioExercise = Joi.object(studioExerciseFields).messages(commonMessages);
const studioSession = Joi.object({
  name: Joi.string().trim().required(),
  exercises: Joi.array().items(studioExercise).required(),
}).messages(commonMessages);

const scheduledExercise = Joi.object({
  ...studioExerciseFields,
  weekNumber: Joi.number().integer().min(1).default(1),
  dayNumber: Joi.number().integer().min(1).max(7).required(),
  startMinute: Joi.number().integer().min(0).max(1425).multiple(15).required(),
  durationMinutes: Joi.number().integer().min(15).max(1440).multiple(15).required(),
}).messages(commonMessages);

const unscheduledExercise = Joi.object({
  ...studioExerciseFields,
  durationMinutes: Joi.number().integer().min(15).max(1440).multiple(15).required(),
}).messages(commonMessages);

export const studioPlanFields = {
  title: Joi.string().trim(),
  goal: Joi.string().trim().min(1),
  level: Joi.string().valid('BEGINNER', 'INTERMEDIATE', 'ADVANCED'),
  durationDays: Joi.number().integer().min(1).max(365),
  muscleGroups: Joi.array().items(Joi.string().trim().min(1).max(100)).max(20),
  defaultSets: Joi.number().integer().min(1).max(100),
  defaultReps: Joi.string().trim().allow('').max(100),
  defaultWeight: Joi.string().trim().allow('').max(100),
  defaultTempo: Joi.string().trim().allow('').max(100),
  technicalNotes: Joi.string().trim().allow('').max(2000),
  scheduledExercises: Joi.array().items(scheduledExercise),
  unscheduledExercises: Joi.array().items(unscheduledExercise),
  sessions: Joi.array().min(1).items(studioSession),
};

export function studioScheduleError(value: Record<string, unknown>): string | undefined {
  const hasDurationDays = value.durationDays !== undefined && value.durationDays !== null;
  const durationDays = Number(value.durationDays);
  const items = (value.scheduledExercises || []) as Array<{
    weekNumber?: number;
    dayNumber: number;
    startMinute: number;
    durationMinutes: number;
  }>;

  for (const item of items) {
    const dayIndex = ((Number(item.weekNumber || 1) - 1) * 7) + Number(item.dayNumber);
    if ((hasDurationDays && dayIndex > durationDays) || item.startMinute + item.durationMinutes > 1440) {
      return 'Lịch bài tập vượt quá ngày hoặc khung 24 giờ.';
    }
  }

  const sorted = [...items].sort((a, b) => (
    Number(a.weekNumber || 1) - Number(b.weekNumber || 1)
    || a.dayNumber - b.dayNumber
    || a.startMinute - b.startMinute
  ));
  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1];
    const current = sorted[index];
    if (
      Number(previous.weekNumber || 1) === Number(current.weekNumber || 1)
      && previous.dayNumber === current.dayNumber
      && current.startMinute < previous.startMinute + previous.durationMinutes
    ) {
      return 'Các bài tập trong cùng ngày không được trùng thời gian.';
    }
  }
}

export function mergedStudioScheduleError(current: Record<string, unknown>, patch: Record<string, unknown>): string | undefined {
  return studioScheduleError({
    durationDays: Object.prototype.hasOwnProperty.call(patch, 'durationDays') ? patch.durationDays : current.durationDays,
    scheduledExercises: Object.prototype.hasOwnProperty.call(patch, 'scheduledExercises') ? patch.scheduledExercises : current.scheduledExercises,
  });
}

export const validateStudioSchedule = (value: Record<string, unknown>, helpers: Joi.CustomHelpers) => {
  const message = studioScheduleError(value);
  return message ? helpers.message({ custom: message }) : value;
};
