import { asyncHandler } from '../middlewares/asyncHandler.js';
import { success } from '../middlewares/response.js';
import { AppError } from '../errors/AppError.js';
import { ERROR_CODES } from '../errors/errorCodes.js';
import * as foodImageService from '../services/foodImageService.js';
import type { AspectRatio } from '../services/imageProvider.js';

/**
 * POST /api/images/meal-image
 * Lấy ảnh món ăn từ kho (nếu có sẵn) hoặc tự động dùng AI sinh ảnh mới và lưu vào kho.
 */
export const getOrGenerateMealImage = asyncHandler(async (req, res) => {
  const { mealName, items, prompt, aspectRatio, forceRegenerate } = req.body;

  if (!mealName || typeof mealName !== 'string' || !mealName.trim()) {
    throw new AppError({ status: 400, code: ERROR_CODES.VALIDATION, message: 'Vui lòng cung cấp tên bữa ăn hoặc món ăn.' });
  }

  const result = await foodImageService.getOrGenerateMealImage({
    mealName: mealName.trim(),
    foodItems: Array.isArray(items) ? items.map((i: any) => String(i)) : [],
    prompt: typeof prompt === 'string' ? prompt : undefined,
    userId: req.user!.id,
    requestKey: `${req.requestId}:meal-image`,
    aspectRatio: (aspectRatio as AspectRatio) || '4:3',
    forceRegenerate: Boolean(forceRegenerate),
  });

  return success(res, {
    message: result.message,
    data: result,
  });
});

/**
 * GET /api/food-images
 * Lấy danh sách ảnh món ăn trong kho thư viện (kèm thống kê tổng quát)
 */
export const listFoodImages = asyncHandler(async (req, res) => {
  const { page, limit, search, source, category } = req.query;

  const result = await foodImageService.listFoodImages({
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
    search: typeof search === 'string' ? search : undefined,
    source: typeof source === 'string' ? source : undefined,
    category: typeof category === 'string' ? category : undefined,
  });

  return success(res, {
    message: 'Lấy danh sách kho ảnh món ăn thành công.',
    data: result.items,
    meta: result.meta,
    summary: result.summary,
  });
});

/**
 * POST /api/food-images/upload
 * Tải ảnh món ăn từ máy tính lên kho kèm tên món
 */
export const uploadFoodImage = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new AppError({ status: 400, code: ERROR_CODES.UPLOAD, message: 'Vui lòng chọn file ảnh để tải lên.' });
  }

  const name = req.body.name;
  if (!name || typeof name !== 'string' || !name.trim()) {
    throw new AppError({ status: 400, code: ERROR_CODES.VALIDATION, message: 'Vui lòng nhập tên món ăn cho bức ảnh này.' });
  }

  const saved = await foodImageService.saveFoodImageToStorage({
    buffer: req.file.buffer,
    name: name.trim(),
    category: typeof req.body.category === 'string' ? req.body.category : undefined,
    mimeType: req.file.mimetype || 'image/jpeg',
    source: 'UPLOAD',
    prompt: req.body.prompt || '',
    calories: req.body.calories !== undefined && req.body.calories !== '' && !isNaN(Number(req.body.calories)) ? Number(req.body.calories) : undefined,
    protein: req.body.protein !== undefined && req.body.protein !== '' && !isNaN(Number(req.body.protein)) ? Number(req.body.protein) : undefined,
    carbs: req.body.carbs !== undefined && req.body.carbs !== '' && !isNaN(Number(req.body.carbs)) ? Number(req.body.carbs) : undefined,
    fat: req.body.fat !== undefined && req.body.fat !== '' && !isNaN(Number(req.body.fat)) ? Number(req.body.fat) : undefined,
    keywords: typeof req.body.keywords === 'string' ? req.body.keywords.split(',').map((k: string) => k.trim()) : undefined,
    userId: req.user!.id,
  });

  return success(res, {
    status: 201,
    message: `Đã tải ảnh lên kho cho món "${saved.name}" thành công!`,
    data: saved,
  });
});

/**
 * POST /api/food-images/ai-generate
 * Admin chủ động tạo ảnh AI cho món ăn để lưu trữ sẵn trong kho
 */
export const createAiFoodImage = asyncHandler(async (req, res) => {
  const { name, prompt, aspectRatio } = req.body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    throw new AppError({ status: 400, code: ERROR_CODES.VALIDATION, message: 'Vui lòng nhập tên món ăn cần tạo ảnh AI.' });
  }

  const result = await foodImageService.getOrGenerateMealImage({
    mealName: name.trim(),
    foodItems: [],
    prompt: typeof prompt === 'string' ? prompt : undefined,
    userId: req.user!.id,
    requestKey: `${req.requestId}:admin-ai-image`,
    aspectRatio: (aspectRatio as AspectRatio) || '4:3',
  });

  return success(res, {
    status: 201,
    message: result.message,
    data: result,
  });
});

/**
 * PATCH /api/food-images/:id
 * Chỉnh sửa toàn bộ thông tin món ăn (Tên, Từ khóa, Danh mục, Calo, Macro, Prompt, Link ảnh, File ảnh, Lượt dùng)
 */
export const updateFoodImage = asyncHandler(async (req, res) => {
  const id = String(req.params.id);
  const { name, prompt, keywords, category, imageUrl, calories, protein, carbs, fat, usageCount, source } = req.body;

  const updated = await foodImageService.updateFoodImage(id, {
    name: typeof name === 'string' ? name : undefined,
    keywords: keywords !== undefined ? keywords : undefined,
    category: typeof category === 'string' ? category : undefined,
    prompt: typeof prompt === 'string' ? prompt : undefined,
    imageUrl: typeof imageUrl === 'string' ? imageUrl : undefined,
    calories: calories !== undefined ? Number(calories) : undefined,
    protein: protein !== undefined ? Number(protein) : undefined,
    carbs: carbs !== undefined ? Number(carbs) : undefined,
    fat: fat !== undefined ? Number(fat) : undefined,
    usageCount: usageCount !== undefined ? Number(usageCount) : undefined,
    source: typeof source === 'string' ? (source as 'AI' | 'UPLOAD' | 'SEED') : undefined,
    buffer: req.file?.buffer,
    mimeType: req.file?.mimetype,
    userId: req.user!.id,
  });

  return success(res, {
    message: `Đã cập nhật toàn bộ thông tin món "${updated.name}" thành công!`,
    data: updated,
  });
});

/**
 * POST /api/food-images/:id/regenerate-ai
 * Tạo lại ảnh bằng AI cho một món ăn đã có trong kho
 */
export const regenerateAiImage = asyncHandler(async (req, res) => {
  const id = String(req.params.id);
  const { prompt, aspectRatio } = req.body;

  const updated = await foodImageService.regenerateFoodImageWithAi(id, {
    prompt: typeof prompt === 'string' ? prompt : undefined,
    aspectRatio: (aspectRatio as AspectRatio) || '4:3',
    userId: req.user!.id,
    requestKey: `${req.requestId}:regenerate-image`,
  });

  return success(res, {
    message: `Đã tái tạo ảnh bằng AI cho món "${updated.name}" thành công!`,
    data: updated,
  });
});

/**
 * DELETE /api/food-images/:id
 * Xóa một ảnh món ăn khỏi kho
 */
export const deleteFoodImage = asyncHandler(async (req, res) => {
  const id = String(req.params.id);
  await foodImageService.deleteFoodImage(id);

  return success(res, {
    message: 'Đã xóa ảnh món ăn khỏi kho thành công.',
    data: { id },
  });
});
