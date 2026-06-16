import { Router } from "express";
import Joi from "joi";
import { mediaController } from "../controller/media.controller";
import { validateRequest } from "../middleware/validation";
import { requireAuth } from "../middleware/auth";

export const mediaRouter = Router();

const uploadSchema = {
  body: Joi.object({
    file: Joi.string().required().messages({
      "any.required": "Trường 'file' là bắt buộc và không thể thiếu.",
      "string.empty": "Nội dung 'file' không được để trống.",
    }),
    folder: Joi.string().optional().allow("").messages({
      "string.base": "Trường 'folder' phải là kiểu văn bản (string).",
    }),
  }),
};

// Route tải lên đa phương tiện tới Cloudinary qua Backend Relay (Yêu cầu đăng nhập)
mediaRouter.post(
  "/upload",
  requireAuth as any,
  validateRequest(uploadSchema),
  mediaController.upload as any
);

// Route download proxy để giải quyết vấn đề CORS ở phía Client
mediaRouter.get(
  "/download",
  requireAuth as any,
  async (req, res) => {
    const fileUrl = req.query.url as string;
    const filename = (req.query.filename as string) || "igen-download";
    if (!fileUrl) {
      return res.status(400).json({ error: "Missing url parameter" });
    }
    try {
      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const contentType = response.headers.get("content-type");
      if (contentType) {
        res.setHeader("Content-Type", contentType);
      }
      res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);
      
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      res.send(buffer);
    } catch (err: any) {
      console.error("[Media Proxy Download Error]:", err);
      res.status(500).json({ error: "Failed to download file", details: err.message });
    }
  }
);
