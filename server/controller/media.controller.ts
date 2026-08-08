import { Response } from "express";
import type { AuthenticatedRequest } from "../middleware/auth";
import { cloudinaryService } from "../service/cloudinary.service";
import { managedUploadService } from "../service/managed-upload.service";

interface MediaControllerDependencies {
  cloudinary: Pick<typeof cloudinaryService, "uploadMedia">;
  managedUpload: Pick<typeof managedUploadService, "createPendingUpload">;
}

export function createMediaController(dependencies: MediaControllerDependencies) {
  return {
    /** POST /api/v1/media/upload */
    async upload(req: AuthenticatedRequest, res: Response) {
      try {
        const { file, folder, sourceType, name, fileName, mimeType, size, companyCode } = req.body;
        if (sourceType) {
          if (!req.user?.id || !req.user.companyCode) {
            return res.status(401).json({ status: "error", message: "Người dùng chưa xác thực." });
          }
          const pending = await dependencies.managedUpload.createPendingUpload(
            {
              companyCode: req.user.role === "superadmin" && companyCode
                ? String(companyCode).trim().toUpperCase()
                : req.user.companyCode,
              branchId: req.user.branchId,
              actorId: req.user.id,
              actorName: req.user.email,
            },
            {
              sourceType,
              file,
              fileName: fileName || name,
              mimeType,
              size,
            },
          );
          return res.status(200).json({
            status: "success",
            url: pending.fileUrl,
            storagePublicId: pending.storagePublicId,
            uploadToken: pending.token,
          });
        }

        const secureUrl = await dependencies.cloudinary.uploadMedia(file, folder);
        return res.status(200).json({ status: "success", url: secureUrl });
      } catch (error: any) {
        console.error("[mediaController.upload] Error:", error);
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
  cloudinary: cloudinaryService,
  managedUpload: managedUploadService,
});
