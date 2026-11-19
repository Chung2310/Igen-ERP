import express from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import { requireFeature } from '../middlewares/requireFeature.js';
import { validate } from '../middlewares/validate.js';
import * as controller from '../controllers/careDashboardController.js';
import { careTaskIdSchema, careTodaySchema, completeCareTaskSchema, createCareTaskSchema, listCareAlertsSchema, listCareLogsSchema, listCareTasksSchema, recalculateCareSchema, resolveCareAlertSchema, updateCareTaskSchema } from '../validators/careValidator.js';
const router = express.Router();
const care = [authenticate, authorize('ADMIN', 'PT'), requireFeature('CARE')] as const;
/* legacy manual validator
const listAlerts = (req: Request): ValidationIssue[] => { const errors = listValidator(req); if (req.query.customerId && !mongoose.isValidObjectId(String(req.query.customerId))) errors.push({ field: 'customerId', message: 'Mã khách hàng không hợp lệ.' }); if (req.query.status && !['OPEN', 'RESOLVED'].includes(String(req.query.status))) errors.push({ field: 'status', message: 'Trạng thái cảnh báo không hợp lệ.' }); return errors; };
*/
router.post('/care/recalculate', ...care, validate(recalculateCareSchema), controller.recalculate);
router.get('/care/alerts', ...care, validate(listCareAlertsSchema), controller.listAlerts);
router.get('/care/today', ...care, validate(careTodaySchema), controller.today);
router.patch('/care/alerts/:id/resolve', ...care, validate(resolveCareAlertSchema), controller.resolveAlert);
router.post('/care/tasks', ...care, validate(createCareTaskSchema), controller.createTask);
router.get('/care/tasks', ...care, validate(listCareTasksSchema), controller.listTasks);
router.get('/care/logs', ...care, validate(listCareLogsSchema), controller.listLogs);
router.get('/care/tasks/:id', ...care, validate(careTaskIdSchema), controller.getTask);
router.patch('/care/tasks/:id', ...care, validate(updateCareTaskSchema), controller.updateTask);
router.delete('/care/tasks/:id', ...care, validate(careTaskIdSchema), controller.deleteTask);
router.patch('/care/tasks/:id/complete', ...care, validate(completeCareTaskSchema), controller.completeTask);
router.get('/dashboard/pt', authenticate, authorize('PT'), requireFeature('DASHBOARD'), controller.ptDashboard);
export default router;
