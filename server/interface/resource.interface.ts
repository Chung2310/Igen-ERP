import { Document, Types } from "mongoose";

export interface IResource extends Document {
  companyCode: string;
  branchId?: string;
  uploadedBy: Types.ObjectId;
  name: string;
  mimeType: string;
  driveFileId: string;
  webViewLink: string;
  webContentLink?: string;
  thumbnailLink?: string;
  size?: number;
  chatRoomId?: Types.ObjectId | string;
  createdAt: Date;
}
