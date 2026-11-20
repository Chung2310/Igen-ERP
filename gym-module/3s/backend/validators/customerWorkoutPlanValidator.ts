import Joi from 'joi';
import type { RequestValidationSchema } from '../middlewares/validate.js';
import { commonMessages, objectId } from './commonValidator.js';
import { studioPlanFields, validateStudioSchedule } from './workoutPlanFields.js';

const params = Joi.object({ id: objectId.required() }).messages(commonMessages);
const planParams = Joi.object({ id: objectId.required(), planId: objectId.required() }).messages(commonMessages);

export const listCustomerPlansSchema: RequestValidationSchema = { params };
export const assignCustomerPlanSchema: RequestValidationSchema = { params, body: Joi.object({ templateId: objectId.required() }).messages(commonMessages) };
export const getCustomerPlanSchema: RequestValidationSchema = { params: planParams };
export const updateCustomerPlanSchema: RequestValidationSchema = {
  params: planParams,
  body: Joi.object(studioPlanFields)
    .min(1)
    .custom(validateStudioSchedule)
    .messages({ ...commonMessages, custom: '{{#message}}' }),
};
