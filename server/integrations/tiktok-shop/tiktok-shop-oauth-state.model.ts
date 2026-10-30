import { Schema, model } from "mongoose";

const TikTokShopOAuthStateSchema = new Schema({
  stateHash: { type: String, required: true, unique: true, index: true },
  companyCode: { type: String, required: true, uppercase: true, trim: true, index: true },
  userId: { type: String, required: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
  consumedAt: { type: Date, default: null },
}, { timestamps: true });

export const TikTokShopOAuthStateModel = model("TikTokShopOAuthState", TikTokShopOAuthStateSchema);
