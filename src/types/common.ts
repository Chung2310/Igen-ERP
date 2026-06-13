import { FacebookIntegration, TikTokIntegration, ZaloIntegration } from "./integrations";
import { AIChatConfig } from "./crm";

export type TabType =
  | "TỔNG QUAN"
  | "NHÂN SỰ"
  | "KHO & SẢN PHẨM"
  | "MARKETING"
  | "SALES CRM"
  | "HIỆU SUẤT AI"
  | "QUẢN TRỊ USER"
  | "CÀI ĐẶT";

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: "user" | "manager" | "admin" | "superadmin";
  createdAt: any;
  facebookIntegration?: FacebookIntegration | null;
  tiktokIntegration?: TikTokIntegration | null;
  zaloIntegration?: ZaloIntegration | null;
  aiAutoReplyConfig?: AIChatConfig | null;
  heygenAccess?: {
    avatarIds?: string[];
    avatarId?: string;
    voiceId?: string;
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
}

export interface CompanyProfile {
  id: string;
  code: string;
  name: string;
  createdAt: any;
  ownerEmail: string;
}
