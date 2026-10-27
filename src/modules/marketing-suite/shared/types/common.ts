import { FacebookIntegration, TikTokIntegration, ZaloIntegration } from "./integrations";
import { AIChatConfig } from "../../message/types/crm";

export type TabType =
  | "TONG QUAN"
  | "MARKETING"
  | "XUONG NOI DUNG"
  | "VIDEO STUDIO"
  | "KHO TRI THUC"
  | "SALES CRM"
  | "QUAN TRI USER"
  | "VI & NAP TIEN"
  | "CAI DAT"
  | "HUONG DAN SU DUNG";

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: string;
  createdAt: string | Date;
  facebookIntegration?: FacebookIntegration | null;
  tiktokIntegration?: TikTokIntegration | null;
  zaloIntegration?: ZaloIntegration | null;
  aiAutoReplyConfig?: AIChatConfig | null;
  elevenlabsAccess?: {
    apiKey?: string;
  } | null;
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


export interface CompanyProfile {
  id: string;
  code: string;
  name: string;
  createdAt: string | Date;
  ownerEmail: string;
}

export interface TelegramLinkStatus {
  linked: boolean;
  telegramChatId: number | null;
  telegramUserId: number | null;
  linkedAt: string | Date | null;
  pendingCode: string | null;
  pendingCodeExpiresAt: string | Date | null;
  botUsername: string;
}

export interface CompanyTelegramOrderConfig {
  companyCode: string;
  companyName: string;
  enabled: boolean;
  notifyNewOrder: boolean;
  hasBotToken: boolean;
  groupChatId: string;
  messageThreadId: number | null;
  botUsername: string;
  lastTestedAt: string | Date | null;
  lastTestStatus: "success" | "failed" | "untested";
  lastTestError: string;
}

export interface CompanySepayConfig {
  companyCode: string;
  companyName: string;
  enabled: boolean;
  hasWebhookSecret: boolean;
  webhookId: string;
  webhookUrl: string;
  accountNumbers: string[];
  paymentCodePrefix: string;
  depositEnabled: boolean;
  depositPercent: number;
  qrBankId: string;
  qrAccountNumber: string;
  qrAccountName: string;
  lastWebhookAt: string | Date | null;
  lastWebhookStatus: "success" | "failed" | "untested";
  lastWebhookError: string;
}

export interface CompanyProductCatalogConfig {
  companyCode: string;
  companyName: string;
  enabled: boolean;
  rootFolderUrl: string;
  maxImagesPerReply: number;
  catalogName: string;
  itemLabel: string;
  selectionMessage: string;
  businessDescription: string;
  categoryAliases: Record<string, string[]>;
  migratedFromLegacy?: boolean;
  serviceAccountEmail: string;
}

export type CompanyCakeCatalogConfig = CompanyProductCatalogConfig;
