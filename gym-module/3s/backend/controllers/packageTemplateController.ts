import { asyncHandler } from '../middlewares/asyncHandler.js';
import { success } from '../middlewares/response.js';
import * as packageTemplateService from '../services/packageTemplateService.js';

export const list = asyncHandler(async (req, res) => {
  const result = await packageTemplateService.listTemplates(req.query);
  return success(res, {
    message: 'Lấy danh sách gói tập mẫu thành công.',
    data: result.templates,
    meta: result.meta,
  });
});

export const get = asyncHandler(async (req, res) => {
  const data = await packageTemplateService.getTemplate(String(req.params.id));
  return success(res, {
    message: 'Lấy thông tin gói tập mẫu thành công.',
    data,
  });
});

export const create = asyncHandler(async (req, res) => {
  const data = await packageTemplateService.createTemplate(req.body, req.user?._id?.toString());
  return success(res, {
    status: 201,
    message: 'Tạo gói tập mẫu thành công.',
    data,
  });
});

export const update = asyncHandler(async (req, res) => {
  const data = await packageTemplateService.updateTemplate(String(req.params.id), req.body);
  return success(res, {
    message: 'Cập nhật gói tập mẫu thành công.',
    data,
  });
});

export const remove = asyncHandler(async (req, res) => {
  const data = await packageTemplateService.deleteTemplate(String(req.params.id));
  return success(res, {
    message: 'Xóa gói tập mẫu thành công.',
    data,
  });
});
