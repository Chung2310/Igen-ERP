import express from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import { requireFeature } from '../middlewares/requireFeature.js';
import { validate } from '../middlewares/validate.js';
import * as controller from '../controllers/roadmapController.js';
import { contentIdSchema, createRoadmapSchema, listRoadmapsSchema, updateRoadmapSchema } from '../validators/contentValidator.js';

const router = express.Router();
const base = [authenticate, authorize('ADMIN', 'PT'), requireFeature('ROADMAP')] as const;
/* legacy manual validators
const idValidator = (req: Request): ValidationIssue[] => mongoose.isValidObjectId(req.params.id) ? [] : [{ field: 'id', message: 'Mã roadmap không hợp lệ.' }];
const phasesValidator = (phases: unknown): ValidationIssue[] => {
  if (!Array.isArray(phases) || phases.length === 0) return [{ field: 'phases', message: 'Roadmap phải có ít nhất một phase.' }];
  const orders = phases.map((phase) => typeof phase === 'object' && phase !== null && 'order' in phase ? Number(phase.order) : NaN);
  if (orders.some((order) => !Number.isInteger(order) || order < 1) || new Set(orders).size !== orders.length) return [{ field: 'phases', message: 'Thứ tự phase phải là số nguyên dương và không trùng.' }];
  for (const phase of phases) {
    if (!phase || typeof phase !== 'object' || !('name' in phase) || typeof phase.name !== 'string' || !phase.name.trim()) return [{ field: 'phases', message: 'Mỗi phase phải có tên.' }];
    if (!('durationWeeks' in phase) || !Number.isInteger(Number(phase.durationWeeks)) || Number(phase.durationWeeks) < 1) return [{ field: 'phases', message: 'Thời lượng phase phải từ một tuần.' }];
  }
  return [];
};
const createValidator = (req: Request): ValidationIssue[] => {
  const errors: ValidationIssue[] = [];
  if (!mongoose.isValidObjectId(req.body.customerId)) errors.push({ field: 'customerId', message: 'Mã khách hàng không hợp lệ.' });
  if (typeof req.body.title !== 'string' || !req.body.title.trim()) errors.push({ field: 'title', message: 'Vui lòng nhập tên roadmap.' });
  return [...errors, ...phasesValidator(req.body.phases)];
};
const updateValidator = (req: Request): ValidationIssue[] => [...idValidator(req), ...(req.body.phases === undefined ? [] : phasesValidator(req.body.phases))];
const queryValidator = (req: Request): ValidationIssue[] => {
  const errors = listValidator(req);
  if (req.query.customerId && !mongoose.isValidObjectId(String(req.query.customerId))) errors.push({ field: 'customerId', message: 'Mã khách hàng không hợp lệ.' });
  if (req.query.status && !['DRAFT', 'PUBLISHED'].includes(String(req.query.status))) errors.push({ field: 'status', message: 'Trạng thái roadmap không hợp lệ.' });
  return errors;
};

*/
router.get('/', ...base, validate(listRoadmapsSchema), controller.list);
router.get('/:id', ...base, validate(contentIdSchema), controller.get);
router.post('/', ...base, validate(createRoadmapSchema), controller.create);
router.patch('/:id', ...base, validate(updateRoadmapSchema), controller.update);
router.delete('/:id', ...base, validate(contentIdSchema), controller.remove);
router.patch('/:id/publish', ...base, validate(contentIdSchema), controller.publish);
router.patch('/:id/unpublish', ...base, validate(contentIdSchema), controller.unpublish);
export default router;
