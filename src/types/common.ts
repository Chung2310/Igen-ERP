
export type TabType =
  | "TỔNG QUAN"
  | "NHÂN SỰ"
  | "KHO & SẢN PHẨM"
  | "QUẢN LÝ TÀI NGUYÊN"
  | "TRÒ CHUYỆN"
  | "TÀI NGUYÊN"
  | "QUẢN LÝ HỌC VIÊN"
  | "QUẢN TRỊ USER"
  | "VÍ & NẠP TIỀN"
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
  role: "user" | "manager" | "admin" | "superadmin";
  permissions?: string[];
  createdAt: any;
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
  /** Module nghiệp vụ được bật cho doanh nghiệp. Thiếu hoặc rỗng = bật tất cả. */
  enabledModules?: string[];
  monthlySalary?: number;
  standardHours?: number;
}

export interface CompanyProfile {
  id: string;
  code: string;
  name: string;
  createdAt: any;
  ownerEmail: string;
  enabledModules?: string[];
  monthlySalary?: number;
  standardHours?: number;
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
