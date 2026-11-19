import express from 'express';
import multer from 'multer';
import { authenticate, authorize } from '../middlewares/auth.js';
import { requireFeature } from '../middlewares/requireFeature.js';
import { validate } from '../middlewares/validate.js';
import * as controller from '../controllers/inbodyOcrController.js';
import { getEnv } from '../config/env.js';
import { createRateLimiter } from '../middlewares/rateLimit.js';
import { inbodyOcrUploadSchema } from '../validators/uploadValidator.js';

const router = express.Router();
const env = getEnv();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: env.OCR_MAX_FILE_BYTES } });
/* legacy manual validator
const validator = (req: never): never[] => {
  const errors: ValidationIssue[] = [];
  if (!mongoose.isValidObjectId(req.body.customerId)) errors.push({ field: 'customerId', message: 'Mã khách hàng không hợp lệ.' });
  if (!req.body.measurementDate || Number.isNaN(Date.parse(req.body.measurementDate))) errors.push({ field: 'measurementDate', message: 'Ngày đo không hợp lệ.' });
  if (!req.file) errors.push({ field: 'image', message: 'Vui lòng cung cấp ảnh phiếu InBody.' });
  else if (!['image/jpeg', 'image/png', 'image/webp'].includes(req.file.mimetype)) errors.push({ field: 'image', message: 'Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP.' });
  return errors;
}; */

router.post('/', createRateLimiter({ limit: env.AI_RATE_LIMIT_PER_MINUTE, windowMs: 60_000 }), authenticate, authorize('ADMIN', 'PT'), requireFeature('OCR_INBODY'), upload.array('image', 5), validate(inbodyOcrUploadSchema), controller.create);
export default router;
