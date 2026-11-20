import Joi from 'joi';
import type { RequestValidationSchema } from '../middlewares/validate.js';
import type { WorkoutAvailabilitySlot } from '../types/workoutAvailability.js';
import { commonMessages, objectId } from './commonValidator.js';

const availabilitySlot = Joi.object({
  dayNumber: Joi.number().integer().min(1).max(7).required(),
  startMinute: Joi.number().integer().min(0).max(1425).multiple(15).required(),
  endMinute: Joi.number()
    .integer()
    .min(15)
    .max(1440)
    .multiple(15)
    .greater(Joi.ref('startMinute'))
    .required(),
}).unknown(false).messages(commonMessages);

const availabilitySlots = Joi.array()
  .min(1)
  .items(availabilitySlot)
  .custom((slots: WorkoutAvailabilitySlot[], helpers) => {
    const sorted = [...slots].sort((left, right) => (
      left.dayNumber - right.dayNumber || left.startMinute - right.startMinute
    ));

    for (let index = 1; index < sorted.length; index += 1) {
      const previous = sorted[index - 1];
      const current = sorted[index];
      if (previous.dayNumber === current.dayNumber && current.startMinute < previous.endMinute) {
        return helpers.message({
          custom: 'Các khung giờ rảnh trong cùng ngày không được chồng nhau.',
        });
      }
    }

    return slots;
  })
  .messages({ ...commonMessages, custom: '{{#message}}' });

export const workoutProposalFields = {
  durationWeeks: Joi.number().integer().min(1).max(12).required(),
  sessionsPerWeek: Joi.number().integer().min(1).max(7).required(),
  minutesPerSession: Joi.number().integer().min(15).max(240).required(),
  level: Joi.string().valid('BEGINNER', 'INTERMEDIATE', 'ADVANCED').required(),
  trainingMethod: Joi.string().required(),
  trainingSplit: Joi.string().required(),
  priorityMuscleGroups: Joi.array().items(Joi.string()).required(),
  restrictions: Joi.array().items(Joi.string()).required(),
};

export const workoutProposalRequestSchema: RequestValidationSchema = {
  body: Joi.object({
    customerId: objectId.required(),
    availabilitySlots: availabilitySlots.required(),
  }).messages(commonMessages),
};

export const workoutGenerationRequestSchema: RequestValidationSchema = {
  body: Joi.object({
    customerId: objectId.required(),
    proposal: Joi.object(workoutProposalFields).required(),
    availabilitySlots: availabilitySlots.required(),
    additionalRequest: Joi.string().allow('').max(1000),
  }).messages(commonMessages),
};
