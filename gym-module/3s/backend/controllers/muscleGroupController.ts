import { asyncHandler } from '../middlewares/asyncHandler.js';
import { success } from '../middlewares/response.js';
import * as service from '../services/muscleGroupService.js';

export const list = asyncHandler(async (_req, res) => {
  const data = await service.listMuscleGroups();
  return success(res, { message: 'Lấy danh sách nhóm cơ thành công.', data });
});

export const create = asyncHandler(async (req, res) => {
  const data = await service.createMuscleGroup(String(req.body?.name || ''));
  return success(res, { status: 201, message: 'Thêm nhóm cơ thành công.', data });
});

export const remove = asyncHandler(async (req, res) => {
  await service.deleteMuscleGroup(String(req.params.id));
  return success(res, { message: 'Xóa nhóm cơ thành công.', data: null });
});
