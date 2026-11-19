import Joi from 'joi';
import type { RequestValidationSchema } from '../middlewares/validate.js';
import { commonMessages, email, passwordSchema } from './commonValidator.js';

export const loginSchema: RequestValidationSchema = {
  body: Joi.object({
    username: Joi.string().trim().required().messages({ ...commonMessages, 'string.empty': 'Vui lòng nhập tên đăng nhập.' }),
    password: Joi.string().required().messages({ ...commonMessages, 'string.empty': 'Vui lòng nhập mật khẩu.' }),
    clientType: Joi.string().valid('WEB', 'MOBILE').default('WEB'),
    deviceInfo: Joi.object({
      deviceId: Joi.string().allow('', null).optional(),
      deviceName: Joi.string().allow('', null).optional(),
      platform: Joi.string().allow('', null).optional(),
      osVersion: Joi.string().allow('', null).optional(),
      appVersion: Joi.string().allow('', null).optional(),
    }).optional(),
    pushToken: Joi.string().trim().allow('', null).optional(),
  }).messages(commonMessages),
};

export const registerCenterSchema: RequestValidationSchema = {
  body: Joi.object({
    centerName: Joi.string().trim().min(2).max(120).required(),
    username: Joi.string().trim().min(3).max(64).required(),
    password: passwordSchema.required(),
    fullName: Joi.string().trim().min(2).max(120).required(),
    email: email.allow('', null).optional(),
    phone: Joi.string().trim().max(32).allow('', null).optional(),
  }).messages(commonMessages),
};

export const registerPtSchema: RequestValidationSchema = {
  body: Joi.object({
    username: Joi.string().trim().min(3).max(64).required(),
    password: passwordSchema.required(),
    fullName: Joi.string().trim().min(2).max(120).required(),
    email: email.allow('', null).optional(),
    phone: Joi.string().trim().max(32).allow('', null).optional(),
  }).messages(commonMessages),
};

export const refreshSchema: RequestValidationSchema = {
  body: Joi.object({
    refreshToken: Joi.string().trim().required().messages({
      ...commonMessages,
      'string.empty': 'Vui lòng cung cấp mã Refresh Token.',
    }),
  }).messages(commonMessages),
};

export const logoutSchema: RequestValidationSchema = {
  body: Joi.object({
    refreshToken: Joi.string().trim().allow('', null).optional(),
    pushToken: Joi.string().trim().allow('', null).optional(),
  }).messages(commonMessages),
};

export const ownerDeletionSchema: RequestValidationSchema = {
  body: Joi.object({
    mode: Joi.string().valid('TRANSFER', 'CLOSE', 'PERSONAL').required(),
    currentPassword: Joi.string().max(128).required(),
    confirmation: Joi.string().max(120).required(),
    // Joi's conditional schema API requires a `then` key; this is not a Promise.
    // oxlint-disable-next-line unicorn/no-thenable
    successorId: Joi.when('mode', { is: 'TRANSFER', then: Joi.string().hex().length(24).required(), otherwise: Joi.forbidden() }),
  }).messages(commonMessages),
};

