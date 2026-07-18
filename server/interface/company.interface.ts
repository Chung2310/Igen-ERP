import { Document } from "mongoose";

export interface ICompanyHeyGenConfig {
  apiKey: string;
  defaultAvatarId: string;
  defaultVoiceId: string;
  isConnected: boolean;
  connectedAt?: Date | null;
  lastSyncAt?: Date | null;
}

export interface ICompanyElevenLabsConfig {
  apiKey: string;
}

export interface ICompanyDriveOAuth {
  refreshToken: string;
  connectedEmail: string;
  connectedAt?: Date | null;
}

export interface ICompanyLocationConfig {
  latitude: number;
  longitude: number;
  allowedRadius: number;
  addressName?: string;
  checkInLimit?: string;
  checkOutLimit?: string;
  lunchBreakStart?: string;
  lunchBreakEnd?: string;
  workingDays?: number[];
}

export interface ICompany extends Document {
  code: string;
  name: string;
  createdAt: Date;
  ownerEmail: string;
  /** Các module nghiệp vụ được bật cho doanh nghiệp. Rỗng/thiếu = bật tất cả. */
  enabledModules?: string[];
  heygenConfig?: ICompanyHeyGenConfig;
  elevenlabsConfig?: ICompanyElevenLabsConfig;
  /** Link thÆ° má»¥c Google Drive dÃ¹ng chung cho toÃ n cÃ´ng ty (tÃ i liá»‡u). */
  driveFolderLink?: string;
  /** OAuth Google Drive riÃªng cá»§a cÃ´ng ty (má»—i cÃ´ng ty káº¿t ná»‘i tÃ i khoáº£n Google cá»§a há»). */
  driveOAuth?: ICompanyDriveOAuth;
  /** ID thÆ° má»¥c do app táº¡o trong Drive cá»§a cÃ´ng ty Ä‘á»ƒ chá»©a tÃ i liá»‡u. */
  driveFolderId?: string;
  locationConfig?: ICompanyLocationConfig;
  lifecycleStatus?: "active" | "suspended" | "archived" | "scheduled-deletion";
  lifecycleChangedAt?: Date;
  deletionScheduledAt?: Date | null;
  retentionEndsAt?: Date | null;
  deletionReason?: string;
}
