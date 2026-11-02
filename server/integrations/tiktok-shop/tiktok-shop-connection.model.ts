import { Schema, model } from "mongoose";

const TikTokShopSchema = new Schema({
  cipher: { type: String, required: true, trim: true },
  id: { type: String, default: "", trim: true },
  code: { type: String, default: "", trim: true },
  name: { type: String, default: "", trim: true },
  region: { type: String, default: "", trim: true },
  retailBranchId: { type: String, default: "", trim: true },
}, { _id: false });

const TikTokShopConnectionSchema = new Schema({
  companyCode: { type: String, required: true, uppercase: true, trim: true, index: true },
  openId: { type: String, required: true, trim: true },
  accessTokenEncrypted: { type: String, required: true, select: false },
  refreshTokenEncrypted: { type: String, required: true, select: false },
  accessTokenExpiresAt: { type: Date, required: true },
  refreshTokenExpiresAt: { type: Date, required: true },
  scopes: { type: [String], default: [] },
  shops: { type: [TikTokShopSchema], default: [] },
  connectedBy: { type: String, required: true },
  connectedAt: { type: Date, default: Date.now },
  lastProductSyncAt: { type: Date, default: null },
  lastProductSyncStatus: { type: String, enum: ["never", "success", "failed"], default: "never" },
  lastProductSyncError: { type: String, default: "" },
  lastProductSyncStats: {
    type: new Schema({ total: Number, matched: Number, unmatched: Number }, { _id: false }),
    default: () => ({ total: 0, matched: 0, unmatched: 0 }),
  },
}, { timestamps: true });

TikTokShopConnectionSchema.index({ companyCode: 1, openId: 1 }, { unique: true });

export const TikTokShopConnectionModel = model("TikTokShopConnection", TikTokShopConnectionSchema);
