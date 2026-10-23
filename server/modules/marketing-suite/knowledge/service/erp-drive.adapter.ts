import { UserModel } from "../../../../model/user.model";

type DriveClient = { request<T>(options: { url: string; method?: "GET"; responseType?: "arraybuffer"; timeout?: number }): Promise<{ data: T }> };
type DriveMetadata = { id: string; name: string; mimeType: string; size?: string; trashed?: boolean };

export async function getErpKnowledgeDriveClient(userId: string, companyCode: string): Promise<DriveClient | undefined> {
  const user = await UserModel.findOne({ _id: userId, companyCode, disabledAt: null }).select("googleDriveIntegration.isConnected").lean();
  if (!user?.googleDriveIntegration?.isConnected) return undefined;
  const { GoogleDriveService } = await import("../../../../service/personal-google-drive.service");
  return GoogleDriveService.getClientForUser(userId);
}
export async function listErpKnowledgeDriveFiles(client: DriveClient, folderId: string) {
  if (!/^[\w-]{10,200}$/.test(folderId)) throw new Error("ID thư mục Drive không hợp lệ.");
  const query = new URLSearchParams({ q: `'${folderId}' in parents and trashed=false and mimeType!='application/vnd.google-apps.folder'`, fields: "files(id),nextPageToken", pageSize: "50", supportsAllDrives: "true", includeItemsFromAllDrives: "true" });
  const result = await client.request<{ files?: { id: string }[]; nextPageToken?: string }>({ url: `https://www.googleapis.com/drive/v3/files?${query}`, timeout: 30_000 });
  if (result.data.nextPageToken) throw new Error("Mỗi lần đồng bộ tối đa 50 tài liệu. Hãy chọn thư mục nhỏ hơn.");
  return (result.data.files || []).map((file) => file.id);
}
export async function readErpKnowledgeDriveFile(client: DriveClient, fileId: string) {
  if (!/^[\w-]{10,200}$/.test(fileId)) throw new Error("ID tài liệu Drive không hợp lệ.");
  const base = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`;
  const { data: meta } = await client.request<DriveMetadata>({ url: `${base}?fields=id,name,mimeType,size,trashed&supportsAllDrives=true`, timeout: 30_000 });
  if (meta.trashed || Number(meta.size || 0) > 25 * 1024 * 1024) throw new Error("Tài liệu Drive đã bị xóa hoặc vượt quá 25 MB.");
  const exports: Record<string, string> = {
    "application/vnd.google-apps.document": "text/plain",
    "application/vnd.google-apps.spreadsheet": "text/csv",
    "application/vnd.google-apps.presentation": "text/plain",
  };
  const mimeType = exports[meta.mimeType] || meta.mimeType;
  if (meta.mimeType.startsWith("application/vnd.google-apps.") && !exports[meta.mimeType]) throw new Error("Định dạng Drive này không được hỗ trợ.");
  const url = exports[meta.mimeType] ? `${base}/export?mimeType=${encodeURIComponent(mimeType)}` : `${base}?alt=media&supportsAllDrives=true`;
  const result = await client.request<ArrayBuffer>({ url, responseType: "arraybuffer", timeout: 60_000 });
  const buffer = Buffer.from(result.data);
  if (buffer.length > 25 * 1024 * 1024) throw new Error("Tài liệu Drive vượt quá 25 MB.");
  return { buffer, mimeType, title: meta.name };
}
