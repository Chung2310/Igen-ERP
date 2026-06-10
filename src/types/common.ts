import { FacebookIntegration, TikTokIntegration } from "./integrations";

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
}

export interface CompanyProfile {
  id: string;
  code: string;
  name: string;
  createdAt: any;
  ownerEmail: string;
}
