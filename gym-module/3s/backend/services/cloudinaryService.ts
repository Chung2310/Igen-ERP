import { v2 as cloudinary } from 'cloudinary';
import type { UploadApiResponse } from 'cloudinary';
import { AppError } from '../errors/AppError.js';
import { ERROR_CODES } from '../errors/errorCodes.js';
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

function ensureConfig() {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

export function isCloudinaryConfigured(): boolean {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
}

async function uploadImage(fileBuffer: Buffer): Promise<UploadApiResponse> {
  if (!isCloudinaryConfigured()) {
    throw new AppError({ status: 503, code: ERROR_CODES.UNAVAILABLE, message: 'Dịch vụ tải ảnh chưa sẵn sàng.' });
  }
  ensureConfig();

  return new Promise<UploadApiResponse>((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: '3s-gym/avatars',
      },
      (error, result) => {
        if (error || !result) return reject(error || new Error('Cloudinary không trả kết quả upload.'));
        resolve(result);
      }
    );
    uploadStream.end(fileBuffer);
  });
}

async function uploadVideo(fileBuffer: Buffer): Promise<UploadApiResponse> {
  if (!isCloudinaryConfigured()) {
    throw new AppError({ status: 503, code: ERROR_CODES.UNAVAILABLE, message: 'Dịch vụ tải video chưa sẵn sàng.' });
  }
  ensureConfig();

  return new Promise<UploadApiResponse>((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: '3s-gym/exercises/videos', resource_type: 'video' },
      (error, result) => {
        if (error || !result) return reject(error || new Error('Cloudinary không trả kết quả upload video.'));
        resolve(result);
      }
    );
    uploadStream.end(fileBuffer);
  });
}

/**
 * Tải ảnh món ăn lên Cloudinary (folder: 3s-gym/food-images)
 */
export async function uploadFoodImageToCloudinary(
  fileBuffer: Buffer,
  filenameSlug: string
): Promise<UploadApiResponse> {
  if (!isCloudinaryConfigured()) {
    throw new AppError({
      status: 503,
      code: ERROR_CODES.UNAVAILABLE,
      message: 'Dịch vụ tải ảnh Cloudinary chưa được cấu hình.',
    });
  }
  ensureConfig();

  const cleanSlug = (filenameSlug || 'food').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60);
  const publicId = `${cleanSlug}_${Date.now()}`;

  return new Promise<UploadApiResponse>((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: '3s-gym/food-images',
        public_id: publicId,
        resource_type: 'image',
        overwrite: true,
      },
      (error, result) => {
        if (error || !result) return reject(error || new Error('Cloudinary không trả kết quả upload ảnh món ăn.'));
        resolve(result);
      }
    );
    uploadStream.end(fileBuffer);
  });
}

export { uploadImage, uploadVideo };

