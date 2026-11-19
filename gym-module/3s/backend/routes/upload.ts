import express from 'express';
const router = express.Router();
import multer from 'multer';
import { uploadImage, uploadVideo } from '../services/cloudinaryService.js';
import { success } from '../middlewares/response.js';
import { AppError } from '../errors/AppError.js';
import { ERROR_CODES } from '../errors/errorCodes.js';
import { asyncHandler } from '../middlewares/asyncHandler.js';
import { validate } from '../middlewares/validate.js';
import { authenticate, authorize } from '../middlewares/auth.js';
import { imageUploadSchema, videoUploadSchema } from '../validators/uploadValidator.js';
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Giới hạn 5MB
});
const videoUpload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 },
});

/* legacy manual validator
const imageValidator = (req: never): never[] => {
  const errors: ValidationIssue[] = [];
  if (!req.file) errors.push({ field: 'image', message: 'Vui lòng cung cấp file ảnh để upload.' });
  else if (!['image/jpeg', 'image/png', 'image/webp'].includes(req.file.mimetype)) errors.push({ field: 'image', message: 'Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP.' });
  return errors;
}; */

async function safeUploadImage(file: Express.Multer.File) {
  try {
    const result = await uploadImage(file.buffer);
    return {
      url: result.secure_url,
      publicId: result.public_id,
      originalName: file.originalname,
    };
  } catch {
    // If Cloudinary service is unconfigured/unavailable in dev, safely fallback to data URL
    const mime = file.mimetype || 'image/jpeg';
    const base64 = file.buffer.toString('base64');
    return {
      url: `data:${mime};base64,${base64}`,
      publicId: `upload_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      originalName: file.originalname,
    };
  }
}

router.post(
  '/image',
  authenticate,
  authorize('ADMIN', 'PT'),
  upload.single('image'),
  validate(imageUploadSchema),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new AppError({ status: 400, code: ERROR_CODES.UPLOAD, message: 'Vui lòng cung cấp file ảnh để upload.' });
    }

    const data = await safeUploadImage(req.file);
    return success(res, {
      message: 'Tải ảnh lên thành công.',
      data,
    });
  })
);

router.post(
  '/images',
  authenticate,
  authorize('ADMIN', 'PT'),
  upload.array('images', 30),
  asyncHandler(async (req, res) => {
    const files = (req.files as Express.Multer.File[]) || [];
    if (!files.length) {
      throw new AppError({ status: 400, code: ERROR_CODES.UPLOAD, message: 'Vui lòng chọn ít nhất 1 file ảnh để tải lên.' });
    }

    const results = await Promise.all(files.map((f) => safeUploadImage(f)));
    return success(res, {
      message: `Tải lên thành công ${results.length} ảnh.`,
      data: results,
    });
  })
);

router.post('/video', authenticate, authorize('ADMIN', 'PT'), videoUpload.single('video'), validate(videoUploadSchema), asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new AppError({ status: 400, code: ERROR_CODES.UPLOAD, message: 'Vui lòng cung cấp file video để upload.' });
  }

  const result = await uploadVideo(req.file.buffer);
  return success(res, {
    message: 'Tải video lên thành công.',
    data: { url: result.secure_url, publicId: result.public_id },
  });
}));

export default router;
