import { Schema, model } from "mongoose";
import type { IInventoryBalance } from "../interface/inventory.interface";

const InventoryBalanceSchema = new Schema<IInventoryBalance>(
  {
    companyCode: { type: String, required: true, trim: true, uppercase: true, index: true },
    branchId: { type: String, required: true, trim: true, index: true },
    warehouseId: { type: String, required: true, trim: true, index: true },
    productId: { type: String, required: true, trim: true, index: true },
    variantId: { type: String, trim: true, index: true },
    sku: { type: String, required: true, trim: true, uppercase: true, index: true },
    quantity: { type: Number, required: true, default: 0 },
    reservedQuantity: { type: Number, required: true, default: 0, min: 0 },
    averageCost: { type: Number, required: true, default: 0, min: 0 },
    version: { type: Number, required: true, default: 0, min: 0 },
  },
  { timestamps: true },
);

InventoryBalanceSchema.index({ companyCode: 1, warehouseId: 1, productId: 1, variantId: 1 }, { unique: true });
InventoryBalanceSchema.index({ companyCode: 1, branchId: 1, sku: 1 });

export const InventoryBalanceModel = model<IInventoryBalance>("InventoryBalance", InventoryBalanceSchema);
