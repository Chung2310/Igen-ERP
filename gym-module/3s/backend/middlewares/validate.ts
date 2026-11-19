import { isValidPassword, PASSWORD_ERROR } from '../services/passwordPolicy.js';
import mongoose from 'mongoose';
import Joi from 'joi';
import { AppError } from '../errors/AppError.js';
import { ERROR_CODES } from '../errors/errorCodes.js';
import { joiMessages, validationIssue } from '../validators/validationMessages.js';
import type { ValidationIssue } from '../validators/validationMessages.js';
import type { Request, RequestHandler } from 'express';

export type { ValidationIssue } from '../validators/validationMessages.js';
type BodyRequest = Pick<Request, 'body'>;
export type ValidationSchema = (req: Request) => ValidationIssue[];

export interface RequestValidationSchema {
  body?: Joi.ObjectSchema;
  params?: Joi.ObjectSchema;
  query?: Joi.ObjectSchema;
  file?: Joi.AnySchema;
  fileField?: string;
}

const validationOptions: Joi.ValidationOptions = {
  abortEarly: false,
  allowUnknown: false,
  stripUnknown: false,
  convert: true,
  messages: joiMessages,
};

function validate(schema: ValidationSchema | RequestValidationSchema): RequestHandler {
  return (req, res, next) => {
    if (typeof schema !== 'function') {
      const errors: ValidationIssue[] = [];
      const segments = ['body', 'params', 'query', 'file'] as const;
      for (const segment of segments) {
        const segmentSchema = schema[segment];
        if (!segmentSchema) continue;
        const source = segment === 'file'
          ? (Array.isArray(req.files) && req.files.length > 0 ? req.files : req.file)
          : req[segment];
        const result = segmentSchema.validate(source, validationOptions);
        if (result.error) {
          errors.push(...result.error.details.map((detail) => {
            const issue = validationIssue(detail, segment);
            return segment === 'file' ? { ...issue, field: schema.fileField || 'image' } : issue;
          }));
          continue;
        }
        if (segment === 'file') {
          if (Array.isArray(result.value)) {
            req.files = result.value as unknown as Express.Multer.File[];
            req.file = result.value[0] as Express.Multer.File;
          } else {
            req.file = result.value as Express.Multer.File;
            req.files = [result.value as Express.Multer.File];
          }
        } else if (segment === 'query') {
          Object.defineProperty(req, 'query', { configurable: true, enumerable: true, value: result.value });
        } else {
          req[segment] = result.value;
        }
      }
      if (errors.length > 0) {
        return next(new AppError({ status: 400, code: ERROR_CODES.VALIDATION, message: 'Dữ liệu gửi lên không hợp lệ.', errors }));
      }
      return next();
    }
    const errors = schema(req);
    if (errors.length > 0) {
      return next(new AppError({ status: 400, code: ERROR_CODES.VALIDATION, message: 'Dữ liệu gửi lên không hợp lệ.', errors }));
    }
    return next();
  };
}

function createUserValidator(req: BodyRequest): ValidationIssue[] {
  const { username, password, role } = req.body;
  const errors: ValidationIssue[] = [];
  if (typeof username !== 'string' || username.trim().length < 3) errors.push({ field: 'username', message: 'Tên đăng nhập phải có ít nhất 3 ký tự.' });
  if (!isValidPassword(password)) errors.push({ field: 'password', message: PASSWORD_ERROR });
  if (!['ADMIN', 'PT', 'CUSTOMER'].includes(role)) errors.push({ field: 'role', message: 'Vai trò không hợp lệ.' });
  if (role === 'PT' && (typeof req.body.fullName !== 'string' || !req.body.fullName.trim())) errors.push({ field: 'fullName', message: 'Vui lòng nhập họ tên PT.' });
  if (role === 'PT' && (typeof req.body.phone !== 'string' || !req.body.phone.trim())) errors.push({ field: 'phone', message: 'Vui lòng nhập số điện thoại PT.' });
  if (req.body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(req.body.email)) errors.push({ field: 'email', message: 'Email không hợp lệ.' });
  if (req.body.avatarUrl) { try { new URL(req.body.avatarUrl); } catch { errors.push({ field: 'avatarUrl', message: 'URL ảnh đại diện không hợp lệ.' }); } }
  if (req.body.dateOfBirth && new Date(req.body.dateOfBirth) > new Date()) errors.push({ field: 'dateOfBirth', message: 'Ngày sinh không được ở tương lai.' });
  if (req.body.gender && !['MALE', 'FEMALE', 'OTHER'].includes(req.body.gender)) errors.push({ field: 'gender', message: 'Giới tính không hợp lệ.' });
  if (req.body.yearsOfExperience !== undefined && (!Number.isInteger(Number(req.body.yearsOfExperience)) || Number(req.body.yearsOfExperience) < 0 || Number(req.body.yearsOfExperience) > 80)) errors.push({ field: 'yearsOfExperience', message: 'Số năm kinh nghiệm phải là số nguyên từ 0 đến 80.' });
  if (req.body.certificates !== undefined && !Array.isArray(req.body.certificates)) errors.push({ field: 'certificates', message: 'Danh sách chứng chỉ không hợp lệ.' });
  if (typeof req.body.bio === 'string' && req.body.bio.length > 1000) errors.push({ field: 'bio', message: 'Giới thiệu không được vượt quá 1.000 ký tự.' });
  return errors;
}

function loginValidator(req: BodyRequest): ValidationIssue[] {
  const errors: ValidationIssue[] = [];
  if (typeof req.body.username !== 'string' || !req.body.username.trim()) errors.push({ field: 'username', message: 'Vui lòng nhập tên đăng nhập.' });
  if (typeof req.body.password !== 'string' || !req.body.password) errors.push({ field: 'password', message: 'Vui lòng nhập mật khẩu.' });
  return errors;
}

function updateUserValidator(req: Request): ValidationIssue[] {
  const errors: ValidationIssue[] = [];
  if (!mongoose.isValidObjectId(req.params.id)) errors.push({ field: 'id', message: 'Mã PT không hợp lệ.' });
  const body = { ...req.body, username: 'valid-user', role: 'PT', password: req.body.password || 'validation-placeholder' };
  errors.push(...createUserValidator({ body }).filter((error) => !['username', 'role'].includes(error.field)));
  return errors;
}

function listValidator(req: Request): ValidationIssue[] {
  const errors: ValidationIssue[] = [];
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 20);
  if (!Number.isInteger(page) || page < 1) errors.push({ field: 'page', message: 'Trang phải là số nguyên lớn hơn 0.' });
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) errors.push({ field: 'limit', message: 'Số bản ghi mỗi trang phải từ 1 đến 100.' });
  return errors;
}

export { validate, validationIssue, createUserValidator, updateUserValidator, loginValidator, listValidator };
