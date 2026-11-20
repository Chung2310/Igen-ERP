import { asyncHandler } from '../middlewares/asyncHandler.js';
import { success } from '../middlewares/response.js';
import * as featureFlagService from '../services/featureFlagService.js';
import type { FeatureKey } from '../models/FeatureFlag.js';

const mine = asyncHandler(async (req, res) => success(res, {
  message: 'Lấy cấu hình tính năng thành công.',
  data: await featureFlagService.getFeaturesForUser(req.user!),
}));

const update = asyncHandler(async (req, res) => success(res, {
  message: 'Cập nhật cấu hình tính năng thành công.',
  data: await featureFlagService.updateFeature(req.user!, String(req.params.key) as FeatureKey, req.body),
}));

const list = asyncHandler(async (req, res) => success(res, {
  message: 'Lấy cấu hình quản trị tính năng thành công.',
  data: await featureFlagService.listFeatures(req.user!),
}));
export { mine, update, list };
