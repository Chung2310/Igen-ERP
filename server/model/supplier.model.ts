import { Schema, model } from "mongoose";
import type { ISupplier } from "../interface/inventory.interface";

const SupplierSchema = new Schema<ISupplier>(
  {
    companyCode: { type: String, required: true, trim: true, uppercase: true, index: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true, index: true },
    taxCode: { type: String, trim: true, uppercase: true, index: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    address: { type: String, trim: true },
    paymentTerms: { type: String, trim: true },
    notes: { type: String, trim: true },
    status: { type: String, enum: ["active", "inactive"], default: "active", required: true, index: true },
    createdBy: { type: String, required: true },
    updatedBy: { type: String, required: true },
  },
  { timestamps: true },
);

SupplierSchema.index({ companyCode: 1, code: 1 }, { unique: true });

export const SupplierModel = model<ISupplier>("Supplier", SupplierSchema);
