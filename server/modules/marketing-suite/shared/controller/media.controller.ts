/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Response } from "express";
import type { AuthenticatedRequest } from "../middleware/auth";
import { cloudinaryService } from "../service/cloudinary.service.ts";
import { CampaignUploadError, getCampaignMediaUploadFolder } from "../campaign-media-upload";

export const mediaController = {
  /**
   * POST /api/v1/marketing-media/upload
   * Nhận file (base64 hoặc URL) và tải lên Cloudinary
   */
  async upload(req: AuthenticatedRequest, res: Response) {
    try {
      const { file } = req.body;
      const folder = getCampaignMediaUploadFolder(req.user?.companyCode || "", req.user?.id || "");
      const secureUrl = await cloudinaryService.uploadMedia(file, folder);
      return res.status(200).json({
        status: "success",
        url: secureUrl,
      });
    } catch (error: any) {
      if (error instanceof CampaignUploadError) return res.status(error.statusCode).json({ status: "error", message: error.message });
      console.error("[mediaController.upload] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Lỗi kết nối hoặc xử lý tải lên đa phương tiện tới Cloudinary",
        details: error.message,
      });
    }
  },
};
