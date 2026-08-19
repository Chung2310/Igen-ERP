import { model, Schema } from "mongoose";
import type { ICustomerBillingProfile } from "../interfaces/customer-billing-profile.interface";
const schema = new Schema<ICustomerBillingProfile>({ companyCode: { type: String, required: true }, customerId: { type: String, required: true }, legalName: { type: String, required: true, trim: true }, taxId: { type: String, required: true, trim: true }, address: { type: String, required: true, trim: true }, invoiceEmail: { type: String, required: true, trim: true, lowercase: true }, contactName: { type: String, trim: true }, isDefault: { type: Boolean, default: false }, status: { type: String, enum: ["active", "inactive"], default: "active" }, createdBy: { type: String, required: true }, createdByName: { type: String, required: true }, version: { type: Number, default: 0 } }, { timestamps: true, versionKey: false });
schema.index({ companyCode: 1, customerId: 1, status: 1 });
schema.index({ companyCode: 1, taxId: 1 });
schema.index({ companyCode: 1, customerId: 1, isDefault: 1 }, { unique: true, partialFilterExpression: { isDefault: true, status: "active" } });
export const CustomerBillingProfileModel = model<ICustomerBillingProfile>("CustomerBillingProfile", schema);
