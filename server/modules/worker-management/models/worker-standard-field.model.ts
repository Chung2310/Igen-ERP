import mongoose, { Schema } from "mongoose";
const workerStandardFieldSchema = new Schema({ companyCode: { type: String, required: true, index: true }, branchId: { type: String, index: true }, moduleKey: { type: String, required: true }, fields: { type: [Schema.Types.Mixed], default: [] } }, { timestamps: true });
workerStandardFieldSchema.index({ companyCode: 1, branchId: 1, moduleKey: 1 }, { unique: true });
export const WorkerStandardFieldModel = mongoose.models.WorkerStandardField || mongoose.model("WorkerStandardField", workerStandardFieldSchema);
