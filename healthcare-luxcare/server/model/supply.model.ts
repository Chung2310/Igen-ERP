import { model, Schema } from "mongoose";
import type { ISupply } from "../interface/supply.interface";

const documentSchema = new Schema(
  {
    name: { type: String, required: true },
    fileUrl: { type: String, required: true },
    fileType: String,
    fileSize: Number,
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const schema = new Schema<ISupply>(
  {
    companyCode: { type: String, required: true, index: true },
    branchId: { type: String, index: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    unit: { type: String, required: true, trim: true },
    quantity: { type: Number, default: 0, min: 0 },
    minQuantity: { type: Number, default: 10, min: 0 },
    expiryDate: { type: Date, default: null, index: true },
    requiresExpiry: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true, index: true },
    archivedAt: Date,
    archivedBy: String,
    catalogCreation: {
      type: new Schema({
        actorId: { type: String, required: true },
        key: String,
        fingerprint: { type: String, required: true },
        snapshot: { type: Schema.Types.Mixed, required: true },
      }, { _id: false }),
      select: false,
      immutable: true,
    },
    manufactureDate: Date,
    batchNumber: { type: String, trim: true },
    warehouseLocation: { type: String, required: true, trim: true },
    warehouseId: { type: String, index: true },
    roomId: { type: String, index: true },
    supplier: { type: String, required: true, trim: true },
    supplierId: { type: String, index: true },
    inspectionDate: { type: Date, default: Date.now, required: true },
    nextInspectionDate: Date,
    inspectionCertificateNumber: { type: String, trim: true },
    imageUrl: String,
    images: [{ type: String }],
    documents: [documentSchema],
    unitPrice: Number,
    notes: String,
    status: {
      type: String,
      enum: ["in-stock", "low-stock", "out-of-stock", "expired", "quarantined"],
      default: "in-stock",
      index: true,
    },
  },
  { timestamps: true },
);

schema.index({ companyCode: 1, code: 1 }, { unique: true });
schema.index(
  { companyCode: 1, "catalogCreation.key": 1 },
  { unique: true, partialFilterExpression: { "catalogCreation.key": { $type: "string" } } },
);
schema.index({ companyCode: 1, branchId: 1, status: 1, expiryDate: 1 });

export const SupplyModel = model<ISupply>("Supply", schema);
