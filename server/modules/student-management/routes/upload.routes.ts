import { Router } from "express";
import { UploadController } from "../controllers/upload.controller";
import { upload } from "../config/cloudinary";
import { publicApiRateLimiter } from "../../../middleware/rate-limit";
import { requirePermission } from "../../../middleware/auth";

const router = Router();

// Middleware upload.single("file") extracts the "file" field from multipart data
// eslint-disable-next-line @typescript-eslint/no-explicit-any
router.post("/", publicApiRateLimiter, requirePermission("student:manage") as any, upload.single("file") as any, UploadController.uploadFile as any);

export default router;
