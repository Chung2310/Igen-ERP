import { success } from '../middlewares/response.js';
import { asyncHandler } from '../middlewares/asyncHandler.js';
import * as service from '../services/customerService.js';

const list = asyncHandler(async (req, res) => { const result = await service.listCustomers(req.user!, req.query); return success(res, { message: 'Lấy danh sách khách hàng thành công.', data: result.customers, meta: result.meta }); });
const get = asyncHandler(async (req, res) => success(res, { message: 'Lấy hồ sơ khách hàng thành công.', data: await service.getCustomer(req.user!, String(req.params.id)) }));
const create = asyncHandler(async (req, res) => success(res, { status: 201, message: 'Tạo khách hàng thành công.', data: await service.createCustomer(req.user!, req.body) }));
const update = asyncHandler(async (req, res) => success(res, { message: 'Cập nhật khách hàng thành công.', data: await service.updateCustomer(req.user!, String(req.params.id), req.body) }));
const remove = asyncHandler(async (req, res) => { await service.deleteCustomer(req.user!, String(req.params.id)); return success(res, { message: 'Xóa khách hàng và toàn bộ dữ liệu liên quan thành công.', data: null }); });
const createPackage = asyncHandler(async (req, res) => success(res, { status: 201, message: 'Tạo gói PT thành công.', data: await service.createPackage(req.user!, String(req.params.id), req.body) }));
const updatePackage = asyncHandler(async (req, res) => success(res, { message: 'Cập nhật gói PT thành công.', data: await service.updatePackage(req.user!, String(req.params.id), String(req.params.packageId), req.body) }));
const deletePackage = asyncHandler(async (req, res) => { await service.deletePackage(req.user!, String(req.params.id), String(req.params.packageId)); return success(res, { message: 'Xóa gói PT thành công.', data: null }); });
const listPackages = asyncHandler(async (req, res) => { const result = await service.listPackages(req.user!, String(req.params.id), req.query); return success(res, { message: 'Lấy danh sách gói PT thành công.', data: result.packages, meta: result.meta }); });
const createAccount = asyncHandler(async (req, res) => success(res, { status: 201, message: 'Cấp tài khoản khách hàng thành công.', data: await service.createCustomerAccount(req.user!, String(req.params.id), req.body) }));

const listConsultations = asyncHandler(async (req, res) => {
  const result = await service.listConsultations(req.user!, String(req.params.id), req.query);
  return success(res, { message: 'Lấy lịch sử tư vấn thành công.', data: result.consultations, meta: result.meta });
});
const createConsultation = asyncHandler(async (req, res) => success(res, { status: 201, message: 'Tạo buổi tư vấn thành công.', data: await service.createConsultation(req.user!, String(req.params.id), req.body) }));
const updateConsultation = asyncHandler(async (req, res) => success(res, { message: 'Cập nhật thông tin tư vấn thành công.', data: await service.updateConsultation(req.user!, String(req.params.id), String(req.params.consultationId), req.body) }));
const deleteConsultation = asyncHandler(async (req, res) => {
  await service.deleteConsultation(req.user!, String(req.params.id), String(req.params.consultationId));
  return success(res, { message: 'Xóa buổi tư vấn thành công.', data: null });
});

const listPhotos = asyncHandler(async (req, res) => {
  const result = await service.listPhotos(req.user!, String(req.params.id), req.query);
  return success(res, { message: 'Lấy danh sách ảnh tiến độ thành công.', data: result.photos, meta: result.meta });
});
const createPhoto = asyncHandler(async (req, res) => success(res, { status: 201, message: 'Tải lên ảnh tiến độ thành công.', data: await service.createPhoto(req.user!, String(req.params.id), req.body) }));
const updatePhoto = asyncHandler(async (req, res) => success(res, { message: 'Cập nhật ảnh tiến độ thành công.', data: await service.updatePhoto(req.user!, String(req.params.id), String(req.params.photoId), req.body) }));
const deletePhoto = asyncHandler(async (req, res) => {
  await service.deletePhoto(req.user!, String(req.params.id), String(req.params.photoId));
  return success(res, { message: 'Xóa ảnh tiến độ thành công.', data: null });
});

export {
  list,
  get,
  create,
  update,
  remove,
  createPackage,
  updatePackage,
  deletePackage,
  listPackages,
  createAccount,
  listConsultations,
  createConsultation,
  updateConsultation,
  deleteConsultation,
  listPhotos,
  createPhoto,
  updatePhoto,
  deletePhoto,
};
