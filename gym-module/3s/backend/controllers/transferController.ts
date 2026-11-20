import { Types } from 'mongoose';
import { success } from '../middlewares/response.js';
import { asyncHandler } from '../middlewares/asyncHandler.js';
import * as service from '../services/transferService.js';

const create = asyncHandler(async (req, res) => success(res, { status: 201, message: 'Gửi yêu cầu chuyển PT thành công.', data: await service.createTransfer(req.user!, req.body) }));
const update = asyncHandler(async (req, res) => success(res, { message: 'Cập nhật yêu cầu chuyển PT thành công.', data: await service.updateTransfer(req.user!, String(req.params.id), req.body) }));
const remove = asyncHandler(async (req, res) => { await service.deleteTransfer(req.user!, String(req.params.id)); return success(res, { message: 'Xóa yêu cầu chuyển PT thành công.', data: null }); });
const accept = asyncHandler(async (req, res) => success(res, { message: 'Xác nhận nhận khách thành công.', data: await service.resolveTransfer(req.user!, String(req.params.id), 'accept') }));
const reject = asyncHandler(async (req, res) => success(res, { message: 'Từ chối nhận khách thành công.', data: await service.resolveTransfer(req.user!, String(req.params.id), 'reject') }));
const force = asyncHandler(async (req, res) => success(res, { message: 'Admin chuyển khách thành công.', data: await service.forceTransfer(req.user!, String(req.params.id), req.body) }));
const directForce = asyncHandler(async (req, res) => {
  const newId = new Types.ObjectId().toString();
  const data = await service.forceTransfer(req.user!, newId, req.body);
  return success(res, { status: 201, message: 'Điều chuyển khách hàng thành công.', data });
});
const batchForce = asyncHandler(async (req, res) => {
  const data = await service.batchForceTransfer(req.user!, req.body);
  return success(res, {
    status: 200,
    message: `Đã điều chuyển ${data.transferredCount} khách hàng thành công sang PT ${data.toPtName}.`,
    data,
  });
});
const list = asyncHandler(async (req, res) => { const result = await service.listTransfers(req.user!, req.query); return success(res, { message: 'Lấy danh sách yêu cầu chuyển PT thành công.', data: result.items, meta: result.meta }); });

export { create, update, remove, accept, reject, force, directForce, batchForce, list };
