
export type TabType =
  | "QUẢN LÝ LAO ĐỘNG"
  | "QUẢN LÝ KHÁCH HÀNG"
  | "QUẢN LÝ ỨNG VIÊN"
  | "TỔNG QUAN"
  | "NHÂN SỰ"
  | "ĐỐI TÁC"
  | "KHO & SẢN PHẨM"
  | "QUẢN LÝ TÀI NGUYÊN"
  | "TRÒ CHUYỆN"
  | "TÀI NGUYÊN"
  | "QUẢN LÝ HỌC VIÊN"
  | "PHÂN TÍCH & BÁO CÁO"
  | "QUẢN TRỊ USER"
  | "CÀI ĐẶT"
  | "HƯỚNG DẪN";

export interface GoogleDriveIntegration {
  isConnected: boolean;
  driveEmail: string;
  connectedAt?: any | null;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: "user" | "manager" | "branch_owner" | "admin" | "superadmin";
  permissions?: string[];
  createdAt: any;
  birthDate?: string;
  jobTitle?: string;
  department?: string;
  jobDescriptionLink?: string;
  phone?: string;
  level?: number;
  parentId?: string;
  status?: "online" | "offline";
  division?: string;
  companyCode?: string;
  companyName?: string;
  branchId?: string;
  /** Module nghiệp vụ được bật cho doanh nghiệp. Thiếu hoặc rỗng = bật tất cả. */
  enabledModules?: string[];
  businessType?: "education" | "labor" | "service" | "recruitment" | "general";
  monthlySalary?: number;
}

export interface CompanyProfile {
  id: string;
  code: string;
  name: string;
  createdAt: any;
  ownerEmail: string;
  enabledModules?: string[];
  businessType?: "education" | "labor" | "service" | "recruitment" | "general";
  monthlySalary?: number;
}

export interface TelegramLinkStatus {
  linked: boolean;
  telegramChatId: number | null;
  telegramUserId: number | null;
  linkedAt: any | null;
  pendingCode: string | null;
  pendingCodeExpiresAt: any | null;
  botUsername: string;
}
