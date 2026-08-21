/**
 * Google Drive Service
 * ────────────────────
 * Gọi Drive REST API v3 với access token (lấy từ OAuth per-company — xem google-oauth.service).
 * Dùng scope drive.file: app chỉ thao tác trên file/thư mục do chính app tạo.
 */

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  webViewLink?: string;
  webContentLink?: string;
  iconLink?: string;
  thumbnailLink?: string;
  modifiedTime?: string;
}

const FILE_FIELDS = "id,name,mimeType,size,webViewLink,webContentLink,iconLink,thumbnailLink,modifiedTime";

export const googleDriveService = {
  /** Tạo thư mục mới trong Drive (parent tùy chọn). Trả về id + webViewLink. */
  async createFolder(accessToken: string, name: string, parentId?: string): Promise<DriveFile> {
    const metadata: Record<string, any> = { name, mimeType: "application/vnd.google-apps.folder" };
    if (parentId) metadata.parents = [parentId];

    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=${encodeURIComponent(FILE_FIELDS)}`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(metadata),
      }
    );
    if (!res.ok) throw translateDriveError(res.status, await res.text());
    return (await res.json()) as DriveFile;
  },

  /** Upload buffer vào thư mục Drive (multipart). */
  async uploadToFolder(
    accessToken: string,
    folderId: string,
    file: { name: string; mimeType: string; buffer: Buffer }
  ): Promise<DriveFile> {
    const boundary = "igenerp_boundary_" + Date.now();
    const metadata = { name: file.name, parents: [folderId] };

    const preamble =
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: ${file.mimeType || "application/octet-stream"}\r\n\r\n`;
    const epilogue = `\r\n--${boundary}--`;

    const body = Buffer.concat([
      Buffer.from(preamble, "utf8"),
      file.buffer,
      Buffer.from(epilogue, "utf8"),
    ]);

    const url =
      `https://www.googleapis.com/upload/drive/v3/files` +
      `?uploadType=multipart&supportsAllDrives=true&fields=${encodeURIComponent(FILE_FIELDS)}`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    });
    if (!res.ok) throw translateDriveError(res.status, await res.text());
    return (await res.json()) as DriveFile;
  },

  /** Liệt kê file trong thư mục Drive. */
  async listFolder(accessToken: string, folderId: string): Promise<DriveFile[]> {
    const q = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
    const url =
      `https://www.googleapis.com/drive/v3/files` +
      `?q=${q}&orderBy=folder,name` +
      `&fields=${encodeURIComponent(`files(${FILE_FIELDS})`)}` +
      `&pageSize=200&supportsAllDrives=true&includeItemsFromAllDrives=true`;

    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) throw translateDriveError(res.status, await res.text());
    const data = (await res.json()) as { files?: DriveFile[] };
    return data.files || [];
  },

  async downloadFile(accessToken: string, fileId: string): Promise<Buffer> {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) throw translateDriveError(res.status, await res.text());
    return Buffer.from(await res.arrayBuffer());
  },

  async exportFile(accessToken: string, fileId: string, mimeType: string): Promise<Buffer> {
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=${encodeURIComponent(mimeType)}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) throw translateDriveError(res.status, await res.text());
    return Buffer.from(await res.arrayBuffer());
  },

  /** Xóa (vào thùng rác) một file trong Drive. */
  async deleteFile(accessToken: string, fileId: string): Promise<void> {
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}?supportsAllDrives=true`;
    const res = await fetch(url, { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok && res.status !== 204) throw translateDriveError(res.status, await res.text());
  },
};

/** Chuyển lỗi Drive API sang thông báo tiếng Việt dễ hiểu. */
function translateDriveError(status: number, errText: string): Error {
  let reason = errText;
  try {
    const parsed = JSON.parse(errText);
    reason = parsed?.error?.message || errText;
  } catch {
    /* giữ nguyên text */
  }

  if (status === 401) {
    return new Error("Phiên Google Drive đã hết hạn. Vui lòng kết nối lại Google Drive trong Cài đặt.");
  }
  if (status === 404) {
    return new Error("Không tìm thấy thư mục/tệp trên Google Drive. Thử kết nối lại Google Drive.");
  }
  if (status === 403) {
    return new Error(`Google Drive từ chối thao tác: ${reason}`);
  }
  return new Error(`Lỗi Google Drive API (${status}): ${reason}`);
}
