import express from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import * as featureController from '../controllers/featureController.js';
import { updateFeatureSchema } from '../validators/operationsValidator.js';

const router = express.Router();
/* legacy manual validator
const roles = ['ADMIN', 'PT', 'CUSTOMER'];

const updateValidator = (req: Request): ValidationIssue[] => {
  const errors: ValidationIssue[] = [];
  if (!FEATURE_KEYS.includes(String(req.params.key) as (typeof FEATURE_KEYS)[number])) errors.push({ field: 'key', message: 'Mã tính năng không hợp lệ.' });
  if (typeof req.body.enabled !== 'boolean') errors.push({ field: 'enabled', message: 'Trạng thái tính năng phải là true hoặc false.' });
  if (!Array.isArray(req.body.roles) || req.body.roles.some((role: unknown) => typeof role !== 'string' || !roles.includes(role))) errors.push({ field: 'roles', message: 'Danh sách vai trò không hợp lệ.' });
  if (req.body.pilotUserIds !== undefined && (!Array.isArray(req.body.pilotUserIds) || req.body.pilotUserIds.some((id: unknown) => typeof id !== 'string' || !mongoose.isValidObjectId(id)))) errors.push({ field: 'pilotUserIds', message: 'Danh sách tài khoản pilot không hợp lệ.' });
  return errors;
}; */

router.get('/me', authenticate, featureController.mine);
router.get('/', authenticate, authorize('ADMIN'), featureController.list);
router.patch('/:key', authenticate, authorize('ADMIN'), validate(updateFeatureSchema), featureController.update);

export default router;
