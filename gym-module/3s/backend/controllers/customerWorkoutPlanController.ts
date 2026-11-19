import { asyncHandler } from '../middlewares/asyncHandler.js';
import { success } from '../middlewares/response.js';
import * as service from '../services/customerWorkoutPlanService.js';

export const list = asyncHandler(async (req, res) => success(res, { message: 'Lấy giáo án khách hàng thành công.', data: await service.listCustomerWorkoutPlans(req.user!, String(req.params.id)) }));
export const assign = asyncHandler(async (req, res) => success(res, { status: 201, message: 'Gán giáo án thành công.', data: await service.assignCustomerWorkoutPlan(req.user!, String(req.params.id), String(req.body.templateId)) }));
export const get = asyncHandler(async (req, res) => success(res, { message: 'Lấy giáo án khách hàng thành công.', data: await service.getCustomerWorkoutPlan(req.user!, String(req.params.id), String(req.params.planId)) }));
export const update = asyncHandler(async (req, res) => success(res, { message: 'Cập nhật giáo án khách hàng thành công.', data: await service.updateCustomerWorkoutPlan(req.user!, String(req.params.id), String(req.params.planId), req.body) }));
