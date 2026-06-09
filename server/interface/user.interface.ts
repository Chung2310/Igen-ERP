import { Document } from "mongoose";

export interface IFacebookIntegration {
  isConnected: boolean;
  pageId: string;
  pageName: string;
  pageAccessToken: string;
  connectedAt?: Date;
  isMock?: boolean;
}

export interface ITikTokIntegration {
  isConnected: boolean;
  username: string;
  displayName: string;
  avatarUrl?: string;
  accessToken?: string;
  connectedAt?: Date;
  privacyLevel?: "PUBLIC_TO_EVERYONE" | "MUTUAL_FOLLOW_FRIENDS" | "SELF_ONLY";
  isMock?: boolean;
}

export interface IUser extends Document {
  email: string;
  password?: string; // Hashed password
  displayName: string;
  photoURL?: string;
  role: "user" | "manager" | "admin" | "superadmin";
  createdAt: Date;
  facebookIntegration?: IFacebookIntegration | null;
  tiktokIntegration?: ITikTokIntegration | null;
  
  // Org Chart & SaaS fields
  jobTitle?: string;
  department?: string;
  phone?: string;
  level?: number;
  parentId?: string;
  status?: "online" | "offline";
  division?: string;
  companyCode?: string;
  companyName?: string;
  permissions?: string[];
}
