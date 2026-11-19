import { asyncHandler } from '../middlewares/asyncHandler.js';
import { success } from '../middlewares/response.js';
import * as service from '../services/creditAdminService.js';

export const pricing = asyncHandler(async (_req, res) => success(res, { message: 'Đã tải cấu hình credit.', data: await service.getPricing() }));
export const updatePricing = asyncHandler(async (req, res) => success(res, { message: 'Đã cập nhật cấu hình credit.', data: await service.updatePricing(req.user!, req.body) }));
export const packages = asyncHandler(async (_req, res) => success(res, { message: 'Đã tải gói credit.', data: await service.listPackages() }));
export const createPackage = asyncHandler(async (req, res) => success(res, { status: 201, message: 'Đã tạo gói credit.', data: await service.createPackage(req.user!, req.body) }));
export const updatePackage = asyncHandler(async (req, res) => success(res, { message: 'Đã cập nhật gói credit.', data: await service.updatePackage(req.user!, String(req.params.id), req.body) }));
export const deletePackage = asyncHandler(async (req, res) => { await service.deletePackage(req.user!, String(req.params.id)); return success(res, { message: 'Đã xóa gói credit.', data: null }); });
export const adjustment = asyncHandler(async (req, res) => success(res, { status: 201, message: 'Đã điều chỉnh credit.', data: await service.createAdjustment(req.user!, req.body, req.requestId!) }));
const listing = (loader: (query: Record<string, unknown>) => Promise<{ items: unknown[]; meta: unknown }>) => asyncHandler(async (req, res) => { const result = await loader(req.query); return success(res, { message: 'Đã tải dữ liệu đối soát credit.', data: result.items, meta: result.meta }); });
export const paymentOrders = listing(service.listPaymentOrders);
export const aiUsage = listing(service.listAiUsage);
export const ledger = listing(service.listCreditLedger);
export const shortfalls = listing(service.listShortfalls);
