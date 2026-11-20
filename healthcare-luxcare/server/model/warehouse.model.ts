import { Schema, model } from "mongoose";
import type { IWarehouse } from "../interface/warehouse.interface";

const WarehouseSchema = new Schema<IWarehouse>(
  {
    companyCode: { type: String, required: true, uppercase: true, trim: true, index: true },
    branchId: { type: String, default: "", trim: true, index: true },
    code: { type: String, required: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    location: { type: String, default: "", trim: true },
    managerName: { type: String, default: "", trim: true },
    managerPhone: { type: String, default: "", trim: true },
    description: { type: String, default: "", trim: true },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

WarehouseSchema.index({ companyCode: 1, branchId: 1, code: 1 }, { unique: true });
WarehouseSchema.index({ companyCode: 1, branchId: 1, isActive: 1 });

export const WarehouseModel = model<IWarehouse>("LuxcareSupplyWarehouse", WarehouseSchema);
