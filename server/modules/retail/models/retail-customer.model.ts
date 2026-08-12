import { model, Schema } from "mongoose";
import type { IRetailCustomer } from "../interfaces/retail-customer.interface";

const RetailCustomerSchema = new Schema<IRetailCustomer>({
  customerCode: { type: String, required: true, trim: true },
  companyCode: { type: String, required: true, index: true },
  originBranchId: { type: String, required: true, index: true },
  name: { type: String, required: true, trim: true, index: true },
  phone: { type: String, trim: true },
  normalizedPhone: { type: String, trim: true },
  email: { type: String, trim: true, lowercase: true },
  address: { type: String, trim: true },
  notes: { type: String, trim: true },
  createdBy: { type: String, required: true },
  createdByName: { type: String, required: true },
}, { timestamps: true });

RetailCustomerSchema.index({ companyCode: 1, customerCode: 1 }, { unique: true });
RetailCustomerSchema.index(
  { companyCode: 1, normalizedPhone: 1 },
  { unique: true, partialFilterExpression: { normalizedPhone: { $type: "string" } } },
);

export const RetailCustomerModel = model<IRetailCustomer>("RetailCustomer", RetailCustomerSchema);
