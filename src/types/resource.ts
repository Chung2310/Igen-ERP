export type ResourceSection = "local" | "drive";
export type ResourceType = "folder" | "file";
export type DriveDocType = "folder" | "document" | "spreadsheet" | "presentation" | "pdf" | "file";
export type ResourceManagedType = "user" | "system";
export type ResourceStorageProvider = "cloudinary" | "google-drive" | "local";
export type ResourceStorageAccess = "public" | "authenticated";

export interface ResourceItem {
  _id: string;
  companyCode: string;
  section: ResourceSection;
  type: ResourceType;
  name: string;
  parentId: string | null;
  roomId?: string | null;
  fileUrl?: string;
  mimeType?: string;
  size?: number;
  driveType?: DriveDocType;
  creatorUid?: string;
  creatorName?: string;
  isFixed?: boolean;
  isDeleted?: boolean;
  deletedAt?: string;
  isShared?: boolean; // true nếu item này được chia sẻ cho user hiện tại bởi người khác
  shares?: Array<{ targetId: string; targetType: "user" | "room"; targetName: string }>;
  managedType?: ResourceManagedType;
  systemFolderKey?: string;
  sourceKey?: string;
  sourceType?: string;
  sourceModule?: string;
  sourceGroup?: string;
  sourceEntityType?: string;
  sourceEntityId?: string;
  sourceEntityLabel?: string;
  sourceRecordId?: string;
  sourceField?: string;
  sourceRoute?: string;
  branchId?: string;
  requiredPermissions?: string[];
  sourceAudienceIds?: string[];
  storageProvider?: ResourceStorageProvider;
  storagePublicId?: string;
  storageResourceType?: string;
  storageAccess?: ResourceStorageAccess;
  createdAt: string;
  updatedAt: string;
}

export interface BreadcrumbEntry {
  _id: string;
  name: string;
  isFixed?: boolean;
}

export type ResourceSubTabType = "TÀI LIỆU KHÁC" | "GOOGLE DRIVE";

/** File trả về từ Google Drive API (thư mục dùng chung của công ty). */
export interface DriveApiFile {
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
