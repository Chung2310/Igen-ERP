import Joi from 'joi';
import type { RequestValidationSchema } from '../middlewares/validate.js';
import { commonMessages, idParams, isoDate, objectId, paginationQuery } from './commonValidator.js';

const transferBody = { customerId: objectId.required(), toPtId: objectId.required(), reason: Joi.string().trim().required() };
export const listTransfersSchema: RequestValidationSchema = { query: Joi.object({
  ...paginationQuery,
  status: Joi.string().valid('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'ADMIN_FORCED'),
  customerId: objectId,
  fromPtId: objectId,
  toPtId: objectId,
  keyword: Joi.string().trim().max(120),
  fromDate: isoDate,
  toDate: isoDate,
}).custom((value, helpers) => {
  if (value.fromDate && value.toDate && new Date(value.toDate) < new Date(value.fromDate)) return helpers.error('date.range');
  return value;
}).messages({ ...commonMessages, 'date.range': 'Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.' }) };
export const createTransferSchema: RequestValidationSchema = { body: Joi.object(transferBody).messages(commonMessages) };
export const updateTransferSchema: RequestValidationSchema = { params: idParams(), body: Joi.object({ toPtId: objectId.required(), reason: Joi.string().trim().required() }).messages(commonMessages) };
export const transferIdSchema: RequestValidationSchema = { params: idParams() };
export const forceTransferSchema: RequestValidationSchema = { params: idParams(), body: Joi.object(transferBody).messages(commonMessages) };
export const directForceTransferSchema: RequestValidationSchema = { body: Joi.object(transferBody).messages(commonMessages) };
export const batchForceTransferSchema: RequestValidationSchema = {
  body: Joi.object({
    customerIds: Joi.array().items(objectId).min(1).required(),
    toPtId: objectId.required(),
    reason: Joi.string().trim().required(),
  }).messages(commonMessages),
};
