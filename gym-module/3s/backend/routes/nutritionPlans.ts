import mongoose from 'mongoose';
import createRouter from './contentRouteFactory.js';
import { nutritionPlanSchemas } from '../validators/contentValidator.js';
import type { Request } from 'express';
export default createRouter('nutritionPlans', nutritionPlanSchemas);
void ((req: Request) => {
  const errors = [];
  if (!mongoose.isValidObjectId(req.body.customerId)) errors.push({ field: 'customerId', message: 'Mã khách hàng không hợp lệ.' });
  if (typeof req.body.title !== 'string' || !req.body.title.trim()) errors.push({ field: 'title', message: 'Vui lòng nhập tên thực đơn.' });
  if (typeof req.body.targetCalories !== 'number' || req.body.targetCalories <= 0) errors.push({ field: 'targetCalories', message: 'Calories mục tiêu phải lớn hơn 0.' });
  for (const field of ['protein', 'carbs', 'fat']) if (typeof req.body.macros?.[field] !== 'number' || req.body.macros[field] < 0) errors.push({ field: `macros.${field}`, message: `Chỉ số ${field} không hợp lệ.` });
  for (const field of ['bmr', 'tdee']) if (req.body[field] != null && (typeof req.body[field] !== 'number' || req.body[field] < 0)) errors.push({ field, message: `${field} phải là số không âm.` });
  if (req.body.menu != null && !Array.isArray(req.body.menu)) errors.push({ field: 'menu', message: 'Thực đơn không hợp lệ.' });
  if (req.body.notes != null && typeof req.body.notes !== 'string') errors.push({ field: 'notes', message: 'Ghi chú phải là chuỗi.' });
  return errors;
});
