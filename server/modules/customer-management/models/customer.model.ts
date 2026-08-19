import { model, Schema } from "mongoose";
import type { ICustomer } from "../interfaces/customer.interface";

const CustomerSchema = new Schema<ICustomer>({
  companyCode: { type: String, required: true, trim: true },
  customerCode: { type: String, required: true, trim: true },
  type: { type: String, enum: ["regular", "vat"], default: "regular", required: true },
  name: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true },
  normalizedPhone: { type: String, required: true, trim: true },
  email: { type: String, trim: true, lowercase: true },
  dateOfBirth: Date,
  gender: { type: String, enum: ["male", "female", "other"] },
  address: { type: String, trim: true },
  notes: { type: String, trim: true },
  status: { type: String, enum: ["active", "inactive"], default: "active", required: true },
  source: { type: String, enum: ["manual", "pos", "import"], default: "manual", required: true },
  createdBy: { type: String, required: true },
  createdByName: { type: String, required: true },
  version: { type: Number, default: 0, required: true, min: 0 },
}, { timestamps: true, versionKey: false });

CustomerSchema.index({ companyCode: 1, customerCode: 1 }, { unique: true });
CustomerSchema.index({ companyCode: 1, normalizedPhone: 1 }, { unique: true });
CustomerSchema.index({ companyCode: 1, status: 1, name: 1 });
CustomerSchema.index({ companyCode: 1, type: 1, createdAt: -1 });

export const CustomerModel = model<ICustomer>("Customer", CustomerSchema);
