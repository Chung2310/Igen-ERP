import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import multer from "multer";
import dotenv from "dotenv";

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async () => {
    return {
      folder: "student_management",
      allowed_formats: ["jpg", "png", "pdf", "jpeg", "webp"],
      resource_type: "auto", // supports pdf and images
    };
  },
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const legacyAllowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

export const upload = multer({
  storage: storage as any,
  limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 5 },
  fileFilter: (_req, file, callback) => callback(null, legacyAllowedMimeTypes.has(file.mimetype)),
});

export const customFieldUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024, files: 1, fields: 5 },
});
export { cloudinary };
