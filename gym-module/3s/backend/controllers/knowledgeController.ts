import { asyncHandler } from '../middlewares/asyncHandler.js';
import { success } from '../middlewares/response.js';
import * as knowledgeService from '../services/knowledgeService.js';

export const listDocuments = asyncHandler(async (req, res) => {
  const result = await knowledgeService.listDocuments({
    page: req.query.page ? Number(req.query.page) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
    status: typeof req.query.status === 'string' ? req.query.status : undefined,
    topic: typeof req.query.topic === 'string' ? req.query.topic : undefined,
    search: typeof req.query.search === 'string' ? req.query.search : undefined,
  });

  return success(res, {
    message: 'Lấy danh sách tài liệu tri thức thành công.',
    data: result.items,
    meta: result.meta,
  });
});

export const uploadDocuments = asyncHandler(async (req, res) => {
  const files = (req.files as Express.Multer.File[]) || (req.file ? [req.file] : []);
  const topic = String(req.body.topic || 'QUY TRÌNH & HỆ THỐNG');
  const result = await knowledgeService.uploadAndProcessFiles(files, topic, req.user!);

  return success(res, {
    status: 201,
    message: result.message,
    data: result,
  });
});

export const createDocument = asyncHandler(async (req, res) => {
  const doc = await knowledgeService.createDocument(req.body, req.user!);
  return success(res, {
    status: 201,
    message: 'Tạo tài liệu tri thức thành công.',
    data: doc,
  });
});

export const updateDocument = asyncHandler(async (req, res) => {
  const doc = await knowledgeService.updateDocument(String(req.params.id), req.body);
  return success(res, {
    message: 'Cập nhật tài liệu tri thức thành công.',
    data: doc,
  });
});

export const deleteDocument = asyncHandler(async (req, res) => {
  await knowledgeService.deleteDocument(String(req.params.id));
  return success(res, {
    message: 'Xóa tài liệu tri thức thành công.',
    data: { id: req.params.id },
  });
});

export const publishDocument = asyncHandler(async (req, res) => {
  const doc = await knowledgeService.publishDocument(String(req.params.id), req.user!);
  return success(res, {
    message: 'Xuất bản tài liệu tri thức thành công.',
    data: doc,
  });
});

export const unpublishDocument = asyncHandler(async (req, res) => {
  const doc = await knowledgeService.unpublishDocument(String(req.params.id));
  return success(res, {
    message: 'Đã thu hồi tài liệu về bản nháp.',
    data: doc,
  });
});

export const seedStandard = asyncHandler(async (req, res) => {
  const result = await knowledgeService.seedStandardKnowledgeLibrary(req.user!);
  return success(res, {
    message: result.message,
    data: result,
  });
});
