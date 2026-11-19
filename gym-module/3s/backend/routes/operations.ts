import express from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import { requireFeature } from '../middlewares/requireFeature.js';
import { validate } from '../middlewares/validate.js';
import * as c from '../controllers/operationsController.js';
import { adminDashboardSchema, createCalendarEventSchema, createProgressReportSchema, generateProgressReportSchema, listCalendarEventsSchema, listOperationSchema, operationIdSchema, updateCalendarEventSchema, updateProgressReportSchema } from '../validators/operationsValidator.js';

const router = express.Router();
const progress = [authenticate, authorize('ADMIN', 'PT'), requireFeature('PROGRESS')] as const;
/* legacy manual validators
const idValidator = (req: Request): ValidationIssue[] => mongoose.isValidObjectId(req.params.id) ? [] : [{ field: 'id', message: 'Mã dữ liệu không hợp lệ.' }];
const reportValidator = (req: Request): ValidationIssue[] => { const e: ValidationIssue[] = []; if (!mongoose.isValidObjectId(req.body.customerId)) e.push({ field: 'customerId', message: 'Mã khách hàng không hợp lệ.' }); if (!req.body.periodStart || Number.isNaN(Date.parse(req.body.periodStart))) e.push({ field: 'periodStart', message: 'Ngày bắt đầu không hợp lệ.' }); if (!req.body.periodEnd || Number.isNaN(Date.parse(req.body.periodEnd))) e.push({ field: 'periodEnd', message: 'Ngày kết thúc không hợp lệ.' }); if (typeof req.body.summary !== 'string' || !req.body.summary.trim()) e.push({ field: 'summary', message: 'Vui lòng nhập nội dung báo cáo.' }); return e; };

*/
router.post('/progress-reports', ...progress, validate(createProgressReportSchema), c.createReport);
router.post('/progress-reports/generate', ...progress, validate(generateProgressReportSchema), c.generateReport);
router.get('/progress-reports', ...progress, validate(listOperationSchema), c.reports);
router.patch('/progress-reports/:id/publish', ...progress, validate(operationIdSchema), c.publishReport);
router.patch('/progress-reports/:id/unpublish', ...progress, validate(operationIdSchema), c.unpublishReport);
router.get('/progress-reports/:id', ...progress, validate(operationIdSchema), c.getReport);
router.patch('/progress-reports/:id', ...progress, validate(updateProgressReportSchema), c.updateReport);
router.delete('/progress-reports/:id', ...progress, validate(operationIdSchema), c.deleteReport);

router.get('/notifications', authenticate, validate(listOperationSchema), c.notifications);
router.post('/notifications/test', authenticate, c.createTestNotification);
router.patch('/notifications/:id/read', authenticate, validate(operationIdSchema), c.readNotification);

/* legacy manual validator removed */
router.post('/calendar-events', authenticate, authorize('ADMIN', 'PT'), validate(createCalendarEventSchema), c.createEvent);
router.get('/calendar-events', authenticate, authorize('ADMIN', 'PT'), validate(listCalendarEventsSchema), c.events);
router.get('/calendar-events/:id', authenticate, authorize('ADMIN', 'PT'), validate(operationIdSchema), c.getEvent);
router.patch('/calendar-events/:id', authenticate, authorize('ADMIN', 'PT'), validate(updateCalendarEventSchema), c.updateEvent);
router.delete('/calendar-events/:id', authenticate, authorize('ADMIN', 'PT'), validate(operationIdSchema), c.deleteEvent);

router.get('/dashboard/admin', authenticate, authorize('ADMIN'), requireFeature('DASHBOARD'), validate(adminDashboardSchema), c.adminDashboard);
export default router;
