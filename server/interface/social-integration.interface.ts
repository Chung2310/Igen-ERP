import { Document } from "mongoose";

export interface ISocialIntegration extends Document {
  companyCode: string;
  platform: "Facebook" | "TikTok" | "Zalo";
  displayName: string;
  username?: string;
  avatarUrl?: string;
  isConnected: boolean;
  connectedAt: Date;
  createdBy: string;
  blotatoAccountId?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiredAt?: Date;
  isMock: boolean;
}
