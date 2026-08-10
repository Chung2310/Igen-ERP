import { model, Schema } from "mongoose";
import type { IRetailSettings } from "../interfaces/retail-settings.interface";

const RetailSettingsSchema = new Schema<IRetailSettings>({
  companyCode: { type: String, required: true, index: true },
  branchId: { type: String, required: true, index: true },
  allowNegativeStock: { type: Boolean, default: false },
  maxDiscountPercent: { type: Number, min: 0, max: 100, default: 0 },
  defaultTaxRate: { type: Number, min: 0, max: 100, default: 0 },
  varianceReasonThreshold: { type: Number, min: 0, default: 0 },
  orderPrefix: { type: String, required: true, default: "DH", trim: true, uppercase: true },
  invoicePrefix: { type: String, required: true, default: "HD", trim: true, uppercase: true },
}, { timestamps: true });

RetailSettingsSchema.index({ companyCode: 1, branchId: 1 }, { unique: true });

export const RetailSettingsModel = model<IRetailSettings>("RetailSettings", RetailSettingsSchema);
