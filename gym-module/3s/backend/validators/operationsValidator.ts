import Joi from 'joi';
import type { RequestValidationSchema } from '../middlewares/validate.js';
import { FEATURE_KEYS } from '../models/FeatureFlag.js';
import { commonMessages, objectId } from './commonValidator.js';
import { idParams, nonEmptyPatch, paginationQuery } from './commonValidator.js';

export const updateFeatureSchema: RequestValidationSchema = {
  params: Joi.object({ key: Joi.string().valid(...FEATURE_KEYS).required() }).messages(commonMessages),
  body: Joi.object({
    enabled: Joi.boolean().required(),
    roles: Joi.array().custom((value: unknown[], helpers) => value.every((role) => ['ADMIN', 'PT', 'CUSTOMER'].includes(String(role))) ? value : helpers.error('any.only')).required(),
    pilotUserIds: Joi.array().items(objectId),
  }).messages(commonMessages),
};

export const listOperationSchema: RequestValidationSchema = { query: Joi.object({ ...paginationQuery, customerId: objectId, status: Joi.string(), fromDate: Joi.date().iso(), toDate: Joi.date().iso() }).messages(commonMessages) };
export const operationIdSchema: RequestValidationSchema = { params: idParams() };
export const createProgressReportSchema: RequestValidationSchema = { body: Joi.object({ customerId: objectId.required(), periodStart: Joi.date().iso().required(), periodEnd: Joi.date().iso().greater(Joi.ref('periodStart')).required(), summary: Joi.string().trim().required(), metrics: Joi.object().pattern(Joi.string(), Joi.number().allow(null)), sourceVersions: Joi.object().unknown(true) }).messages(commonMessages) };
export const generateProgressReportSchema: RequestValidationSchema = { body: Joi.object({ customerId: objectId.required(), periodStart: Joi.date().iso().required(), periodEnd: Joi.date().iso().greater(Joi.ref('periodStart')).required() }).messages(commonMessages) };
export const updateProgressReportSchema: RequestValidationSchema = { params: idParams(), body: nonEmptyPatch({ summary: Joi.string().trim(), periodStart: Joi.date().iso(), periodEnd: Joi.date().iso(), metrics: Joi.object().pattern(Joi.string(), Joi.number().allow(null)), customerId: Joi.forbidden(), ptId: Joi.forbidden(), status: Joi.forbidden(), version: Joi.forbidden(), publishedAt: Joi.forbidden() }) };
const calendarFields = { customerId: objectId, title: Joi.string().trim(), startsAt: Joi.date().iso(), endsAt: Joi.date().iso(), notes: Joi.string().allow(''), status: Joi.string().valid('SCHEDULED', 'COMPLETED', 'CANCELLED') };
export const createCalendarEventSchema: RequestValidationSchema = { body: Joi.object({ ...calendarFields, title: calendarFields.title.required(), startsAt: calendarFields.startsAt.required(), endsAt: calendarFields.endsAt.greater(Joi.ref('startsAt')).required() }).messages(commonMessages) };
export const listCalendarEventsSchema: RequestValidationSchema = { query: Joi.object({ ...paginationQuery, fromDate: Joi.date().iso(), toDate: Joi.date().iso(), customerId: objectId, status: calendarFields.status }).messages(commonMessages) };
export const updateCalendarEventSchema: RequestValidationSchema = { params: idParams(), body: nonEmptyPatch({ ...calendarFields, ownerPtId: Joi.forbidden() }) };
export const adminDashboardSchema: RequestValidationSchema = { query: Joi.object({ ptId: objectId, customerStatus: Joi.string().valid('ACTIVE', 'INACTIVE', 'LEAD'), fromDate: Joi.string().isoDate().raw(), toDate: Joi.string().isoDate().raw() }).messages(commonMessages) };
