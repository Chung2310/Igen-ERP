import { Schema, model } from "mongoose";
import type { IGoodsReceipt } from "../interface/inventory.interface";

const GoodsReceiptItemSchema = new Schema(
  {
    productId: { type: String, required: true, trim: true },
    variantId: { type: String, required: true, trim: true },
    barcode: { type: String, trim: true },
    sku: { type: String, required: true, trim: true, uppercase: true },
    trackingMode: { type: String, enum: ["none", "quantity", "unit_barcode", "lot", "serial"] },
    serialNumbers: { type: [String], default: undefined },
    unitDetails: { type: [{ internalBarcode: { type: String, required: true, trim: true }, serialNumber: { type: String, trim: true }, imei1: { type: String, trim: true }, imei2: { type: String, trim: true } }], default: undefined },
    productName: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 0.000001 },
    unitCost: { type: Number, required: true, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 },
    supplierWarrantyMonths: { type: Number, min: 0, max: 1200 },
    note: { type: String, trim: true },
  },
  { _id: false },
);

const GoodsReceiptSchema = new Schema<IGoodsReceipt>(
  {
    companyCode: { type: String, required: true, trim: true, uppercase: true, index: true },
    branchId: { type: String, required: true, trim: true, index: true },
    warehouseId: { type: String, required: true, trim: true, index: true },
    receiptCode: { type: String, required: true, trim: true, uppercase: true },
    supplierId: { type: String, required: true, trim: true, index: true },
    supplierName: { type: String, required: true, trim: true },
    status: { type: String, enum: ["draft", "pending", "receiving", "confirmed", "cancelled"], default: "draft", required: true, index: true },
    receivedAt: { type: Date },
    items: { type: [GoodsReceiptItemSchema], default: [] },
    subtotal: { type: Number, required: true, min: 0, default: 0 },
    notes: { type: String, trim: true },
    idempotencyKey: { type: String, trim: true, index: true },
    createdBy: { type: String, required: true },
    createdByName: { type: String, trim: true },
    confirmedBy: { type: String, trim: true },
    confirmedByName: { type: String, trim: true },
    confirmedAt: { type: Date },
    cancelledBy: { type: String, trim: true },
    cancelledAt: { type: Date },
    cancelReason: { type: String, trim: true },
    version: { type: Number, required: true, default: 0, min: 0 },
  },
  { timestamps: true },
);

GoodsReceiptSchema.index({ companyCode: 1, receiptCode: 1 }, { unique: true });
GoodsReceiptSchema.index({ companyCode: 1, idempotencyKey: 1 }, { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string" } } });

export const GoodsReceiptModel = model<IGoodsReceipt>("GoodsReceipt", GoodsReceiptSchema);
