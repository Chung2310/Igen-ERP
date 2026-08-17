import { Schema, model } from "mongoose";
import type { ISerialUnit } from "./serial-unit.interface";

const SerialUnitSchema = new Schema<ISerialUnit>({
  companyCode: { type: String, required: true, index: true },
  branchId: { type: String, required: true, index: true },
  warehouseId: { type: String, index: true },
  productId: { type: String, required: true, index: true },
  variantId: { type: String, index: true },
  sku: { type: String, required: true, trim: true },
  productName: { type: String, required: true, trim: true },
  internalBarcode: { type: String, required: true, trim: true },
  normalizedInternalBarcode: { type: String, required: true, trim: true },
  serialNumber: { type: String, required: true, trim: true },
  normalizedSerialNumber: { type: String, required: true, trim: true },
  status: { type: String, enum: ["in_stock", "sold", "returned", "defective", "repairing", "scrapped"], required: true, default: "in_stock", index: true },
  currentDocumentType: { type: String, trim: true },
  currentDocumentId: { type: String, index: true },
  customerId: { type: String, index: true },
  createdBy: { type: String, required: true },
  updatedBy: { type: String, required: true },
}, { timestamps: true });

SerialUnitSchema.index({ companyCode: 1, normalizedSerialNumber: 1 }, { unique: true });
SerialUnitSchema.index({ companyCode: 1, normalizedInternalBarcode: 1 }, { unique: true });
SerialUnitSchema.index({ companyCode: 1, branchId: 1, status: 1 });

export const SerialUnitModel = model<ISerialUnit>("InventorySerialUnit", SerialUnitSchema);
