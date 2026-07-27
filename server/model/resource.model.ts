import mongoose, { Schema, model } from "mongoose";
import { IResource } from "../interface/resource.interface";

const ResourceSchema = new Schema<IResource>({
  companyCode: { type: String, required: true, index: true },
    branchId: { type: String, index: true },
  uploadedBy: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  name: { type: String, required: true },
  mimeType: { type: String, required: true },
  driveFileId: { type: String, required: true, unique: true, index: true },
  webViewLink: { type: String, required: true },
  webContentLink: { type: String },
  thumbnailLink: { type: String },
  size: { type: Number },
  chatRoomId: { type: Schema.Types.ObjectId, ref: "ChatRoom", index: true },
  createdAt: { type: Date, default: Date.now, index: true },
});

export const ResourceModel = model<IResource>("Resource", ResourceSchema);

