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

export interface ICompany extends Document {
  code: string;
  name: string;
  createdAt: Date;
  ownerEmail: string;
  heygenConfig?: ICompanyHeyGenConfig;
  elevenlabsConfig?: ICompanyElevenLabsConfig;
  /** Link thư mục Google Drive dùng chung cho toàn công ty (tài liệu). */
  driveFolderLink?: string;
  /** OAuth Google Drive riêng của công ty (mỗi công ty kết nối tài khoản Google của họ). */
  driveOAuth?: ICompanyDriveOAuth;
  /** ID thư mục do app tạo trong Drive của công ty để chứa tài liệu. */
  driveFolderId?: string;
}
