import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { resourceService, resourceDriveService } from "../service/resource.service";

function getCompanyCode(req: AuthenticatedRequest): string {
  return req.user?.companyCode || "SYSTEM";
}

function getCreator(req: AuthenticatedRequest) {
  return { uid: req.user?.id, name: req.user?.email };
}

/**
 * Trả lỗi dạng JSON để client đọc được thông báo (app không có error middleware JSON,
 * nếu dùng next(error) sẽ rơi vào handler mặc định trả HTML 500).
 */
function sendError(res: Response, error: any, context: string) {
  console.error(`[resourceController.${context}] Error:`, error);
  return res.status(400).json({
    status: "error",
    success: false,
    message: error?.message || "Đã xảy ra lỗi khi xử lý tài nguyên.",
  });
}

export const resourceController = {
  /** GET /api/v1/resources?section=&parentId= */
  async list(req: AuthenticatedRequest, res: Response) {
    try {
      const section = (req.query.section as "local" | "drive") || "local";
      const parentId = (req.query.parentId as string) || null;
      const items = await resourceService.list(getCompanyCode(req), section, parentId, req.user?.id);
      return res.json({ success: true, items });
    } catch (error) {
      return sendError(res, error, "list");
    }
  },

  /** GET /api/v1/resources/breadcrumb/:id */
  async breadcrumb(req: AuthenticatedRequest, res: Response) {
    try {
      const trail = await resourceService.breadcrumb(getCompanyCode(req), req.params.id, req.user?.id);
      return res.json({ success: true, trail });
    } catch (error) {
      return sendError(res, error, "breadcrumb");
    }
  },

  /** POST /api/v1/resources/folder */
  async createFolder(req: AuthenticatedRequest, res: Response) {
    try {
      const { name, parentId, section } = req.body;
      const item = await resourceService.createFolder(
        getCompanyCode(req),
        { name, parentId, section },
        getCreator(req)
      );
      return res.status(201).json({ success: true, item });
    } catch (error) {
      return sendError(res, error, "createFolder");
    }
  },

  /** POST /api/v1/resources/file */
  async createFile(req: AuthenticatedRequest, res: Response) {
    try {
      const { name, fileUrl, parentId, mimeType, size } = req.body;
      const item = await resourceService.createFile(
        getCompanyCode(req),
        { name, fileUrl, parentId, mimeType, size },
        getCreator(req)
      );
      return res.status(201).json({ success: true, item });
    } catch (error) {
      return sendError(res, error, "createFile");
    }
  },

  /** POST /api/v1/resources/drive */
  async addDriveLink(req: AuthenticatedRequest, res: Response) {
    try {
      const { name, driveLink, driveType } = req.body;
      const item = await resourceService.addDriveLink(
        getCompanyCode(req),
        { name, driveLink, driveType },
        getCreator(req)
      );
      return res.status(201).json({ success: true, item });
    } catch (error) {
      return sendError(res, error, "addDriveLink");
    }
  },

  /** PATCH /api/v1/resources/:id/rename */
  async rename(req: AuthenticatedRequest, res: Response) {
    try {
      const item = await resourceService.rename(getCompanyCode(req), req.params.id, req.body.name);
      return res.json({ success: true, item });
    } catch (error) {
      return sendError(res, error, "rename");
    }
  },

  /** DELETE /api/v1/resources/:id */
  async remove(req: AuthenticatedRequest, res: Response) {
    try {
      const result = await resourceService.remove(getCompanyCode(req), req.params.id);
      return res.json({ success: true, ...result });
    } catch (error) {
      return sendError(res, error, "remove");
    }
  },

  /** GET /api/v1/resources/drive/files — liệt kê file trong thư mục Drive chung */
  async driveList(req: AuthenticatedRequest, res: Response) {
    try {
      const files = await resourceDriveService.list(getCompanyCode(req));
      return res.json({ success: true, files });
    } catch (error) {
      return sendError(res, error, "driveList");
    }
  },

  /** POST /api/v1/resources/drive/upload — upload file trực tiếp vào thư mục Drive chung */
  async driveUpload(req: AuthenticatedRequest, res: Response) {
    try {
      const { file, name, mimeType } = req.body as { file: string; name: string; mimeType?: string };
      const base64 = String(file).replace(/^data:[^;]+;base64,/, "");
      const buffer = Buffer.from(base64, "base64");
      const uploaded = await resourceDriveService.upload(getCompanyCode(req), {
        name,
        mimeType: mimeType || "application/octet-stream",
        buffer,
      });
      return res.status(201).json({ success: true, file: uploaded });
    } catch (error) {
      return sendError(res, error, "driveUpload");
    }
  },

  /** DELETE /api/v1/resources/drive/files/:fileId — xóa file khỏi thư mục Drive chung */
  async driveDelete(req: AuthenticatedRequest, res: Response) {
    try {
      await resourceDriveService.delete(getCompanyCode(req), req.params.fileId);
      return res.json({ success: true });
    } catch (error) {
      return sendError(res, error, "driveDelete");
    }
  },
};
