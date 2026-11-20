/* oxlint-disable unicorn/no-thenable */
import Joi from 'joi';
import type { RequestValidationSchema } from '../middlewares/validate.js';
import { commonMessages, email, idParams, nonEmptyPatch, paginationQuery, passwordSchema } from './commonValidator.js';

const roles = ['SUPER_ADMIN', 'ADMIN', 'PT', 'CUSTOMER'];
const creatableRoles = ['PT'];
const profileFields = {
  password: passwordSchema, fullName: Joi.string().trim().messages(commonMessages),
  phone: Joi.string().trim().messages(commonMessages), email: email.allow('', null),
  avatarUrl: Joi.string().uri().allow('', null).messages(commonMessages), dateOfBirth: Joi.date().max('now').allow(null).messages(commonMessages),
  gender: Joi.string().valid('MALE', 'FEMALE', 'OTHER').messages(commonMessages),
  yearsOfExperience: Joi.number().integer().min(0).max(80).messages(commonMessages),
  certificates: Joi.array().items(Joi.string()).messages(commonMessages), bio: Joi.string().max(1000).allow('').messages(commonMessages),
  address: Joi.string().allow('').messages(commonMessages), specialization: Joi.string().allow('').messages(commonMessages),
  status: Joi.string().valid('ACTIVE', 'LOCKED').messages(commonMessages),
};
export const listUsersSchema: RequestValidationSchema = { query: Joi.object({ ...paginationQuery, role: Joi.string().valid(...roles), status: Joi.string().valid('ACTIVE', 'LOCKED'), keyword: Joi.string().allow('') }).messages(commonMessages) };
export const createUserSchema: RequestValidationSchema = { body: Joi.object({
  username: Joi.string().trim().min(3).required(), password: profileFields.password.required(), role: Joi.string().valid(...creatableRoles).required(),
  fullName: Joi.when('role', { is: 'PT', then: Joi.string().trim().required(), otherwise: Joi.string().trim() }),
  phone: Joi.when('role', { is: 'PT', then: Joi.string().trim().required(), otherwise: Joi.string().trim() }),
  email: profileFields.email, avatarUrl: profileFields.avatarUrl, dateOfBirth: profileFields.dateOfBirth, gender: profileFields.gender,
  yearsOfExperience: profileFields.yearsOfExperience, certificates: profileFields.certificates, bio: profileFields.bio,
  address: profileFields.address, specialization: profileFields.specialization, status: profileFields.status,
}).messages(commonMessages) };
export const updateUserSchema: RequestValidationSchema = { params: idParams(), body: nonEmptyPatch({ ...profileFields, password: passwordSchema.allow('', null), username: Joi.forbidden(), role: Joi.forbidden() }) };
export const updateSelfProfileSchema: RequestValidationSchema = {
  body: nonEmptyPatch({
    fullName: profileFields.fullName,
    phone: profileFields.phone,
    email: profileFields.email,
    avatarUrl: profileFields.avatarUrl,
    dateOfBirth: profileFields.dateOfBirth,
    gender: profileFields.gender,
    yearsOfExperience: profileFields.yearsOfExperience,
    certificates: profileFields.certificates,
    bio: profileFields.bio,
    address: profileFields.address,
    specialization: profileFields.specialization,
    password: passwordSchema.allow('', null),
    currentPassword: Joi.string().allow('', null).messages(commonMessages),
    role: Joi.forbidden(),
    status: Joi.forbidden(),
    username: Joi.forbidden(),
  }),
};
export const deleteUserSchema: RequestValidationSchema = { params: idParams() };

