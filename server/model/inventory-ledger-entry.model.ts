import { Schema, model } from "mongoose";
import type { IInventoryLedgerEntry } from "../interface/inventory.interface";

const InventoryLedgerEntrySchema = new Schema<IInventoryLedgerEntry>(
  {
    companyCode: { type: String, required: true, trim: true, uppercase: true, index: true },
    branchId: { type: String, required: true, trim: true, index: true },
    warehouseId: { type: String, required: true, trim: true, index: true },
    productId: { type: String, required: true, trim: true, index: true },
    variantId: { type: String, trim: true, index: true },
    sku: { type: String, required: true, trim: true, uppercase: true, index: true },
    productName: { type: String, required: true, trim: true },
    direction: { type: String, enum: ["in", "out"], required: true, index: true },
    purpose: { type: String, enum: ["sale", "cancel", "purchase", "sales-return", "supplier-return", "transfer", "count", "opening", "other"], required: true, index: true },
    quantity: { type: Number, required: true, min: 0.000001 },
    quantityDelta: { type: Number, required: true },
    unitCost: { type: Number, required: true, min: 0 },
    unitPrice: { type: Number, min: 0 },
    sourceType: { type: String, required: true, trim: true, index: true },
    sourceId: { type: String, required: true, trim: true, index: true },
    sourceCode: { type: String, trim: true },
    sourceLine: { type: Number, required: true, min: 0 },
    idempotencyKey: { type: String, required: true, trim: true, index: true },
    operatorName: { type: String, required: true, trim: true },
    reason: { type: String, trim: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

InventoryLedgerEntrySchema.index({ companyCode: 1, idempotencyKey: 1, sourceLine: 1 }, { unique: true });
InventoryLedgerEntrySchema.index({ companyCode: 1, warehouseId: 1, productId: 1, createdAt: 1 });

export const InventoryLedgerEntryModel = model<IInventoryLedgerEntry>("InventoryLedgerEntry", InventoryLedgerEntrySchema);
