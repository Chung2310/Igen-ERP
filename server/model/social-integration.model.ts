import { Schema, model } from "mongoose";
import { ISocialIntegration } from "../interface/social-integration.interface";

const SocialIntegrationSchema = new Schema<ISocialIntegration>({
  companyCode: { type: String, required: true, index: true },
  platform: { type: String, enum: ["Facebook", "TikTok", "Zalo"], required: true, index: true },
  displayName: { type: String, required: true },
  username: { type: String, index: true },
  avatarUrl: { type: String },
  isConnected: { type: Boolean, default: true, index: true },
  connectedAt: { type: Date, default: Date.now },
  createdBy: { type: String, required: true },
  blotatoAccountId: { type: String, index: true },
  accessToken: { type: String },
  refreshToken: { type: String },
  tokenExpiredAt: { type: Date },
  isMock: { type: Boolean, default: false },
});

export const SocialIntegrationModel = model<ISocialIntegration>(
  "SocialIntegration",
  SocialIntegrationSchema
);
