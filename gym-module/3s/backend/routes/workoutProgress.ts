import express from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import * as controller from '../controllers/workoutProgressController.js';
import { bodyMeasurementIdSchema, createBodyMeasurementSchema, createWorkoutSessionSchema, createWorkoutTemplateSchema, customerProgressSchema, listWorkoutSessionsSchema, listWorkoutTemplatesSchema, updateBodyMeasurementSchema, updateWorkoutSessionSchema, updateWorkoutTemplateSchema, workoutTemplateIdSchema } from '../validators/workoutValidator.js';
const router = express.Router();
const auth = [authenticate, authorize('ADMIN', 'PT')] as const;
/* legacy manual validators
const templateValidator = (req: Request): ValidationIssue[] => {
  const errors: ValidationIssue[] = [];
  if (typeof req.body.title !== 'string' || !req.body.title.trim()) errors.push({ field: 'title', message: 'Vui lòng nhập tên giáo án.' });
  if (!Array.isArray(req.body.sessions) || req.body.sessions.length === 0) errors.push({ field: 'sessions', message: 'Giáo án phải có ít nhất một buổi.' });
  return errors;
};
const sessionValidator = (req: Request): ValidationIssue[] => {
  const errors: ValidationIssue[] = [];
  for (const field of ['customerId', 'templateId']) if (!mongoose.isValidObjectId(req.body[field])) errors.push({ field, message: `Mã ${field} không hợp lệ.` });
  if (!['PRESENT', 'ABSENT', 'LATE'].includes(req.body.attendance)) errors.push({ field: 'attendance', message: 'Trạng thái điểm danh không hợp lệ.' });
  if (typeof req.body.idempotencyKey !== 'string' || !req.body.idempotencyKey.trim()) errors.push({ field: 'idempotencyKey', message: 'Thiếu mã chống ghi trùng.' });
  return errors;
};
const measurementValidator = (req: Request): ValidationIssue[] => {
  const errors: ValidationIssue[] = [];
  if (!mongoose.isValidObjectId(req.body.customerId)) errors.push({ field: 'customerId', message: 'Mã khách hàng không hợp lệ.' });
  if (!req.body.measuredAt || Number.isNaN(Date.parse(req.body.measuredAt))) errors.push({ field: 'measuredAt', message: 'Ngày đo không hợp lệ.' });
  return errors;
};
*/
router.post('/workout-templates', ...auth, validate(createWorkoutTemplateSchema), controller.createTemplate);
router.get('/workout-templates', ...auth, validate(listWorkoutTemplatesSchema), controller.listTemplates);
router.get('/workout-templates/:id', ...auth, validate(workoutTemplateIdSchema), controller.getTemplate);
router.patch('/workout-templates/:id', ...auth, validate(updateWorkoutTemplateSchema), controller.updateTemplate);
router.patch('/workout-templates/:id/archive', ...auth, validate(workoutTemplateIdSchema), controller.archiveTemplate);
router.delete('/workout-templates/:id', ...auth, validate(workoutTemplateIdSchema), controller.deleteTemplate);
router.post('/workout-sessions', ...auth, validate(createWorkoutSessionSchema), controller.createSession);
router.patch('/workout-sessions/:id', ...auth, validate(updateWorkoutSessionSchema), controller.updateSession);
router.get('/workout-sessions', ...auth, validate(listWorkoutSessionsSchema), controller.listSessions);
router.post('/body-measurements', ...auth, validate(createBodyMeasurementSchema), controller.createMeasurement);
router.patch('/body-measurements/:id', ...auth, validate(updateBodyMeasurementSchema), controller.updateMeasurement);
router.delete('/body-measurements/:id', ...auth, validate(bodyMeasurementIdSchema), controller.deleteMeasurement);
router.get('/progress/:customerId', ...auth, validate(customerProgressSchema), controller.getProgress);
export default router;
