import { getAccessToken } from "./authService";
import type { ResourceItem, ResourceSection, BreadcrumbEntry, DriveDocType, DriveApiFile } from "../types";

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function authHeaders(withJson = true): Record<string, string> {
  const headers: Record<string, string> = {};
  if (withJson) headers["Content-Type"] = "application/json";
  const token = getAccessToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

async function parseError(res: Response, fallback: string): Promise<never> {
  const data = await res.json().catch(() => ({}));
  const detail = data?.errors ? Object.values(data.errors).flat().join(" ") : "";
  throw new Error(data?.message || detail || fallback);
}

export const resourceService = {
  /** Liệt kê mục trong một thư mục (hoặc gốc). */
  async list(section: ResourceSection, parentId: string | null, ownerId?: string, roomId?: string): Promise<ResourceItem[]> {
    const params = new URLSearchParams({ section });
    if (parentId) params.set("parentId", parentId);
    if (ownerId) params.set("ownerId", ownerId);
    if (roomId) params.set("roomId", roomId);
    const res = await fetch(`/api/v1/resources?${params.toString()}`, {
      headers: authHeaders(false),
    });
    if (!res.ok) await parseError(res, "Không tải được danh sách tài nguyên.");
    const data = await res.json();
    return data.items as ResourceItem[];
  },

  /** Breadcrumb từ gốc tới thư mục hiện tại. */
  async breadcrumb(folderId: string, ownerId?: string, roomId?: string): Promise<BreadcrumbEntry[]> {
    const params = new URLSearchParams();
    if (ownerId) params.set("ownerId", ownerId);
    if (roomId) params.set("roomId", roomId);
    const res = await fetch(`/api/v1/resources/breadcrumb/${folderId}?${params.toString()}`, {
      headers: authHeaders(false),
    });
    if (!res.ok) await parseError(res, "Không tải được đường dẫn thư mục.");
    const data = await res.json();
    return data.trail as BreadcrumbEntry[];
  },

  /** Tạo thư mục mới. */
  async createFolder(name: string, parentId: string | null, section: ResourceSection = "local", ownerId?: string, roomId?: string): Promise<ResourceItem> {
    const res = await fetch("/api/v1/resources/folder", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ name, parentId, section, ownerId, roomId }),
    });
    if (!res.ok) await parseError(res, "Không tạo được thư mục.");
    return (await res.json()).item as ResourceItem;
  },

  /** Upload file lên Cloudinary rồi lưu metadata làm tài nguyên. */
  async uploadFile(file: File, parentId: string | null, ownerId?: string, roomId?: string): Promise<ResourceItem> {
    // 1. Đọc file thành base64 data URL
    const base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    // 2. Đẩy lên Cloudinary qua media relay có sẵn
    const uploadRes = await fetch("/api/v1/media/upload", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ file: base64Data, folder: "igen_erp/resources" }),
    });
    if (!uploadRes.ok) await parseError(uploadRes, "Tải file lên lưu trữ thất bại.");
    const { url } = await uploadRes.json();

    // 3. Lưu bản ghi tài nguyên
    const res = await fetch("/api/v1/resources/file", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        name: file.name,
        fileUrl: url,
        parentId,
        mimeType: file.type,
        size: file.size,
        ownerId,
        roomId,
      }),
    });
    if (!res.ok) await parseError(res, "Không lưu được thông tin file.");
    return (await res.json()).item as ResourceItem;
  },

  /** Thêm link tài liệu Google Drive. */
  async addDriveLink(name: string, driveLink: string, driveType?: DriveDocType): Promise<ResourceItem> {
    const res = await fetch("/api/v1/resources/drive", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ name, driveLink, driveType }),
    });
    if (!res.ok) await parseError(res, "Không thêm được tài liệu Google Drive.");
    return (await res.json()).item as ResourceItem;
  },

  /** Đổi tên mục. */
  async rename(id: string, name: string): Promise<ResourceItem> {
    const res = await fetch(`/api/v1/resources/${id}/rename`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ name }),
    });
    if (!res.ok) await parseError(res, "Không đổi tên được.");
    return (await res.json()).item as ResourceItem;
  },

  /** Di chuyển mục (file hoặc folder) tới thư mục khác và/hoặc không gian khác. */
  async move(id: string, targetParentId: string | null, targetRoomId?: string | null, targetOwnerId?: string | null): Promise<ResourceItem> {
    const res = await fetch(`/api/v1/resources/${id}/move`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ parentId: targetParentId, targetRoomId, targetOwnerId }),
    });
    if (!res.ok) await parseError(res, "Không di chuyển được tài nguyên.");
    return (await res.json()).item as ResourceItem;
  },

  /** Lấy danh sách chia sẻ của tài nguyên. */
  async getShares(id: string): Promise<Array<{ targetId: string; targetType: "user" | "room"; targetName: string }>> {
    const res = await fetch(`/api/v1/resources/${id}/shares`, {
      headers: authHeaders(false),
    });
    if (!res.ok) await parseError(res, "Không lấy được danh sách chia sẻ.");
    return (await res.json()).shares;
  },

  /** Cập nhật danh sách chia sẻ của tài nguyên. */
  async updateShares(id: string, shares: Array<{ targetId: string; targetType: "user" | "room"; targetName: string }>): Promise<Array<{ targetId: string; targetType: "user" | "room"; targetName: string }>> {
    const res = await fetch(`/api/v1/resources/${id}/shares`, {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify(shares),
    });
    if (!res.ok) await parseError(res, "Không cập nhật được chia sẻ.");
    return (await res.json()).shares;
  },

  /** Xóa mục (thư mục xóa đệ quy). */
  async remove(id: string): Promise<void> {
    const res = await fetch(`/api/v1/resources/${id}`, {
      method: "DELETE",
      headers: authHeaders(false),
    });
    if (!res.ok) await parseError(res, "Không xóa được tài nguyên.");
  },

  /** Liệt kê danh sách tài nguyên bị xóa trong Thùng rác. */
  async listTrash(ownerId?: string, roomId?: string): Promise<ResourceItem[]> {
    const params = new URLSearchParams();
    if (ownerId) params.set("ownerId", ownerId);
    if (roomId) params.set("roomId", roomId);
    const res = await fetch(`/api/v1/resources/trash?${params.toString()}`, {
      headers: authHeaders(false),
    });
    if (!res.ok) await parseError(res, "Không tải được danh sách thùng rác.");
    const data = await res.json();
    return data.items as ResourceItem[];
  },

  /** Khôi phục mục từ Thùng rác. */
  async restore(id: string): Promise<void> {
    const res = await fetch(`/api/v1/resources/${id}/restore`, {
      method: "POST",
      headers: authHeaders(false),
    });
    if (!res.ok) await parseError(res, "Không thể khôi phục tài nguyên.");
  },

  // ─── Google Drive dùng chung (upload trực tiếp qua Service Account) ───

  /** Liệt kê file trong thư mục Google Drive chung của công ty. */
  async listDriveFiles(): Promise<DriveApiFile[]> {
    const res = await fetch("/api/v1/resources/drive/files", { headers: authHeaders(false) });
    if (!res.ok) await parseError(res, "Không tải được danh sách file Google Drive.");
    return (await res.json()).files as DriveApiFile[];
  },

  /** Upload một file trực tiếp lên thư mục Google Drive chung. */
  async uploadToDrive(file: File): Promise<DriveApiFile> {
    const base64 = await readAsDataURL(file);
    const res = await fetch("/api/v1/resources/drive/upload", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ file: base64, name: file.name, mimeType: file.type }),
    });
    if (!res.ok) await parseError(res, "Tải file lên Google Drive thất bại.");
    return (await res.json()).file as DriveApiFile;
  },

  /** Xóa một file khỏi thư mục Google Drive chung. */
  async deleteDriveFile(fileId: string): Promise<void> {
    const res = await fetch(`/api/v1/resources/drive/files/${fileId}`, {
      method: "DELETE",
      headers: authHeaders(false),
    });
    if (!res.ok) await parseError(res, "Không xóa được file Google Drive.");
  },
};
