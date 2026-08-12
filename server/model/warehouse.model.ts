import { Schema, model } from "mongoose";
import type { IWarehouse } from "../interface/inventory.interface";

const WarehouseSchema = new Schema<IWarehouse>(
  {
    companyCode: { type: String, required: true, trim: true, uppercase: true, index: true },
    branchId: { type: String, required: true, trim: true, index: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    kind: { type: String, enum: ["selling", "central", "defective", "warranty", "other"], default: "selling", required: true },
    isDefault: { type: Boolean, default: false, index: true },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

WarehouseSchema.index({ companyCode: 1, branchId: 1, code: 1 }, { unique: true });
WarehouseSchema.index({ companyCode: 1, branchId: 1, isDefault: 1 }, { unique: true, partialFilterExpression: { isDefault: true } });

export const WarehouseModel = model<IWarehouse>("Warehouse", WarehouseSchema);
