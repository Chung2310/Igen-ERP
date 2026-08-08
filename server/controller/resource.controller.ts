import { Response } from "express";
import mongoose from "mongoose";
import { AuthenticatedRequest, getEffectivePermissions } from "../middleware/auth";
import { resourceService, resourceDriveService } from "../service/resource.service";
import {
  assertResourceReadable,
  filterReadableResourceItems,
  type ResourceAccessContext,
} from "../service/resource-access.service";
import { resourceFileAccessService } from "../service/resource-file-access.service";

interface ZipFileItem {
  name: string;
  url: string;
  relativePath: string;
}

async function getAllLocalFiles(companyCode: string, folderId: string, access: ResourceAccessContext, relativePath: string = ""): Promise<ZipFileItem[]> {
  const { ResourceItemModel } = await import("../model/resource-item.model");
  const items = await ResourceItemModel.find({
    companyCode,
    parentId: folderId,
    isDeleted: { $ne: true }
  }).lean();

  let files: ZipFileItem[] = [];
  for (const rawItem of filterReadableResourceItems(items, access)) {
    const item = resourceFileAccessService.withReadableFileUrl(rawItem);
    if (item.type === "folder") {
      const childFiles = await getAllLocalFiles(companyCode, String(item._id), access, `${relativePath}${item.name}/`);
      files = files.concat(childFiles);
    } else if (item.type === "file" && item.fileUrl) {
      files.push({
        name: item.name,
        url: item.fileUrl,
        relativePath: `${relativePath}${item.name}`
      });
    }
  }
  return files;
}

async function getGoogleDriveFilesRecursive(drive: any, folderId: string, relativePath: string = ""): Promise<any[]> {
  const response = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: "files(id, name, mimeType, size)",
  });
  const files = response.data.files || [];
  let result: any[] = [];
  for (const file of files) {
    if (file.mimeType === "application/vnd.google-apps.folder") {
      const childFiles = await getGoogleDriveFilesRecursive(drive, file.id, `${relativePath}${file.name}/`);
      result = result.concat(childFiles);
    } else {
      result.push({
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        relativePath: `${relativePath}${file.name}`,
        size: file.size ? parseInt(file.size, 10) : 0
      });
    }
  }
  return result;
}

function getCompanyCode(req: AuthenticatedRequest): string {
  return req.user?.companyCode || "SYSTEM";
}

function getCreator(req: AuthenticatedRequest) {
  return { uid: req.user?.id, name: req.user?.email };
}

