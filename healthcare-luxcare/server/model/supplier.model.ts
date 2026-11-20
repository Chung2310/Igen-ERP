import { Schema, model } from "mongoose";
import type { ISupplier } from "../interface/supplier.interface";

const SupplierSchema = new Schema<ISupplier>(
  {
    companyCode: { type: String, required: true, uppercase: true, trim: true, index: true },
    code: { type: String, required: true, uppercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    shortName: { type: String, default: "", trim: true },
    contactPerson: { type: String, default: "", trim: true },
    phone: { type: String, default: "", trim: true },
    email: { type: String, default: "", trim: true, lowercase: true },
    address: { type: String, default: "", trim: true },
    taxCode: { type: String, default: "", trim: true },
    notes: { type: String, default: "", trim: true },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

SupplierSchema.index({ companyCode: 1, code: 1 }, { unique: true });
SupplierSchema.index({ companyCode: 1, isActive: 1 });

export const SupplierModel = model<ISupplier>("LuxcareSupplySupplier", SupplierSchema);
