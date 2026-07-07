import { Document, Types } from "mongoose";

export interface IResource extends Document {
  companyCode: string;
  uploadedBy: Types.ObjectId;
  name: string;
  mimeType: string;
  driveFileId: string;
  webViewLink: string;
  webContentLink?: string;
  thumbnailLink?: string;
  size?: number;
  createdAt: Date;
}
