import { asyncHandler } from '../middlewares/asyncHandler.js';
import { success } from '../middlewares/response.js';
import * as service from '../services/nutritionLogService.js';

const create = asyncHandler(async (req, res) => success(res, { status: 201, message: 'Ghi nhật ký dinh dưỡng thành công.', data: await service.create(req.user!, req.body) }));
const list = asyncHandler(async (req, res) => { const result = await service.list(req.user!, req.query); return success(res, { message: 'Lấy nhật ký dinh dưỡng thành công.', data: result.items, meta: result.meta, summary: result.summary }); });
const update = asyncHandler(async (req, res) => success(res, { message: 'Cập nhật nhật ký dinh dưỡng thành công.', data: await service.update(req.user!, String(req.params.id), req.body) }));
const remove = asyncHandler(async (req, res) => { await service.remove(req.user!, String(req.params.id)); return success(res, { message: 'Xóa nhật ký dinh dưỡng thành công.', data: null }); });
export { create, list, update, remove };
