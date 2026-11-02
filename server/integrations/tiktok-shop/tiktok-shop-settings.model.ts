import { model, Schema } from "mongoose";

const TikTokShopSettingsSchema = new Schema({
  companyCode: { type: String, required: true, uppercase: true, trim: true },
  orderBranchId: { type: String, default: "", trim: true },
}, { timestamps: true });

TikTokShopSettingsSchema.index({ companyCode: 1 }, { unique: true });

export const TikTokShopSettingsModel = model("TikTokShopSettings", TikTokShopSettingsSchema);
