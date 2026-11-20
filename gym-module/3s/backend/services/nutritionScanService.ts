import { Readable } from 'node:stream';
import { AppError } from '../errors/AppError.js';
import { ERROR_CODES } from '../errors/errorCodes.js';
import { extractInBody } from './ocrProvider.js';
import type { AuthenticatedUser } from '../types/express.js';

interface LegacyScanPayload { imageBase64: string }

export async function scanInBodyDraft(user: AuthenticatedUser, payload: LegacyScanPayload, requestKey: string) {
  const match = payload.imageBase64.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw new AppError({ status: 400, code: ERROR_CODES.VALIDATION, message: 'Ảnh InBody phải là dữ liệu JPG, PNG hoặc WebP hợp lệ.' });
  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length) throw new AppError({ status: 400, code: ERROR_CODES.VALIDATION, message: 'Ảnh InBody không có dữ liệu.' });
  const file: Express.Multer.File = {
    fieldname: 'image', originalname: 'legacy-inbody', encoding: '7bit', mimetype: match[1],
    size: buffer.byteLength, buffer, stream: Readable.from(buffer), destination: '', filename: '', path: '',
  };
  const extracted = await extractInBody({ userId: user.id, taskType: 'OCR_INBODY', requestKey: `${requestKey}:ocr-inbody-legacy` }, file);
  return { ...extracted, status: 'DRAFT' as const, ocrStatus: 'REVIEW_REQUIRED' as const };
}
