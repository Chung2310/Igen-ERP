import { Schema, model } from "mongoose";
import type { IInventoryCount, IInventoryCountItem } from "../interface/inventory.interface";

const InventoryCountItemSchema = new Schema<IInventoryCountItem>(
  {
    productId: { type: String, required: true, trim: true },
    variantId: { type: String, trim: true },
    sku: { type: String, required: true, trim: true, uppercase: true },
    barcode: { type: String, trim: true },
    productName: { type: String, required: true, trim: true },
    systemQuantity: { type: Number, required: true, min: 0 },
    countedQuantity: { type: Number, required: true, min: 0 },
    quantityDelta: { type: Number, required: true },
    sourceBalanceVersion: { type: Number, required: true, min: 0 },
    note: { type: String, trim: true },
  },
  { _id: true },
);

const InventoryCountSchema = new Schema<IInventoryCount>(
  {
    companyCode: { type: String, required: true, trim: true, uppercase: true, index: true },
    branchId: { type: String, required: true, trim: true, index: true },
    warehouseId: { type: String, required: true, trim: true, index: true },
    countCode: { type: String, required: true, trim: true },
    status: { type: String, enum: ["draft", "counting", "pending_approval", "completed", "cancelled", "conflict"], required: true, default: "draft", index: true },
    items: { type: [InventoryCountItemSchema], required: true, default: [] },
    notes: { type: String, trim: true },
    createdBy: { type: String, required: true, trim: true },
    submittedBy: { type: String, trim: true },
    approvedBy: { type: String, trim: true },
    submittedAt: Date,
    approvedAt: Date,
    cancelledAt: Date,
    version: { type: Number, required: true, min: 0, default: 0 },
  },
  { timestamps: true },
);

InventoryCountSchema.index({ companyCode: 1, countCode: 1 }, { unique: true });
InventoryCountSchema.index({ companyCode: 1, warehouseId: 1, createdAt: -1 });
InventoryCountSchema.index({ companyCode: 1, status: 1, warehouseId: 1 });

export const InventoryCountModel = model<IInventoryCount>("InventoryCount", InventoryCountSchema);
