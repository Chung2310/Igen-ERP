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

export interface ICompanyDashboardReportConfig {
  enabled: boolean;
  recipients: string[];
  hourLocal: number;
  lastSentDate?: string;
}

export interface ICompanySmtpConfig { host: string; port: number; secure: boolean; user: string; passwordEncrypted: string; fromEmail: string; fromName: string; updatedAt?: Date; }
export interface ICelebrationTemplate { subject: string; html: string; }
export interface ICompanyCelebrationConfig { birthdayEnabled: boolean; holidayEnabled: boolean; sendTime: string; birthdayTemplate: ICelebrationTemplate; holidayTemplate: ICelebrationTemplate; holidayOverrides?: Array<{ date: string; enabled: boolean; subject?: string; html?: string }>; }

export interface ICompanySmtpConfig { host: string; port: number; secure: boolean; user: string; passwordEncrypted: string; fromEmail: string; fromName: string; updatedAt?: Date; }
export interface ICelebrationTemplate { subject: string; html: string; }
export interface ICompanyCelebrationConfig { birthdayEnabled: boolean; holidayEnabled: boolean; sendTime: string; birthdayTemplate: ICelebrationTemplate; holidayTemplate: ICelebrationTemplate; holidayOverrides?: Array<{ date: string; enabled: boolean; subject?: string; html?: string }>; }

export interface ICompany extends Document {
  code: string;
  name: string;
  createdAt: Date;
  ownerEmail: string;
  businessType?: "education" | "labor" | "service" | "recruitment" | "general";
  /** Các module nghiệp vụ được bật cho doanh nghiệp. Rỗng/thiếu = bật tất cả. */
  enabledModules?: string[];
  heygenConfig?: ICompanyHeyGenConfig;
  elevenlabsConfig?: ICompanyElevenLabsConfig;
  /** Link thư mục Google Drive dùng chung cho toàn công ty (tài liệu). */
  driveFolderLink?: string;
  /** OAuth Google Drive riêng của công ty (mỗi công ty kết nối tài khoản Google của họ). */
  driveOAuth?: ICompanyDriveOAuth;
  /** ID thư mục do app tạo trong Drive của công ty để chứa tài liệu. */
  driveFolderId?: string;
  locationConfig?: ICompanyLocationConfig;
  annualLeaveDays?: number;
  dashboardReportConfig?: ICompanyDashboardReportConfig;
  smtpConfig?: ICompanySmtpConfig;
  celebrationConfig?: ICompanyCelebrationConfig;

  lifecycleStatus?: "active" | "suspended" | "archived" | "scheduled-deletion";
  lifecycleChangedAt?: Date;
  deletionScheduledAt?: Date | null;
  retentionEndsAt?: Date | null;
  deletionReason?: string;
}
