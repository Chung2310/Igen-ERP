import { asyncHandler } from '../middlewares/asyncHandler.js';
import { success } from '../middlewares/response.js';
import * as s from '../services/operationsService.js';

const createReport = asyncHandler(async (req, res) => success(res, { status: 201, message: 'Tạo báo cáo tiến độ thành công.', data: await s.createReport(req.user!, req.body) }));
const generateReport = asyncHandler(async (req, res) => success(res, { status: 201, message: 'Tạo báo cáo tiến độ tự động thành công.', data: await s.generateReport(req.user!, req.body) }));
const reports = asyncHandler(async (req, res) => { const r = await s.listReports(req.user!, req.query); return success(res, { message: 'Lấy báo cáo tiến độ thành công.', data: r.items, meta: r.meta }); });
const getReport = asyncHandler(async (req, res) => success(res, { message: 'Lấy báo cáo tiến độ thành công.', data: await s.getReport(req.user!, String(req.params.id)) }));
const updateReport = asyncHandler(async (req, res) => success(res, { message: 'Cập nhật báo cáo tiến độ thành công.', data: await s.updateReport(req.user!, String(req.params.id), req.body) }));
const publishReport = asyncHandler(async (req, res) => success(res, { message: 'Công bố báo cáo tiến độ thành công.', data: await s.publishReport(req.user!, String(req.params.id)) }));
const unpublishReport = asyncHandler(async (req, res) => success(res, { message: 'Gỡ công bố báo cáo tiến độ thành công.', data: await s.unpublishReport(req.user!, String(req.params.id)) }));
const deleteReport = asyncHandler(async (req, res) => success(res, { message: 'Xóa báo cáo tiến độ thành công.', data: await s.deleteReport(req.user!, String(req.params.id)) }));
const notifications = asyncHandler(async (req, res) => { const r = await s.listNotifications(req.user!, req.query); return success(res, { message: 'Lấy thông báo thành công.', data: r.items, meta: r.meta }); });
const readNotification = asyncHandler(async (req, res) => success(res, { message: 'Đánh dấu thông báo đã đọc thành công.', data: await s.readNotification(req.user!, String(req.params.id)) }));
const createTestNotification = asyncHandler(async (req, res) => {
  const result = await s.createTestNotification(req.user!);
  return success(res, {
    status: 201,
    message: result.pushSent > 0 ? 'Đã tạo và gửi push notification thành công.' : 'Đã tạo thông báo thành công.',
    data: result.item,
    meta: { pushSent: result.pushSent },
  });
});
const createEvent = asyncHandler(async (req, res) => success(res, { status: 201, message: 'Tạo lịch thành công.', data: await s.createEvent(req.user!, req.body) }));
const events = asyncHandler(async (req, res) => { const r = await s.listEvents(req.user!, req.query); return success(res, { message: 'Lấy lịch thành công.', data: r.items, meta: r.meta }); });
const getEvent = asyncHandler(async (req, res) => success(res, { message: 'Lấy lịch thành công.', data: await s.getEvent(req.user!, String(req.params.id)) }));
const updateEvent = asyncHandler(async (req, res) => success(res, { message: 'Cập nhật lịch thành công.', data: await s.updateEvent(req.user!, String(req.params.id), req.body) }));
const deleteEvent = asyncHandler(async (req, res) => success(res, { message: 'Xóa lịch thành công.', data: await s.deleteEvent(req.user!, String(req.params.id)) }));
const adminDashboard = asyncHandler(async (req, res) => success(res, { message: 'Lấy dashboard Admin thành công.', data: await s.adminDashboard(req.query) }));

export { createReport, generateReport, reports, getReport, updateReport, publishReport, unpublishReport, deleteReport, notifications, readNotification, createTestNotification, createEvent, events, getEvent, updateEvent, deleteEvent, adminDashboard };
