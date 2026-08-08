import { Schema, model, type Document } from "mongoose";

export interface IResourceImportRun extends Document {
  companyCode: string;
  branchId?: string;
  sourceType: string;
  fileName: string;
  importedCount: number;
  skippedCount: number;
  actorId: string;
  createdAt: Date;
  updatedAt: Date;
}

const resourceImportRunSchema = new Schema<IResourceImportRun>({
  companyCode: { type: String, required: true, index: true },
  branchId: { type: String, default: undefined, index: true },
  sourceType: { type: String, required: true, index: true },
  fileName: { type: String, required: true },
  importedCount: { type: Number, required: true, min: 0 },
  skippedCount: { type: Number, required: true, min: 0, default: 0 },
  actorId: { type: String, required: true, index: true },
}, { timestamps: true });

export const ResourceImportRunModel = model<IResourceImportRun>("ResourceImportRun", resourceImportRunSchema);
