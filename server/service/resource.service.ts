import mongoose from "mongoose";
import { ResourceItemModel, IResourceItem } from "../model/resource-item.model";
import { CompanyModel } from "../model/company.model";
import { googleDriveService, DriveFile } from "./google-drive.service";
import { googleOAuthService } from "./google-oauth.service";
import {
  assertResourceMutable,
  assertResourceReadable,
  filterReadableResourceItems,
  type ResourceAccessContext,
} from "./resource-access.service";

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
  async list(companyCode: string, section: "local" | "drive", parentId: string | null, userId?: string, roomId?: string | null, requesterId?: string, accessContext?: ResourceAccessContext) {
    console.log('[DEBUG resourceService.list] INPUTS:', { companyCode, section, parentId, userId, roomId, requesterId });
    const normalizedParent = parentId && parentId !== "root" ? parentId : null;



    if (section === "local" && !normalizedParent) {
      const fixedFolderName = "_GOOGLE DOCUMENTS";
      let fixedFolder = await ResourceItemModel.findOne({
        companyCode,
        section: "local",
        parentId: null,
        name: fixedFolderName,
        type: "folder",
      });

      if (!fixedFolder) {
        await ResourceItemModel.create({
          companyCode,
          section: "local",
          type: "folder",
          name: fixedFolderName,
          parentId: null,
          isFixed: true,
          creatorUid: "system",
          creatorName: "Hệ thống",
        });
      } else if (!fixedFolder.isFixed) {
        await ResourceItemModel.updateOne({ _id: fixedFolder._id }, { $set: { isFixed: true } });
      }
    }

    let isFetchingGoogleDrive = false;
    let driveFolderId = "";

    if (section === "local" && normalizedParent) {
      if (!isValidObjectId(normalizedParent)) {
        isFetchingGoogleDrive = true;
        driveFolderId = normalizedParent;
      } else {
        const parentFolder = await ResourceItemModel.findOne({ _id: normalizedParent, companyCode }).lean();
        if (parentFolder && parentFolder.isFixed && parentFolder.name === "_GOOGLE DOCUMENTS") {
          isFetchingGoogleDrive = true;
          driveFolderId = "root";
        }
      }
    }

    if (isFetchingGoogleDrive && userId) {
      const { UserModel } = await import("../model/user.model");
      const { GoogleDriveService } = await import("./personal-google-drive.service");
      const { google } = await import("googleapis");

      const user = await UserModel.findById(userId);
      if (user && user.googleDriveIntegration?.isConnected) {
        try {
          const authClient = await GoogleDriveService.getClientForUser(userId);
          const drive = google.drive({ version: "v3", auth: authClient });

          let targetFolderId = driveFolderId;
          if (targetFolderId === "root") {
            targetFolderId = user.googleDriveIntegration.rootFolderId;
          }

          const response = await drive.files.list({
            q: `'${targetFolderId}' in parents and trashed = false`,
            fields: "files(id, name, mimeType, webViewLink, size, createdTime)",
            orderBy: "folder,name",
          });

          const files = response.data.files || [];
          return files.map((file: any) => {
            const isFolder = file.mimeType === "application/vnd.google-apps.folder";
            return {
              _id: file.id,
              companyCode,
              section: "local",
              type: isFolder ? "folder" : "file",
              name: file.name,
              parentId: parentId,
              fileUrl: file.webViewLink || "",
              mimeType: file.mimeType || "",
              size: file.size ? parseInt(file.size, 10) : 0,
              createdAt: file.createdTime || new Date(),
              updatedAt: file.createdTime || new Date(),
            };
          });
        } catch (err: any) {
          console.error("[resourceService.list] Failed to fetch Google Drive files:", err.message);
          return [];
        }
      }
    }

    const baseQuery: any = {
      companyCode,
      section,
      parentId: normalizedParent,
      isDeleted: { $ne: true },
    };

    // Ở không gian cá nhân (không có roomId), dùng $or để gộp:
    // - Tài nguyên do chính user tạo
    // - Tài nguyên được người khác chia sẻ cho user này (requester)
    if (section === "local") {
      if (roomId) {
        baseQuery.roomId = roomId;
      } else if (userId) {
        const effectiveRequesterId = requesterId || userId;
        // Nếu đang xem không gian của chính mình, bổ sung các item được chia sẻ
        if (userId === effectiveRequesterId) {
          baseQuery.$or = [
            { creatorUid: userId, roomId: null },
            { "shares.targetId": effectiveRequesterId, "shares.targetType": "user", roomId: null },
            { managedType: "system", roomId: null },
          ];
        } else {
          // Đang xem không gian của người khác (admin view), chỉ lấy item của họ
          baseQuery.creatorUid = userId;
          baseQuery.roomId = null;
        }
      }
    }

    console.log('[DEBUG resourceService.list] QUERY:', JSON.stringify(baseQuery, null, 2));
    const rawItems = await ResourceItemModel.find(baseQuery)
      .sort({ type: 1, name: 1 }) // "file" > "folder" theo alphabet nên folder đứng trước
      .lean();

    // Đánh dấu item nào là được chia sẻ (không phải do user tạo)
    const effectiveRequesterId = requesterId || userId;
    const mappedItems: any[] = rawItems.map(item => {
      const isShared = item.creatorUid !== effectiveRequesterId &&
        Array.isArray(item.shares) &&
        item.shares.some((s: any) => s.targetId === effectiveRequesterId && s.targetType === "user");
      return isShared ? { ...item, isShared: true } : item;
    });
    const items = accessContext
      ? filterReadableResourceItems(mappedItems, accessContext)
      : mappedItems;

    console.log('[DEBUG resourceService.list] RESULT length:', items.length, 'names:', items.map((i: any) => i.name));

    if (section === "local" && !normalizedParent && roomId) {
      const { ChatMessageModel } = await import("../model/chat-message.model");
      const messages = await ChatMessageModel.find({ roomId, isDeleted: { $ne: true } })
        .sort({ createdAt: -1 })
        .lean();
      
      const virtualItems: any[] = [];
      let uniqueIndex = 1;
      
      for (const msg of messages) {
        if (msg.content) {
          const urlRegex = /(https?:\/\/[^\s]+)/g;
          const urls = msg.content.match(urlRegex);
          if (urls) {
            for (const url of urls) {
              const cleanUrl = url.replace(/[.,;:!?)]+$/, "");
              virtualItems.push({
                _id: `chat-link-${msg._id}-${uniqueIndex++}`,
                companyCode,
                section: "local",
                type: "file",
                name: `Liên kết từ ${msg.senderName}`,
                parentId: null,
                fileUrl: cleanUrl,
                mimeType: "link",
                size: 0,
                creatorUid: String(msg.senderId),
                creatorName: msg.senderName,
                isFixed: true,
                createdAt: msg.createdAt,
                updatedAt: msg.createdAt,
              });
            }
          }
        }
      }
      
      const merged = [...items, ...virtualItems];
      merged.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === "folder" ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });
      return merged;
    }

    return items;
  },

  /**
   * Đường dẫn breadcrumb từ gốc → thư mục hiện tại.
   */
  async breadcrumb(companyCode: string, folderId: string | null, userId?: string, roomId?: string | null, accessContext?: ResourceAccessContext) {

    const trail: Array<{ _id: string; name: string; isFixed?: boolean }> = [];
    let currentId = folderId && folderId !== "root" ? folderId : null;
    const guard = new Set<string>();

    if (currentId && !isValidObjectId(currentId) && userId) {
      const { UserModel } = await import("../model/user.model");
      const { GoogleDriveService } = await import("./personal-google-drive.service");
      const { google } = await import("googleapis");

      const user = await UserModel.findById(userId);
      if (user && user.googleDriveIntegration?.isConnected) {
        try {
          const authClient = await GoogleDriveService.getClientForUser(userId);
          const drive = google.drive({ version: "v3", auth: authClient });

          while (currentId && currentId !== user.googleDriveIntegration.rootFolderId) {
            if (guard.has(currentId)) break;
            guard.add(currentId);

            const file = await drive.files.get({
              fileId: currentId,
              fields: "id, name, parents",
            });
            if (!file.data.id) break;

            trail.unshift({ _id: file.data.id, name: file.data.name || "" });
            currentId = file.data.parents?.[0] || null;
          }
        } catch (err) {
          console.error("[resourceService.breadcrumb] Google Drive error:", err);
        }
      }

      const fixedFolder = await ResourceItemModel.findOne({
        companyCode,
        section: "local",
        parentId: null,
        name: "_GOOGLE DOCUMENTS",
        type: "folder",
      });
      if (fixedFolder) {
        trail.unshift({ _id: String(fixedFolder._id), name: fixedFolder.name, isFixed: true });
      }
      return trail;
    }

    while (currentId && isValidObjectId(currentId)) {
      if (guard.has(currentId)) break; // chống lặp vô hạn
      guard.add(currentId);

      const folder: IResourceItem | null = await ResourceItemModel.findOne({
        _id: currentId,
        companyCode,
      }).lean();
      if (!folder) break;
      if (accessContext) assertResourceReadable(folder, accessContext);

      trail.unshift({ _id: String(folder._id), name: folder.name, isFixed: folder.isFixed });
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
    assertResourceMutable(parent);
    return parentId;
  },

  /**
   * Tạo thư mục mới.
   */
  async createFolder(
    companyCode: string,
    input: { name: string; parentId?: string | null; section?: "local" | "drive"; roomId?: string | null },
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
      roomId: input.roomId || null,
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
      roomId?: string | null;
    },
    creator: ResourceCreator
  ) {
    let parentId = input.parentId ?? null;
    if (parentId === "google-documents") {
      let fixedFolder = await ResourceItemModel.findOne({
        companyCode,
        section: "local",
        parentId: null,
        name: "_GOOGLE DOCUMENTS",
        type: "folder"
      });
      if (!fixedFolder) {
        fixedFolder = await ResourceItemModel.create({
          companyCode,
          section: "local",
          type: "folder",
          name: "_GOOGLE DOCUMENTS",
          parentId: null,
          isFixed: true,
          creatorUid: "system",
          creatorName: "Hệ thống",
        });
      }
      parentId = String(fixedFolder._id);
    } else {
      parentId = await this.assertParent(companyCode, "local", parentId);
    }

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
      roomId: input.roomId || null,
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
  async rename(companyCode: string, id: string, name: string, userId?: string, userRole?: string) {
    if (!isValidObjectId(id)) throw new Error("Mã tài nguyên không hợp lệ.");
    
    const query: any = { _id: id, companyCode };
    const isAdmin = userRole === "admin" || userRole === "superadmin";
    if (!isAdmin && userId) {
      query.creatorUid = userId;
    }

    const item = await ResourceItemModel.findOne(query).lean();
    if (!item) throw new Error("Không tìm thấy tài nguyên hoặc bạn không có quyền chỉnh sửa.");
    assertResourceMutable(item);
    if (item.isFixed) {
      throw new Error("Không thể đổi tên thư mục hệ thống cố định.");
    }

    const updated = await ResourceItemModel.findOneAndUpdate(
      { _id: id, companyCode, isFixed: { $ne: true } },
      { name: name.trim() },
      { new: true }
    ).lean();
    if (!updated) throw new Error("Không tìm thấy tài nguyên hoặc bạn không có quyền chỉnh sửa.");
    return updated;
  },

  /**
   * Di chuyển mục vào Thùng rác (Soft delete). Nếu là thư mục thì di chuyển cả con cháu.
   */
  async remove(companyCode: string, id: string, userId?: string, userRole?: string) {
    if (!isValidObjectId(id)) throw new Error("Mã tài nguyên không hợp lệ.");
    
    const query: any = { _id: id, companyCode, isDeleted: { $ne: true } };
    const isAdmin = userRole === "admin" || userRole === "superadmin";
    if (!isAdmin && userId) {
      query.creatorUid = userId;
    }

    const item = await ResourceItemModel.findOne(query).lean();
    if (!item) throw new Error("Không tìm thấy tài nguyên hoặc bạn không có quyền xóa.");
    assertResourceMutable(item);
    if (item.isFixed) {
      throw new Error("Không thể xóa thư mục hệ thống cố định.");
    }

    let deletedCount = 0;
    const now = new Date();

    if (item.type === "folder") {
      // Thu thập toàn bộ id con cháu để đưa tất cả vào Thùng rác
      const idsToDelete: string[] = [String(item._id)];
      const queue: string[] = [String(item._id)];

      while (queue.length > 0) {
        const parentId = queue.shift()!;
        const children = await ResourceItemModel.find({ companyCode, parentId, isDeleted: { $ne: true } }).select("_id type").lean();
        for (const child of children) {
          idsToDelete.push(String(child._id));
          if (child.type === "folder") queue.push(String(child._id));
        }
      }

      const result = await ResourceItemModel.updateMany(
        { companyCode, _id: { $in: idsToDelete } },
        { $set: { isDeleted: true, deletedAt: now } }
      );
      deletedCount = result.modifiedCount || idsToDelete.length;
    } else {
      await ResourceItemModel.updateOne(
        { _id: id, companyCode },
        { $set: { isDeleted: true, deletedAt: now } }
      );
      deletedCount = 1;
    }

    return { deletedCount };
  },

  /**
   * Liệt kê các mục bị xóa trong Thùng rác.
   */
  async listTrash(companyCode: string, userId?: string, userRole?: string, roomId?: string | null, accessContext?: ResourceAccessContext) {
    const query: any = {
      companyCode,
      section: "local",
      isDeleted: true
    };

    if (roomId) {
      query.roomId = roomId;
    } else {
      query.roomId = null;
      const isAdmin = userRole === "admin" || userRole === "superadmin";
      if (!isAdmin && userId) {
        query.creatorUid = userId;
      }
    }

    const deletedItems = await ResourceItemModel.find(query).lean();
    const deletedIds = new Set(deletedItems.map(item => String(item._id)));

    // Chỉ hiển thị các thư mục/tệp gốc bị xóa (không hiển thị các tệp con thuộc thư mục đã bị xóa)
    const rootDeletedItems = deletedItems.filter(item => {
      if (!item.parentId) return true;
      return !deletedIds.has(String(item.parentId));
    });

    rootDeletedItems.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === "folder" ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    return accessContext
      ? filterReadableResourceItems(rootDeletedItems, accessContext)
      : rootDeletedItems;
  },

  /**
   * Khôi phục tài nguyên từ Thùng rác.
   */
  async restore(companyCode: string, id: string, userId?: string, userRole?: string) {
    if (!isValidObjectId(id)) throw new Error("Mã tài nguyên không hợp lệ.");

    const query: any = { _id: id, companyCode, isDeleted: true };
    const isAdmin = userRole === "admin" || userRole === "superadmin";
    if (!isAdmin && userId) {
      query.creatorUid = userId;
    }

    const item = await ResourceItemModel.findOne(query).lean();
    if (!item) throw new Error("Không tìm thấy tài nguyên trong Thùng rác.");
    assertResourceMutable(item);

    const idsToRestore: string[] = [String(item._id)];
    if (item.type === "folder") {
      // Thu thập toàn bộ con cháu đã bị xóa của thư mục này
      const queue: string[] = [String(item._id)];
      while (queue.length > 0) {
        const parentId = queue.shift()!;
        const children = await ResourceItemModel.find({ companyCode, parentId, isDeleted: true }).select("_id type").lean();
        for (const child of children) {
          idsToRestore.push(String(child._id));
          if (child.type === "folder") queue.push(String(child._id));
        }
      }
    }

    // Khôi phục bằng cách đặt isDeleted: false và unset deletedAt để ngừng đếm ngược xóa vĩnh viễn
    await ResourceItemModel.updateMany(
      { companyCode, _id: { $in: idsToRestore } },
      { $set: { isDeleted: false }, $unset: { deletedAt: 1 } }
    );

    return { restoredCount: idsToRestore.length };
  },

  /**
   * Xóa vĩnh viễn một mục khỏi cơ sở dữ liệu.
   */
  async removePermanently(companyCode: string, id: string, userId?: string, userRole?: string) {
    if (!isValidObjectId(id)) throw new Error("Mã tài nguyên không hợp lệ.");

    const query: any = { _id: id, companyCode, isDeleted: true };
    const isAdmin = userRole === "admin" || userRole === "superadmin";
    if (!isAdmin && userId) {
      query.creatorUid = userId;
    }

    const item = await ResourceItemModel.findOne(query).lean();
    if (!item) throw new Error("Không tìm thấy tài nguyên hoặc bạn không có quyền xóa vĩnh viễn.");
    assertResourceMutable(item);

    let deletedCount = 0;

    if (item.type === "folder") {
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

  /**
   * Di chuyển mục (file hoặc folder) tới thư mục khác.
   */
  async move(
    companyCode: string,
    id: string,
    targetParentId: string | null,
    userId?: string,
    userRole?: string,
    targetRoomId?: string | null,
    targetOwnerId?: string | null
  ) {
    if (!isValidObjectId(id)) throw new Error("Mã tài nguyên cần di chuyển không hợp lệ.");
    
    // 1. Tìm mục cần di chuyển
    const item = await ResourceItemModel.findOne({ _id: id, companyCode }).lean();
    if (!item) throw new Error("Không tìm thấy tài nguyên cần di chuyển.");
    assertResourceMutable(item);
    if (item.isFixed) throw new Error("Không thể di chuyển thư mục hệ thống cố định.");
    
    // Kiểm tra quyền (nếu không phải admin và không phải người tạo)
    const isAdmin = userRole === "admin" || userRole === "superadmin";
    if (!isAdmin && userId && item.creatorUid !== userId) {
      throw new Error("Bạn không có quyền di chuyển tài nguyên này.");
    }

    // 2. Chuẩn hóa parentId đích
    const normalizedParent = targetParentId && targetParentId !== "root" ? targetParentId : null;

    // 3. Nếu di chuyển vào chính nó hoặc con cháu của nó (nếu là folder)
    if (normalizedParent) {
      if (String(normalizedParent) === String(id)) {
        throw new Error("Không thể di chuyển thư mục vào chính nó.");
      }
      
      if (item.type === "folder") {
        let currentParentId = normalizedParent;
        const guard = new Set<string>();
        while (currentParentId) {
          if (guard.has(currentParentId)) break; // cycle guard
          guard.add(currentParentId);

          const p = await ResourceItemModel.findOne({ _id: currentParentId, companyCode }).lean();
          if (!p) break;
          if (String(p.parentId) === String(id)) {
            throw new Error("Không thể di chuyển thư mục vào thư mục con của nó.");
          }
          currentParentId = p.parentId;
        }
      }

      // Xác thực thư mục đích tồn tại và hợp lệ
      await this.assertParent(companyCode, item.section, normalizedParent);
    }

    // 4. Chuẩn hóa không gian đích (Target Space)
    const updateFields: any = { parentId: normalizedParent };
    
    if (targetRoomId) {
      // Di chuyển vào nhóm
      updateFields.roomId = targetRoomId;
    } else if (targetOwnerId) {
      // Di chuyển vào không gian cá nhân của user khác
      updateFields.roomId = null;
      updateFields.creatorUid = targetOwnerId;
    } else if (targetOwnerId === null && targetRoomId === null) {
      // Di chuyển về không gian cá nhân của chính mình
      updateFields.roomId = null;
      if (userId) {
        updateFields.creatorUid = userId;
      }
    }

    // 5. Thực hiện di chuyển mục hiện tại
    const updated = await ResourceItemModel.findOneAndUpdate(
      { _id: id, companyCode },
      { $set: updateFields },
      { new: true }
    ).lean();

    if (!updated) throw new Error("Di chuyển thất bại.");

    // 6. Nếu là thư mục, chúng ta cần di chuyển tất cả các mục con bên trong nó
    // sang cùng không gian đích (roomId, creatorUid)!
    if (item.type === "folder") {
      const childUpdateFields: any = {};
      if (targetRoomId) {
        childUpdateFields.roomId = targetRoomId;
      } else if (targetOwnerId) {
        childUpdateFields.roomId = null;
        childUpdateFields.creatorUid = targetOwnerId;
      } else if (targetOwnerId === null && targetRoomId === null) {
        childUpdateFields.roomId = null;
        if (userId) {
          childUpdateFields.creatorUid = userId;
        }
      }

      if (Object.keys(childUpdateFields).length > 0) {
        const queue: string[] = [String(item._id)];
        const allChildIds: string[] = [];

        while (queue.length > 0) {
          const parentId = queue.shift()!;
          const children = await ResourceItemModel.find({ companyCode, parentId }).select("_id type").lean();
          for (const child of children) {
            allChildIds.push(String(child._id));
            if (child.type === "folder") queue.push(String(child._id));
          }
        }

        if (allChildIds.length > 0) {
          await ResourceItemModel.updateMany(
            { companyCode, _id: { $in: allChildIds } },
            { $set: childUpdateFields }
          );
        }
      }
    }

    return updated;
  },

  async getShares(companyCode: string, id: string, userId?: string, userRole?: string) {
    if (!isValidObjectId(id)) throw new Error("Mã tài nguyên không hợp lệ.");
    const item = await ResourceItemModel.findOne({ _id: id, companyCode }).lean();
    if (!item) throw new Error("Không tìm thấy tài nguyên.");
    assertResourceMutable(item);

    // Quyền truy cập: Admin hoặc người tạo
    const isAdmin = userRole === "admin" || userRole === "superadmin";
    if (!isAdmin && userId && item.creatorUid !== userId) {
      throw new Error("Bạn không có quyền quản lý chia sẻ tài nguyên này.");
    }

    return item.shares || [];
  },

  async updateShares(
    companyCode: string,
    id: string,
    shares: Array<{ targetId: string; targetType: "user" | "room"; targetName: string }>,
    userId?: string,
    userRole?: string
  ) {
    if (!isValidObjectId(id)) throw new Error("Mã tài nguyên không hợp lệ.");
    const item = await ResourceItemModel.findOne({ _id: id, companyCode }).lean();
    if (!item) throw new Error("Không tìm thấy tài nguyên.");
    assertResourceMutable(item);

    const isAdmin = userRole === "admin" || userRole === "superadmin";
    if (!isAdmin && userId && item.creatorUid !== userId) {
      throw new Error("Bạn không có quyền quản lý chia sẻ tài nguyên này.");
    }

    const updated = await ResourceItemModel.findOneAndUpdate(
      { _id: id, companyCode },
      { $set: { shares } },
      { new: true }
    ).lean();

    if (!updated) throw new Error("Cập nhật cấu hình chia sẻ thất bại.");
    return updated.shares || [];
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
