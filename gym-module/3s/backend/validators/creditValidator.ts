import Joi from 'joi';
import type { RequestValidationSchema } from '../middlewares/validate.js';
import { commonMessages, objectId, paginationQuery } from './commonValidator.js';
import { AI_TASK_TYPES } from '../services/creditTypes.js';

export const topupSchema: RequestValidationSchema = {
  body: Joi.object({
    gateway: Joi.string().valid('SEPAY', 'VNPAY', 'MOMO').default('SEPAY'),
    packageId: objectId,
    customAmountVnd: Joi.number().integer().min(10_000).max(50_000_000).multiple(1_000),
  }).xor('packageId', 'customAmountVnd').messages(commonMessages),
};

export const orderParamsSchema: RequestValidationSchema = {
  params: Joi.object({ id: objectId.required() }).messages(commonMessages),
};

export const ledgerQuerySchema: RequestValidationSchema = {
  query: Joi.object({ ...paginationQuery, type: Joi.string().valid('TOPUP', 'RESERVE', 'SETTLE', 'RELEASE', 'ADJUSTMENT') }).messages(commonMessages),
};

const policy = Joi.object({
  taskType: Joi.string().valid(...AI_TASK_TYPES).required(), enabled: Joi.boolean().required(),
  maxReservationCredits: Joi.number().integer().min(1).required(), fallbackCredits: Joi.number().integer().min(0).required(),
  markupBasisPoints: Joi.number().integer().min(0).required(), minBillableCredits: Joi.number().integer().min(0).required(),
}).custom((value, helpers) => value.fallbackCredits <= value.maxReservationCredits ? value : helpers.error('any.invalid'));

export const pricingAdminSchema: RequestValidationSchema = { body: Joi.object({
  vndPerCredit: Joi.number().integer().min(1).required(), usdToVnd: Joi.number().integer().min(1).required(),
  policies: Joi.array().items(policy).length(AI_TASK_TYPES.length).required(),
}).messages(commonMessages) };

const packageFields = {
  name: Joi.string().trim().max(100), description: Joi.string().trim().max(500).allow(''),
  amountVnd: Joi.number().integer().min(10_000).max(50_000_000).multiple(1_000),
  bonusCredits: Joi.number().integer().min(0), active: Joi.boolean(), sortOrder: Joi.number().integer().min(0),
};
export const createPackageAdminSchema: RequestValidationSchema = { body: Joi.object({ ...packageFields, name: packageFields.name.required(), amountVnd: packageFields.amountVnd.required(), bonusCredits: packageFields.bonusCredits.default(0), active: packageFields.active.default(true), sortOrder: packageFields.sortOrder.default(0) }).messages(commonMessages) };
export const updatePackageAdminSchema: RequestValidationSchema = { params: Joi.object({ id: objectId.required() }).messages(commonMessages), body: Joi.object(packageFields).min(1).messages(commonMessages) };
export const packageParamsAdminSchema: RequestValidationSchema = { params: Joi.object({ id: objectId.required() }).messages(commonMessages) };
export const adjustmentAdminSchema: RequestValidationSchema = { body: Joi.object({ userId: objectId.required(), credits: Joi.number().integer().invalid(0).required(), reason: Joi.string().trim().min(3).max(500).required() }).messages(commonMessages) };
export const adminListSchema: RequestValidationSchema = { query: Joi.object({ ...paginationQuery, status: Joi.string().max(50), gateway: Joi.string().valid('SEPAY', 'PAYOS', 'VNPAY', 'MOMO'), taskType: Joi.string().valid(...AI_TASK_TYPES), userId: objectId, type: Joi.string().valid('TOPUP', 'RESERVE', 'SETTLE', 'RELEASE', 'ADJUSTMENT') }).messages(commonMessages) };
