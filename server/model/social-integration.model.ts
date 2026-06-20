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
  accessToken: { type: String },
  refreshToken: { type: String },
  tokenExpiredAt: { type: Date },
  appSecret: { type: String },
  verifyToken: { type: String },
  isMock: { type: Boolean, default: false },
});

SocialIntegrationSchema.index({ platform: 1, username: 1, isConnected: 1 });
SocialIntegrationSchema.index({ companyCode: 1, platform: 1, isConnected: 1 });

export const SocialIntegrationModel = model<ISocialIntegration>(
  "SocialIntegration",
  SocialIntegrationSchema
);
