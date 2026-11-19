import { asyncHandler } from '../middlewares/asyncHandler.js';
import { success } from '../middlewares/response.js';
import { AppError } from '../errors/AppError.js';
import { ERROR_CODES } from '../errors/errorCodes.js';
import * as service from '../services/nutritionMetricsService.js';
import { isAdminRole } from '../services/roles.js';

const metrics = asyncHandler(async (req, res) => success(res, { message: 'Tính chỉ số dinh dưỡng thành công.', data: await service.calculateMetrics(req.body) }));
const createActivity = asyncHandler(async (req, res) => success(res, { status: 201, message: 'Tạo hoạt động thành công.', data: await service.createActivity(req.body) }));
const listActivities = asyncHandler(async (req, res) => { const result = await service.listActivities(req.query, isAdminRole(req.user!.role)); return success(res, { message: 'Lấy danh sách hoạt động thành công.', data: result.items, meta: result.meta }); });
const updateActivity = asyncHandler(async (req, res) => { const data = await service.updateActivity(req.user!, String(req.params.id), req.body); if (!data) throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, message: 'Không tìm thấy hoạt động.' }); return success(res, { message: 'Cập nhật hoạt động thành công.', data }); });
const createFormula = asyncHandler(async (req, res) => success(res, { status: 201, message: 'Tạo phiên bản công thức thành công.', data: await service.createFormula(req.body) }));
const estimate = asyncHandler(async (req, res) => { const data = await service.estimateActivity(String(req.params.id), req.body.weightKg, req.body.durationMinutes); if (!data) throw new AppError({ status: 404, code: ERROR_CODES.NOT_FOUND, message: 'Không tìm thấy hoạt động.' }); return success(res, { message: 'Ước tính calories tiêu hao thành công.', data }); });

export { metrics, createActivity, listActivities, updateActivity, createFormula, estimate };
