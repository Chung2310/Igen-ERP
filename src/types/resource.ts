export type ResourceSection = "local" | "drive";
export type ResourceType = "folder" | "file";
export type DriveDocType = "folder" | "document" | "spreadsheet" | "presentation" | "pdf" | "file";

export interface ResourceItem {
  _id: string;
  companyCode: string;
  section: ResourceSection;
  type: ResourceType;
  name: string;
  parentId: string | null;
  fileUrl?: string;
  mimeType?: string;
  size?: number;
  driveType?: DriveDocType;
  creatorUid?: string;
  creatorName?: string;
  isFixed?: boolean;
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
