import mongoose from 'mongoose';
import createRouter from './contentRouteFactory.js';
import { authenticate, authorize } from '../middlewares/auth.js';
import { requireFeature } from '../middlewares/requireFeature.js';
import { validate } from '../middlewares/validate.js';
import { confirm } from '../controllers/inbodyOcrController.js';
import { confirmInbodyOcrSchema, inbodySchemas } from '../validators/contentValidator.js';
import type { Request } from 'express';

const router = createRouter('inbody', inbodySchemas);
/* legacy validator retained temporarily for behavioral reference */ void ((req: Request) => {
  const errors = [];
  if (!mongoose.isValidObjectId(req.body.customerId)) errors.push({ field: 'customerId', message: 'Mã khách hàng không hợp lệ.' });
  if (!req.body.measurementDate || Number.isNaN(Date.parse(req.body.measurementDate))) errors.push({ field: 'measurementDate', message: 'Ngày đo không hợp lệ.' });
  if (typeof req.body.weight !== 'number' || req.body.weight <= 0) errors.push({ field: 'weight', message: 'Cân nặng phải lớn hơn 0.' });
  for (const field of ['bmi', 'bodyFatMass', 'muscleMass', 'bmr', 'visceralFatLevel', 'inbodyScore']) if (req.body[field] != null && (typeof req.body[field] !== 'number' || req.body[field] < 0)) errors.push({ field, message: `${field} phải là số không âm.` });
  if (req.body.bodyFatPercentage != null && (typeof req.body.bodyFatPercentage !== 'number' || req.body.bodyFatPercentage < 0 || req.body.bodyFatPercentage > 100)) errors.push({ field: 'bodyFatPercentage', message: 'Phần trăm mỡ phải từ 0 đến 100.' });
  if (req.body.source && !['MANUAL', 'AI_SCAN'].includes(req.body.source)) errors.push({ field: 'source', message: 'Nguồn dữ liệu không hợp lệ.' });
  for (const field of ['strengths', 'priorities', 'recommendation']) if (req.body[field] != null && typeof req.body[field] !== 'string') errors.push({ field, message: `${field} phải là chuỗi.` });
  return errors;
});

router.patch('/:id/confirm-ocr', authenticate, authorize('ADMIN', 'PT'), requireFeature('OCR_INBODY'), validate(confirmInbodyOcrSchema), confirm);

export default router;
