import Joi from 'joi';
import type { RequestValidationSchema } from '../middlewares/validate.js';
import { commonMessages, objectId } from './commonValidator.js';
const imageFile = Joi.object({ mimetype: Joi.string().valid('image/jpeg', 'image/png', 'image/webp').required() }).unknown(true).required().messages({ ...commonMessages, 'any.required': 'Vui lòng cung cấp file ảnh.', 'any.only': 'Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP.' });
const inbodyFile = Joi.object({ mimetype: Joi.string().valid('image/jpeg', 'image/png', 'image/webp', 'application/pdf').required() }).unknown(true).required().messages({ ...commonMessages, 'any.required': 'Vui lòng cung cấp file ảnh hoặc PDF phiếu InBody.', 'any.only': 'Chỉ hỗ trợ định dạng JPG, PNG, WebP hoặc PDF.' });
const inbodyFiles = Joi.alternatives().try(
  inbodyFile,
  Joi.array().items(inbodyFile).min(1).max(5).messages({
    'array.min': 'Vui lòng cung cấp ít nhất 1 file ảnh hoặc PDF phiếu InBody.',
    'array.max': 'Chỉ hỗ trợ tối đa 5 file/ảnh cho mỗi lần quét.',
  })
).required().messages({
  ...commonMessages,
  'any.required': 'Vui lòng cung cấp file ảnh hoặc PDF phiếu InBody.',
});
const videoFile = Joi.object({ mimetype: Joi.string().valid('video/mp4', 'video/webm', 'video/quicktime').required() }).unknown(true).required().messages({ ...commonMessages, 'any.required': 'Vui lòng cung cấp file video.', 'any.only': 'Chỉ hỗ trợ video MP4, WebM hoặc MOV.' });
export const imageUploadSchema: RequestValidationSchema = { file: imageFile };
export const videoUploadSchema: RequestValidationSchema = { file: videoFile, fileField: 'video' };
export const inbodyOcrUploadSchema: RequestValidationSchema = { body: Joi.object({ customerId: objectId.optional().allow('', null), measurementDate: Joi.date().iso().optional().allow('', null) }).messages(commonMessages), file: inbodyFiles };
