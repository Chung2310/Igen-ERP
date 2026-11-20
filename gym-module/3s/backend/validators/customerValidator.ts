import Joi from 'joi';
import type { RequestValidationSchema } from '../middlewares/validate.js';
import { commonMessages, email, idParams, nonEmptyPatch, objectId, paginationQuery, passwordSchema, withDateRange } from './commonValidator.js';

const customerFields = {
  fullName: Joi.string().trim().min(2), phone: Joi.string().trim().pattern(/^[0-9+]{9,15}$/), email: email.allow('', null),
  dateOfBirth: Joi.date().max('now').allow('', null), gender: Joi.string().valid('MALE', 'FEMALE', 'OTHER'),
  height: Joi.number().min(0).allow(null), initialWeight: Joi.number().min(0).allow(null), medicalNotes: Joi.string().max(2000).allow(''),
  initialGoal: Joi.string().max(1000).allow(''), internalNotes: Joi.string().max(2000).allow(''),
  status: Joi.string().valid('ACTIVE', 'INACTIVE', 'LEAD'), assignedPtId: objectId,
};
export const listCustomersSchema: RequestValidationSchema = {
  query: Joi.object({
    ...paginationQuery,
    status: Joi.string().valid('ACTIVE', 'INACTIVE', 'LEAD').allow('', null),
    ptId: objectId.allow('', null),
    keyword: Joi.string().allow('', null),
    search: Joi.string().allow('', null),
    sort: Joi.string().allow('', null),
    order: Joi.string().valid('asc', 'desc').allow('', null),
  }).messages(commonMessages),
};
export const customerIdSchema: RequestValidationSchema = { params: idParams() };
export const createCustomerSchema: RequestValidationSchema = { body: Joi.object({ ...customerFields, fullName: customerFields.fullName.required(), phone: customerFields.phone.required() }).messages(commonMessages) };
export const updateCustomerSchema: RequestValidationSchema = { params: idParams(), body: nonEmptyPatch({ ...customerFields, assignedPtId: Joi.forbidden(), userId: Joi.forbidden() }) };
export const createCustomerAccountSchema: RequestValidationSchema = { params: idParams(), body: Joi.object({ username: Joi.string().trim().min(3).required(), password: passwordSchema.required(), email: email.allow('', null) }).messages(commonMessages) };
const packageFields = { name: Joi.string().trim().required(), totalSessions: Joi.number().integer().min(1).required(), usedSessions: Joi.number().integer().min(0), startDate: Joi.date().iso().required(), endDate: Joi.date().iso().required(), status: Joi.string().valid('ACTIVE', 'EXPIRED', 'COMPLETED', 'CANCELLED') };
const packageParams = Joi.object({ id: objectId.required(), packageId: objectId.required() }).messages(commonMessages);
export const listPackagesSchema: RequestValidationSchema = { params: idParams(), query: Joi.object({ ...paginationQuery, status: Joi.string().valid('ACTIVE', 'EXPIRED', 'COMPLETED', 'CANCELLED') }).messages(commonMessages) };
export const createPackageSchema: RequestValidationSchema = { params: idParams(), body: withDateRange(packageFields, 'startDate', 'endDate') };
export const updatePackageSchema: RequestValidationSchema = { params: packageParams, body: withDateRange(packageFields, 'startDate', 'endDate') };
export const deletePackageSchema: RequestValidationSchema = { params: packageParams };
