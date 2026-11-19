import { asyncHandler } from '../middlewares/asyncHandler.js';
import { success } from '../middlewares/response.js';
import * as service from '../services/roadmapService.js';
const get = asyncHandler(async (req, res) => success(res, { message: 'Lấy roadmap thành công.', data: await service.get(req.user!, String(req.params.id)) }));
const remove = asyncHandler(async (req, res) => { await service.remove(req.user!, String(req.params.id)); return success(res, { message: 'Xóa roadmap thành công.', data: null }); });

const create = asyncHandler(async (req, res) => success(res, { status: 201, message: 'Tạo roadmap thành công.', data: await service.create(req.user!, req.body) }));
const update = asyncHandler(async (req, res) => success(res, { message: 'Cập nhật roadmap thành công.', data: await service.update(req.user!, String(req.params.id), req.body) }));
const publish = asyncHandler(async (req, res) => success(res, { message: 'Công bố roadmap thành công.', data: await service.setPublished(req.user!, String(req.params.id), true) }));
const unpublish = asyncHandler(async (req, res) => success(res, { message: 'Thu hồi roadmap thành công.', data: await service.setPublished(req.user!, String(req.params.id), false) }));
const list = asyncHandler(async (req, res) => { const result = await service.list(req.user!, req.query); return success(res, { message: 'Lấy danh sách roadmap thành công.', data: result.items, meta: result.meta }); });
export { create, get, update, remove, publish, unpublish, list };