async function getResourceAccessContext(req: AuthenticatedRequest): Promise<ResourceAccessContext> {
  if (!req.user) throw new Error("Người dùng chưa xác thực.");
  const companyCode = getCompanyCode(req);
  const permissions = await getEffectivePermissions(req.user.id, req.user.role, req.user.companyCode);
  return {
    companyCode,
    branchId: req.user.branchId,
    userId: req.user.id,
    role: req.user.role,
    permissions,
  };
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

      const access = await getResourceAccessContext(req);
      const items = await resourceService.list(getCompanyCode(req), section, parentId, targetOwnerId, roomId, req.user?.id, access);
      return res.json({
        success: true,
        items: items.map((item: any) => resourceFileAccessService.withReadableFileUrl(item)),
      });
    } catch (error) {
      return sendError(res, error, "list");
    }
  },

  /** GET /api/v1/resources/:id */
  async getDetail(req: AuthenticatedRequest, res: Response) {
    try {
      const { ResourceItemModel } = await import("../model/resource-item.model");
      const item = await ResourceItemModel.findOne({ _id: req.params.id, companyCode: getCompanyCode(req) }).lean();
      if (!item) {
        return res.status(404).json({ success: false, message: "Không tìm thấy tài nguyên." });
      }
      assertResourceReadable(item, await getResourceAccessContext(req));
      return res.json({ success: true, item: resourceFileAccessService.withReadableFileUrl(item) });
    } catch (error) {
      return sendError(res, error, "getDetail");
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

      const trail = await resourceService.breadcrumb(getCompanyCode(req), req.params.id, targetOwnerId, roomId, await getResourceAccessContext(req));
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

      const items = await resourceService.listTrash(companyCode, targetOwnerId, userRole, roomId, await getResourceAccessContext(req));
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

  /** GET /api/v1/resources/:id/download-zip */
  async downloadZip(req: AuthenticatedRequest, res: Response) {
    try {
      const companyCode = getCompanyCode(req);
      const { id } = req.params; // MongoDB ObjectId or Google Drive folder ID
      const userId = req.user?.id;
      const selectedSpace = req.query.space as string || "personal";

      const AdmZip = (await import("adm-zip")).default;
      const zip = new AdmZip();

      // Check if it's Google Drive folder ID (i.e. not a 24-char hex ObjectId)
      const isDriveFolder = !mongoose.Types.ObjectId.isValid(id);

      let zipFilename = "folder-download.zip";

      if (isDriveFolder) {
        if (!userId) {
          return res.status(401).json({ success: false, message: "Unauthorized." });
        }
        const { GoogleDriveService } = await import("../service/personal-google-drive.service");
        const { CompanyModel } = await import("../model/company.model");
        const { google } = await import("googleapis");
        
        let authClient;
        if (selectedSpace === "personal") {
          authClient = await GoogleDriveService.getClientForUser(userId);
        } else {
          // Group space -> use company drive
          const company = await CompanyModel.findOne({ code: companyCode });
          if (!company || !company.driveOAuth?.refreshToken) {
            throw new Error("Doanh nghiệp chưa kết nối Google Drive.");
          }
          const { googleOAuthService } = await import("../service/google-oauth.service");
          const accessToken = await googleOAuthService.getAccessToken(company.driveOAuth.refreshToken);
          const oauth2Client = new google.auth.OAuth2();
          oauth2Client.setCredentials({ access_token: accessToken });
          authClient = oauth2Client;
        }

        const drive = google.drive({ version: "v3", auth: authClient });

        // Get folder name
        const folderMeta = await drive.files.get({ fileId: id, fields: "name" });
        if (folderMeta.data.name) {
          zipFilename = `${folderMeta.data.name}.zip`;
        }

        // Fetch all files recursively
        const driveFiles = await getGoogleDriveFilesRecursive(drive, id);
        
        for (const file of driveFiles) {
          try {
            let buffer: Buffer;
            let filename = file.relativePath;
            if (file.mimeType.startsWith("application/vnd.google-apps.")) {
              let exportMime = "application/pdf";
              let ext = ".pdf";
              if (file.mimeType === "application/vnd.google-apps.document") {
                exportMime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
                ext = ".docx";
              } else if (file.mimeType === "application/vnd.google-apps.spreadsheet") {
                exportMime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
                ext = ".xlsx";
              } else if (file.mimeType === "application/vnd.google-apps.presentation") {
                exportMime = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
                ext = ".pptx";
              }
              const exportRes = await drive.files.export(
                { fileId: file.id, mimeType: exportMime },
                { responseType: "arraybuffer" }
              );
              buffer = Buffer.from(exportRes.data as any);
              // Add extension if not already present
              if (!filename.toLowerCase().endsWith(ext)) {
                filename += ext;
              }
            } else {
              const downloadRes = await drive.files.get(
                { fileId: file.id, alt: "media" },
                { responseType: "arraybuffer" }
              );
              buffer = Buffer.from(downloadRes.data as any);
            }
            zip.addFile(filename, buffer);
          } catch (fileErr) {
            console.error(`Failed to download/export drive file ${file.id} (${file.name}):`, fileErr);
          }
        }
      } else {
        // Local Folder zipping
        const { ResourceItemModel } = await import("../model/resource-item.model");
        const folder = await ResourceItemModel.findOne({ _id: id, companyCode }).lean();
        if (!folder || folder.type !== "folder") {
          return res.status(404).json({ success: false, message: "Không tìm thấy thư mục." });
        }
        const access = await getResourceAccessContext(req);
        assertResourceReadable(folder, access);
        zipFilename = `${folder.name}.zip`;

        const localFiles = await getAllLocalFiles(companyCode, id, access);
        for (const file of localFiles) {
          try {
            const fetchRes = await fetch(file.url);
            if (fetchRes.ok) {
              const arrayBuf = await fetchRes.arrayBuffer();
              zip.addFile(file.relativePath, Buffer.from(arrayBuf));
            }
          } catch (fileErr) {
            console.error(`Failed to download local file from Cloudinary ${file.url}:`, fileErr);
          }
        }
      }

      const zipBuffer = zip.toBuffer();
      res.setHeader("Content-Type", "application/zip");
      const asciiFallback = zipFilename.replace(/["\\]/g, "").replace(/[^\x20-\x7E]/g, "_");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(zipFilename)}`
      );
      return res.send(zipBuffer);
    } catch (error) {
      return sendError(res, error, "downloadZip");
    }
  }
};
