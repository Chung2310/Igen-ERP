import { model, Schema } from "mongoose";
import type { ICustomerSettings } from "../interfaces/customer-settings.interface";

const CustomerTierSchema = new Schema({
  code: { type: String, required: true },
  name: { type: String, required: true },
  minSpend: { type: Number, required: true, min: 0 },
}, { _id: false });

const CustomerSettingsSchema = new Schema<ICustomerSettings>({
  companyCode: { type: String, required: true, index: true, unique: true },
  customerTiers: { type: [CustomerTierSchema], default: [] },
}, { timestamps: true, versionKey: false });

export const CustomerSettingsModel = model<ICustomerSettings>("CustomerSettings", CustomerSettingsSchema);
