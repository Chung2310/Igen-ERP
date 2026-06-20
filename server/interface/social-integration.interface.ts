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
  fbAppId?: string;        // Facebook App ID (App ID từ Meta Developer)
  accessToken?: string;
  refreshToken?: string;
  tokenExpiredAt?: Date;
  appSecret?: string;      // Facebook App Secret (Khóa bí mật từ Meta Developer)
  verifyToken?: string;
  isMock: boolean;
}
