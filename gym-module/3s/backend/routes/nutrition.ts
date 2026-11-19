import express from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import { requireFeature } from '../middlewares/requireFeature.js';
import { validate } from '../middlewares/validate.js';
import * as controller from '../controllers/legacyNutritionController.js';
import { calculateNutritionSchema, mealImageSchema, scanInbodySchema } from '../validators/nutritionValidator.js';

const router = express.Router();
/* legacy manual validators

const calculateValidator = (req: Request): ValidationIssue[] => {
  const errors: ValidationIssue[] = [];
  const ranges = { weight: [20, 400], height: [80, 250], age: [12, 100], mealCount: [1, 10] };
  for (const [field, [min, max]] of Object.entries(ranges)) {
    const value = Number(req.body[field] ?? (field === 'mealCount' ? 3 : Number.NaN));
    if (!Number.isFinite(value) || value < min || value > max) errors.push({ field, message: `${field} phải nằm trong khoảng ${min} đến ${max}.` });
  }
  if (req.body.gender && !['male', 'female'].includes(req.body.gender)) errors.push({ field: 'gender', message: 'Giới tính không hợp lệ.' });
  if (req.body.activityLevel && !['sedentary', 'light', 'moderate', 'active', 'very_active'].includes(req.body.activityLevel)) errors.push({ field: 'activityLevel', message: 'Mức vận động không hợp lệ.' });
  if (req.body.timeframe && !['1_day', '1_week', '1_month'].includes(req.body.timeframe)) errors.push({ field: 'timeframe', message: 'Khoảng thời gian không hợp lệ.' });
  return errors;
};

const mealImageValidator = (req: Request): ValidationIssue[] => {
  const errors: ValidationIssue[] = [];
  if (req.query.prompt && (typeof req.query.prompt !== 'string' || req.query.prompt.length > 500)) errors.push({ field: 'prompt', message: 'Mô tả ảnh không được vượt quá 500 ký tự.' });
  if (req.query.items && (typeof req.query.items !== 'string' || req.query.items.length > 1_000)) errors.push({ field: 'items', message: 'Danh sách món ăn không hợp lệ.' });
  if (req.query.seed && (!Number.isInteger(Number(req.query.seed)) || Number(req.query.seed) < 0)) errors.push({ field: 'seed', message: 'Mã tạo ảnh không hợp lệ.' });
  return errors;
};

const scanValidator = (req: Request): ValidationIssue[] => typeof req.body.imageBase64 === 'string' && req.body.imageBase64.length >= 100
  ? [] : [{ field: 'imageBase64', message: 'Vui lòng cung cấp ảnh InBody hợp lệ.' }];

*/
router.post('/calculate', authenticate, authorize('ADMIN', 'PT'), requireFeature('NUTRITION_AI'), validate(calculateNutritionSchema), controller.calculate);
router.get('/meal-image', authenticate, authorize('ADMIN', 'PT'), requireFeature('NUTRITION_AI'), validate(mealImageSchema), controller.mealImage);
router.post('/scan-inbody', authenticate, authorize('ADMIN', 'PT'), requireFeature('OCR_INBODY'), validate(scanInbodySchema), controller.scanInBody);

export default router;
