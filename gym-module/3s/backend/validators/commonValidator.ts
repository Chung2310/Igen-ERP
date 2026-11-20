import { isValidPassword, PASSWORD_ERROR } from '../services/passwordPolicy.js';
import Joi from 'joi';
import mongoose from 'mongoose';
import { joiMessages } from './validationMessages.js';

export const commonMessages: Record<string, string> = joiMessages;

export const objectId = Joi.string().custom((value: string, helpers) => (
  mongoose.isValidObjectId(value) ? value : helpers.error('string.objectId')
)).messages(commonMessages);

export const email = Joi.string().trim().email().messages(commonMessages);
export const isoDate = Joi.date().iso().messages(commonMessages);
export const passwordSchema = Joi.string().custom((value, helpers) => isValidPassword(value) ? value : helpers.error('string.password')).messages({
  ...commonMessages,
  'string.password': PASSWORD_ERROR,
});

export const paginationQuery = {
  page: Joi.number().integer().min(1).default(1).messages(commonMessages),
  limit: Joi.number().integer().min(1).max(100).default(20).messages(commonMessages),
};

export function idParams(field = 'id'): Joi.ObjectSchema {
  return Joi.object({ [field]: objectId.required() }).messages(commonMessages);
}

export function nonEmptyPatch(fields: Joi.SchemaMap): Joi.ObjectSchema {
  return Joi.object(fields).min(1).messages(commonMessages);
}

export function withDateRange(fields: Joi.SchemaMap, fromKey: string, toKey: string): Joi.ObjectSchema {
  return Joi.object(fields).custom((value: Record<string, unknown>, helpers) => {
    const from = value[fromKey];
    const to = value[toKey];
    if (from && to && new Date(String(to)).getTime() < new Date(String(from)).getTime()) {
      return helpers.message({ custom: `Ngày ${toKey} phải sau hoặc bằng ngày ${fromKey}.` });
    }
    return value;
  }).messages(commonMessages);
}
