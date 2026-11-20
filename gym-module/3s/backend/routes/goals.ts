import mongoose from 'mongoose';
import createRouter from './contentRouteFactory.js';
import { goalSchemas } from '../validators/contentValidator.js';
import type { Request } from 'express';
export default createRouter('goals', goalSchemas);
void ((req: Request) => {
  const errors = [];
  if (!mongoose.isValidObjectId(req.body.customerId)) errors.push({ field: 'customerId', message: 'Mã khách hàng không hợp lệ.' });
  if (!['WEIGHT_LOSS', 'FAT_LOSS', 'WEIGHT_GAIN', 'MUSCLE_GAIN', 'RECOMPOSITION', 'FITNESS'].includes(req.body.type)) errors.push({ field: 'type', message: 'Loại mục tiêu không hợp lệ.' });
  if (typeof req.body.title !== 'string' || !req.body.title.trim()) errors.push({ field: 'title', message: 'Vui lòng nhập tên mục tiêu.' });
  if (!req.body.deadline || Number.isNaN(Date.parse(req.body.deadline))) errors.push({ field: 'deadline', message: 'Thời hạn mục tiêu không hợp lệ.' });
  if (req.body.targetValue != null && typeof req.body.targetValue !== 'number') errors.push({ field: 'targetValue', message: 'Giá trị mục tiêu phải là số.' });
  if (req.body.sessionsPerWeek != null && (!Number.isInteger(req.body.sessionsPerWeek) || req.body.sessionsPerWeek < 1 || req.body.sessionsPerWeek > 14)) errors.push({ field: 'sessionsPerWeek', message: 'Số buổi mỗi tuần phải từ 1 đến 14.' });
  for (const field of ['targetUnit', 'cardioNotes', 'evaluationNotes']) if (req.body[field] != null && typeof req.body[field] !== 'string') errors.push({ field, message: `${field} phải là chuỗi.` });
  return errors;
});
