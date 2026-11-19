import express from 'express';
import multer from 'multer';
import { authenticate, authorize } from '../middlewares/auth.js';
import * as controller from '../controllers/foodImageController.js';

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

// Cho phép cả Admin và PT tìm kiếm/lấy ảnh hoặc sinh ảnh mới
router.post('/images/meal-image', authenticate, authorize('ADMIN', 'PT'), controller.getOrGenerateMealImage);
router.get('/food-images', authenticate, authorize('ADMIN', 'PT'), controller.listFoodImages);

// Các tác vụ quản trị kho ảnh (Upload & AI Generate cho phép cả ADMIN và PT)
router.post('/food-images/upload', authenticate, authorize('ADMIN', 'PT'), upload.single('image'), controller.uploadFoodImage);
router.patch('/food-images/:id', authenticate, authorize('ADMIN'), upload.single('image'), controller.updateFoodImage);
router.post('/food-images/:id/regenerate-ai', authenticate, authorize('ADMIN'), controller.regenerateAiImage);
router.post('/food-images/ai-generate', authenticate, authorize('ADMIN', 'PT'), controller.createAiFoodImage);
router.delete('/food-images/:id', authenticate, authorize('ADMIN'), controller.deleteFoodImage);

export default router;
