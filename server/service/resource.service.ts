import mongoose from "mongoose";
import { ResourceItemModel, IResourceItem } from "../model/resource-item.model";
import { CompanyModel } from "../model/company.model";
import { googleDriveService, DriveFile } from "./google-drive.service";
import { googleOAuthService } from "./google-oauth.service";

export interface ResourceCreator {
  uid?: string;
  name?: string;
}

function isValidObjectId(id: string | null | undefined): boolean {
  return !!id && mongoose.Types.ObjectId.isValid(id);
}

export const resourceService = {
  /**
   * Liệt kê các mục trong một thư mục (folder trước, file sau, sắp theo tên).
   */
  async list(companyCode: string, section: "local" | "drive", parentId: string | null) {
    const normalizedParent = parentId && parentId !== "root" ? parentId : null;

    const items = await ResourceItemModel.find({
      companyCode,
      section,
      parentId: normalizedParent,
    })
      .sort({ type: 1, name: 1 }) // "file" > "folder" theo alphabet nên folder đứng trước
      .lean();

    return items;
  },

  /**
   * Đường dẫn breadcrumb từ gốc → thư mục hiện tại.
   */
  async breadcrumb(companyCode: string, folderId: string | null) {
    const trail: Array<{ _id: string; name: string }> = [];
    let currentId = folderId && folderId !== "root" ? folderId : null;
    const guard = new Set<string>();

    while (currentId && isValidObjectId(currentId)) {
      if (guard.has(currentId)) break; // chống lặp vô hạn
      guard.add(currentId);

      const folder: IResourceItem | null = await ResourceItemModel.findOne({
        _id: currentId,
        companyCode,
      }).lean();
      if (!folder) break;

      trail.unshift({ _id: String(folder._id), name: folder.name });
      currentId = folder.parentId;
    }

    return trail;
  },

  /**
   * Kiểm tra thư mục cha hợp lệ (tồn tại, cùng doanh nghiệp, cùng section, là folder).
   */
  async assertParent(companyCode: string, section: string, parentId: string | null) {
    if (!parentId || parentId === "root") return null;
    if (!isValidObjectId(parentId)) {
      throw new Error("Mã thư mục cha không hợp lệ.");
    }
    const parent = await ResourceItemModel.findOne({ _id: parentId, companyCode }).lean();
    if (!parent) throw new Error("Không tìm thấy thư mục cha.");
    if (parent.section !== section) throw new Error("Thư mục cha không thuộc cùng khu vực tài nguyên.");
    if (parent.type !== "folder") throw new Error("Chỉ có thể tạo mục bên trong thư mục.");
    return parentId;
  },

  /**
   * Tạo thư mục mới.
   */
  async createFolder(
    companyCode: string,
    input: { name: string; parentId?: string | null; section?: "local" | "drive" },
    creator: ResourceCreator
  ) {
    const section = input.section || "local";
    const parentId = await this.assertParent(companyCode, section, input.parentId ?? null);

    const item = await ResourceItemModel.create({
      companyCode,
      section,
      type: "folder",
      name: input.name.trim(),
      parentId,
      creatorUid: creator.uid || "",
      creatorName: creator.name || "",
    });
    return item.toObject();
  },

  /**
   * Tạo bản ghi file (đã upload lên Cloudinary từ trước, ở đây chỉ lưu metadata).
   */
  async createFile(
    companyCode: string,
    input: {
      name: string;
      fileUrl: string;
      parentId?: string | null;
      mimeType?: string;
      size?: number;
    },
    creator: ResourceCreator
  ) {
    const parentId = await this.assertParent(companyCode, "local", input.parentId ?? null);

    const item = await ResourceItemModel.create({
      companyCode,
      section: "local",
      type: "file",
      name: input.name.trim(),
      parentId,
      fileUrl: input.fileUrl,
      mimeType: input.mimeType || "",
      size: input.size || 0,
      creatorUid: creator.uid || "",
      creatorName: creator.name || "",
    });
    return item.toObject();
  },

  /**
   * Thêm một tài liệu Google Drive (link chia sẻ công khai).
   */
  async addDriveLink(
    companyCode: string,
    input: { name: string; driveLink: string; driveType?: IResourceItem["driveType"] },
    creator: ResourceCreator
  ) {
    const item = await ResourceItemModel.create({
      companyCode,
      section: "drive",
      type: "file",
      name: input.name.trim(),
      parentId: null,
      fileUrl: input.driveLink.trim(),
      driveType: input.driveType || detectDriveType(input.driveLink),
      creatorUid: creator.uid || "",
      creatorName: creator.name || "",
    });
    return item.toObject();
  },

  /**
   * Đổi tên một mục.
   */
  async rename(companyCode: string, id: string, name: string) {
    if (!isValidObjectId(id)) throw new Error("Mã tài nguyên không hợp lệ.");
    const updated = await ResourceItemModel.findOneAndUpdate(
      { _id: id, companyCode },
      { name: name.trim() },
      { new: true }
    ).lean();
    if (!updated) throw new Error("Không tìm thấy tài nguyên hoặc bạn không có quyền chỉnh sửa.");
    return updated;
  },

  /**
   * Xóa một mục. Nếu là thư mục thì xóa đệ quy toàn bộ con cháu.
   */
  async remove(companyCode: string, id: string) {
    if (!isValidObjectId(id)) throw new Error("Mã tài nguyên không hợp lệ.");
    const item = await ResourceItemModel.findOne({ _id: id, companyCode }).lean();
    if (!item) throw new Error("Không tìm thấy tài nguyên hoặc bạn không có quyền xóa.");

    let deletedCount = 0;

    if (item.type === "folder") {
      // Thu thập toàn bộ id con cháu theo BFS rồi xóa một lần
      const idsToDelete: string[] = [String(item._id)];
      const queue: string[] = [String(item._id)];

      while (queue.length > 0) {
        const parentId = queue.shift()!;
        const children = await ResourceItemModel.find({ companyCode, parentId }).select("_id type").lean();
        for (const child of children) {
          idsToDelete.push(String(child._id));
          if (child.type === "folder") queue.push(String(child._id));
        }
      }

      const result = await ResourceItemModel.deleteMany({ companyCode, _id: { $in: idsToDelete } });
      deletedCount = result.deletedCount || idsToDelete.length;
    } else {
      await ResourceItemModel.deleteOne({ _id: id, companyCode });
      deletedCount = 1;
    }

    return { deletedCount };
  },
};

