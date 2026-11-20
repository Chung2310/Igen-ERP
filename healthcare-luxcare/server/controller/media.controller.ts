import { logger } from "../config/logger";
import { Request, Response } from "express";
import { cloudinaryService } from "../service/cloudinary.service";
import { managedUploadService } from "../service/managed-upload.service";

interface MediaControllerDependencies {
  uploadMedia(file: string, folder?: string, filename?: string): Promise<string>;
  createPendingUpload(actor: any, input: any): Promise<{ fileUrl: string; token: string }>;
}

export function createMediaController(deps: MediaControllerDependencies) {
  return {
  /**
   * POST /api/v1/media/upload
   * Nhận file (base64 hoặc URL) và tải lên Cloudinary
   */
  async upload(req: Request & { user?: any }, res: Response) {
    try {
      const { file, folder, filename, sourceType, fileName, mimeType, size } = req.body;
      if (sourceType) {
        const pending = await deps.createPendingUpload({
          companyCode: String(req.user?.companyCode || ""),
          ...(req.user?.branchId ? { branchId: String(req.user.branchId) } : {}),
          actorId: String(req.user?.id || ""),
          actorName: String(req.user?.email || ""),
        }, { file, sourceType, fileName: fileName || filename, mimeType, size });
        return res.status(200).json({ status: "success", url: pending.fileUrl, uploadToken: pending.token });
      }
      const secureUrl = await deps.uploadMedia(file, folder, filename);
      return res.status(200).json({
        status: "success",
        url: secureUrl,
      });
    } catch (error: any) {
      logger.error("[mediaController.upload] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Lỗi kết nối hoặc xử lý tải lên đa phương tiện tới Cloudinary",
        details: error.message,
      });
    }
    },
  };
}

export const mediaController = createMediaController({
  uploadMedia: (file, folder, filename) => cloudinaryService.uploadMedia(file, folder, filename),
  createPendingUpload: (actor, input) => managedUploadService.createPendingUpload(actor, input),
});
