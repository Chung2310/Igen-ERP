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
      const roomId = (req.query.roomId as string) || null;
      
      let targetOwnerId = req.user?.id;
      const userRole = req.user?.role;
      if ((userRole === "admin" || userRole === "superadmin") && req.query.ownerId) {
        targetOwnerId = req.query.ownerId as string;
      }

      const items = await resourceService.list(getCompanyCode(req), section, parentId, targetOwnerId, roomId, req.user?.id);
      return res.json({ success: true, items });
    } catch (error) {
      return sendError(res, error, "list");
    }
  },

  /** GET /api/v1/resources/breadcrumb/:id */
  async breadcrumb(req: AuthenticatedRequest, res: Response) {
    try {
      const roomId = (req.query.roomId as string) || null;
      let targetOwnerId = req.user?.id;
      const userRole = req.user?.role;
      if ((userRole === "admin" || userRole === "superadmin") && req.query.ownerId) {
        targetOwnerId = req.query.ownerId as string;
      }

      const trail = await resourceService.breadcrumb(getCompanyCode(req), req.params.id, targetOwnerId, roomId);
      return res.json({ success: true, trail });
    } catch (error) {
      return sendError(res, error, "breadcrumb");
    }
  },

  /** POST /api/v1/resources/folder */
  async createFolder(req: AuthenticatedRequest, res: Response) {
    try {
      const { name, parentId, section, ownerId, roomId } = req.body;
      
      let targetCreator = getCreator(req);
      if ((req.user?.role === "admin" || req.user?.role === "superadmin") && ownerId) {
        const { UserModel } = await import("../model/user.model");
        const targetUser = await UserModel.findById(ownerId).lean();
        if (targetUser) {
          targetCreator = { uid: String(targetUser._id), name: targetUser.email };
        }
      }

      const item = await resourceService.createFolder(
        getCompanyCode(req),
        { name, parentId, section, roomId },
        targetCreator
      );
      return res.status(201).json({ success: true, item });
    } catch (error) {
      return sendError(res, error, "createFolder");
    }
  },

  /** POST /api/v1/resources/file */
  async createFile(req: AuthenticatedRequest, res: Response) {
    try {
      const { name, fileUrl, parentId, mimeType, size, ownerId, roomId } = req.body;
      
      let targetCreator = getCreator(req);
      if ((req.user?.role === "admin" || req.user?.role === "superadmin") && ownerId) {
        const { UserModel } = await import("../model/user.model");
        const targetUser = await UserModel.findById(ownerId).lean();
        if (targetUser) {
          targetCreator = { uid: String(targetUser._id), name: targetUser.email };
        }
      }

      const item = await resourceService.createFile(
        getCompanyCode(req),
        { name, fileUrl, parentId, mimeType, size, roomId },
        targetCreator
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
      const item = await resourceService.rename(
        getCompanyCode(req),
        req.params.id,
        req.body.name,
        req.user?.id,
        req.user?.role
      );
      return res.json({ success: true, item });
    } catch (error) {
      return sendError(res, error, "rename");
    }
  },

  /** DELETE /api/v1/resources/:id */
  async remove(req: AuthenticatedRequest, res: Response) {
    try {
      const companyCode = getCompanyCode(req);
      const { id } = req.params;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      const { ResourceItemModel } = await import("../model/resource-item.model");
      const item = await ResourceItemModel.findOne({ _id: id, companyCode }).lean();

      if (!item) {
        return res.status(404).json({ success: false, message: "Không tìm thấy tài nguyên." });
      }

      let result;
      if (item.isDeleted) {
        // Đã ở trong thùng rác -> Xóa vĩnh viễn
        result = await resourceService.removePermanently(companyCode, id, userId, userRole);
      } else {
        // Chưa ở trong thùng rác -> Di chuyển vào thùng rác (Soft delete)
        result = await resourceService.remove(companyCode, id, userId, userRole);
      }

      return res.json({ success: true, ...result });
    } catch (error) {
      return sendError(res, error, "remove");
    }
  },

  /** GET /api/v1/resources/trash */
  async trashList(req: AuthenticatedRequest, res: Response) {
    try {
      const companyCode = getCompanyCode(req);
      const userId = req.user?.id;
      const userRole = req.user?.role;
      const ownerId = req.query.ownerId as string;
      const roomId = req.query.roomId as string || null;

      let targetOwnerId = userId;
      if ((userRole === "admin" || userRole === "superadmin") && ownerId) {
        targetOwnerId = ownerId;
      }

      const items = await resourceService.listTrash(companyCode, targetOwnerId, userRole, roomId);
      return res.json({ success: true, items });
    } catch (error) {
      return sendError(res, error, "trashList");
    }
  },

  /** POST /api/v1/resources/:id/restore */
  async restore(req: AuthenticatedRequest, res: Response) {
    try {
      const companyCode = getCompanyCode(req);
      const { id } = req.params;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      const result = await resourceService.restore(companyCode, id, userId, userRole);
      return res.json({ success: true, ...result });
    } catch (error) {
      return sendError(res, error, "restore");
    }
  },

  /** PATCH /api/v1/resources/:id/move */
  async move(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { parentId, targetRoomId, targetOwnerId } = req.body;
      const companyCode = getCompanyCode(req);
      const userId = req.user?.id;
      const userRole = req.user?.role;

      const item = await resourceService.move(
        companyCode,
        id,
        parentId,
        userId,
        userRole,
        targetRoomId,
        targetOwnerId
      );
      return res.json({ success: true, item });
    } catch (error) {
      return sendError(res, error, "move");
    }
  },

  /** GET /api/v1/resources/:id/shares */
  async getShares(req: AuthenticatedRequest, res: Response) {
    try {
      const companyCode = getCompanyCode(req);
      const { id } = req.params;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      const shares = await resourceService.getShares(companyCode, id, userId, userRole);
      return res.json({ success: true, shares });
    } catch (error) {
      return sendError(res, error, "getShares");
    }
  },

  /** PUT /api/v1/resources/:id/shares */
  async updateShares(req: AuthenticatedRequest, res: Response) {
    try {
      const companyCode = getCompanyCode(req);
      const { id } = req.params;
      const shares = req.body;
      const userId = req.user?.id;
      const userRole = req.user?.role;

      const updatedShares = await resourceService.updateShares(
        companyCode,
        id,
        shares,
        userId,
        userRole
      );
      return res.json({ success: true, shares: updatedShares });
    } catch (error) {
      return sendError(res, error, "updateShares");
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