/**
 * ─── Google Drive per-company (OAuth, upload thẳng vào Drive của công ty) ───
 */
export const resourceDriveService = {
  /**
   * Đảm bảo công ty đã kết nối Drive + có thư mục chứa tài liệu (tự tạo nếu chưa).
   * Trả về access token và folderId để thao tác.
   */
  async ensureCompanyDrive(companyCode: string): Promise<{ accessToken: string; folderId: string }> {
    const normalized = String(companyCode || "").trim().toUpperCase();
    const company = await CompanyModel.findOne({ code: normalized });
    if (!company || !company.driveOAuth?.refreshToken) {
      throw new Error("Doanh nghiệp chưa kết nối Google Drive. Vui lòng vào Cài đặt để kết nối.");
    }

    const accessToken = await googleOAuthService.getAccessToken(company.driveOAuth.refreshToken);

    // Tạo thư mục riêng của công ty nếu chưa có
    if (!company.driveFolderId) {
      const folder = await googleDriveService.createFolder(
        accessToken,
        `iGen ERP - Tài liệu ${company.name || company.code}`
      );
      company.driveFolderId = folder.id;
      company.driveFolderLink = folder.webViewLink || "";
      await company.save();
    }

    return { accessToken, folderId: company.driveFolderId };
  },

  async list(companyCode: string): Promise<DriveFile[]> {
    const { accessToken, folderId } = await this.ensureCompanyDrive(companyCode);
    return googleDriveService.listFolder(accessToken, folderId);
  },

  async upload(companyCode: string, file: { name: string; mimeType: string; buffer: Buffer }): Promise<DriveFile> {
    const { accessToken, folderId } = await this.ensureCompanyDrive(companyCode);
    return googleDriveService.uploadToFolder(accessToken, folderId, file);
  },

  async delete(companyCode: string, fileId: string): Promise<void> {
    const { accessToken } = await this.ensureCompanyDrive(companyCode);
    return googleDriveService.deleteFile(accessToken, fileId);
  },
};

/**
 * Đoán loại tài liệu Google Drive từ link để chọn icon phù hợp.
 */
function detectDriveType(link: string): IResourceItem["driveType"] {
  const l = link.toLowerCase();
  if (l.includes("/document/")) return "document";
  if (l.includes("/spreadsheets/")) return "spreadsheet";
  if (l.includes("/presentation/")) return "presentation";
  if (l.includes("/folders/") || l.includes("/drive/folders/")) return "folder";
  if (l.includes(".pdf")) return "pdf";
  return "file";
}
