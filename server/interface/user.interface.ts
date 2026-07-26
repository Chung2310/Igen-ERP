import { Document } from "mongoose";

export interface ISuperAdminSecurity {
  totpEnabled: boolean;
  totpSecretEncrypted?: string;
  recoveryCodeHashes: string[];
  enrolledAt?: Date;
  failedTotpAttempts: number;
  lockedUntil?: Date;
}

export interface IFacebookIntegration {
  isConnected: boolean;
  pageId: string;
  pageName: string;
  pageAccessToken: string;
  appSecret?: string;
  verifyToken?: string;
  connectedAt?: Date;
  isMock?: boolean;
}

export interface ITikTokIntegration {
  isConnected: boolean;
  username: string;
  displayName: string;
  avatarUrl?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiredAt?: Date;
  clientKey?: string;
  clientSecret?: string;
  scopes?: string[];
  connectedAt?: Date;
  privacyLevel?: "PUBLIC_TO_EVERYONE" | "MUTUAL_FOLLOW_FRIENDS" | "SELF_ONLY";
  isMock?: boolean;
}

export interface IZaloIntegration {
  isConnected: boolean;
  oaId: string;
  oaName: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiredAt: Date;
  connectedAt?: Date;
  isMock?: boolean;
}

export interface IAiAutoReplyConfig {
  enabled: boolean;
  commentReplyEnabled?: boolean;
  autoClassify: boolean;
  autoCloseDeal: boolean;
  autoFeedback: boolean;
  replyDelay: number;
  advancedInstructions: string;
  trainingKnowledge: string;
  model?: string;
  disabledAt?: string | null;
}

export interface IHeyGenAccessConfig {
  avatarIds?: string[];
  avatarId?: string;
  voiceId?: string;
  apiKey?: string;
}

export interface IElevenLabsAccessConfig {
  apiKey?: string;
}

export interface IGoogleDriveIntegration {
  isConnected: boolean;
  driveEmail: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiredAt: Date;
  rootFolderId?: string;
  connectedAt?: Date;
}

export interface IWorkHoursConfig {
  useCustom: boolean;
  checkInLimit?: string;
  checkOutLimit?: string;
  lunchBreakStart?: string;
  lunchBreakEnd?: string;
  workingDays?: number[];
}

export interface IUser extends Document {
  workHoursConfig?: IWorkHoursConfig;
  monthlySalary?: number;
  email: string;
  password?: string; // Hashed password
  displayName: string;
  photoURL?: string;
  role: string;
  createdAt: Date;
  facebookIntegration?: IFacebookIntegration | null;
  tiktokIntegration?: ITikTokIntegration | null;
  zaloIntegration?: IZaloIntegration | null;
  googleDriveIntegration?: IGoogleDriveIntegration | null;
  aiAutoReplyConfig?: IAiAutoReplyConfig | null;
  heygenAccess?: IHeyGenAccessConfig | null;
  elevenlabsAccess?: IElevenLabsAccessConfig | null;
  
  // Org Chart & SaaS fields
  jobTitle?: string;
  department?: string;
  jobDescriptionLink?: string;
  phone?: string;
  level?: number;
  parentId?: string;
  status?: "online" | "offline";
  disabledAt?: Date | null;
  division?: string;
  companyCode?: string;
  companyName?: string;
  permissions?: string[];
  superAdminSecurity?: ISuperAdminSecurity;
  
  // SMTP Configuration
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpUser?: string;
  smtpPass?: string;
  smtpFrom?: string;
  smtpSandboxEmail?: string;

  // SaaS / Business limits
  businessType?: "driving" | "language" | "general";
  isActive?: boolean;
  maxUsersLimit?: number;
}

