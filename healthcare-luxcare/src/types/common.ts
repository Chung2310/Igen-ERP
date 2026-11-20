export type TabType =
  | "QUẢN LÝ KHÁCH HÀNG"
  | "QUẢN LÝ ỨNG VIÊN"
  | "TỔNG QUAN"
  | "NHÂN SỰ"
  | "KHO TRI THỨC"
  | "QUẢN LÝ TÀI NGUYÊN"
  | "TRÒ CHUYỆN"
  | "VÍ & NẠP TIỀN"
  | "TÀI NGUYÊN"
  | "PHÂN TÍCH & BÁO CÁO"
  | "QUẢN TRỊ USER"
  | "CÀI ĐẶT"
  | "HƯỚNG DẪN"
  | "BẢNG TIN"
  | "QUẢN LÝ THIẾT BỊ"
  | "QUẢN LÝ VẬT TƯ";

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
  role: "user" | "trial_user" | "manager" | "branch_owner" | "admin" | "superadmin" | "blog_editor" | "blog_author";
  permissions?: string[];
  createdAt: any;
  birthDate?: string;
  jobTitle?: string;
  qualification?: string;
  departmentId?: string;
  department?: string;
  jobDescriptionLink?: string;
  phone?: string;
  level?: number;
  parentId?: string;
  status?: "online" | "offline";
  division?: string;
  onboardingRequired?: boolean;
  emailVerifiedAt?: string;
  companyCode?: string;
  companyName?: string;
  branchId?: string;
  branchName?: string;
  /** Module nghiệp vụ được bật cho doanh nghiệp. Thiếu hoặc rỗng = bật tất cả. */
  enabledModules?: string[];
  businessType?: "service" | "recruitment" | "general";
  monthlySalary?: number;
  isLeader?: boolean;
}

export interface CompanyProfile {
  id: string;
  code: string;
  name: string;
  createdAt: any;
  ownerEmail: string;
  enabledModules?: string[];
  businessType?: "service" | "recruitment" | "general";
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
