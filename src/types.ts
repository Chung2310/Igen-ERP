export type TabType = 
  | "TỔNG QUAN" 
  | "NHÂN SỰ" 
  | "KHO & SẢN PHẨM" 
  | "MARKETING" 
  | "SALES CRM" 
  | "HIỆU SUẤT AI"
  | "QUẢN TRỊ USER"
  | "CÀI ĐẶT";


export interface FacebookIntegration {
  isConnected: boolean;
  pageId: string;
  pageName: string;
  pageAccessToken: string;
  connectedAt: any;
  isMock?: boolean;
}

export interface TikTokIntegration {
  isConnected: boolean;
  /** Username hiển thị (e.g. @igen_tech) */
  username: string;
  /** Tên hiển thị trong UI */
  displayName: string;
  /** URL ảnh đại diện TikTok */
  avatarUrl?: string;
  /** Thời điểm kết nối */
  connectedAt: any;
  /** Mộc quyền riêng tư mặc định khi đăng (PUBLIC_TO_EVERYONE / SELF_ONLY) */
  privacyLevel?: 'PUBLIC_TO_EVERYONE' | 'MUTUAL_FOLLOW_FRIENDS' | 'SELF_ONLY';
  /** Chế độ giả lập — không cần API thật */
  isMock?: boolean;
}

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

export type HRSubTabType = "SƠ ĐỒ TỔ CHỨC" | "GIAO VIỆC KANBAN" | "ĐÀO TẠO";
export type InventorySubTabType = "DANH MỤC" | "PHÂN LOẠI SẢN PHẨM" | "NHẬP / XUẤT KHO" | "DỰ BÁO AI";
export type MarketingSubTabType = "LÊN Ý TƯỞNG AI" | "DUYỆT NỘI DUNG" | "LỊCH ĐĂNG CONTENT";
export type CRMSubTabType = "PHỄU KHÁCH HÀNG" | "OMNI-INBOX CHAT";

// Shared CRM Omni-Inbox Types
export interface ChatMessage {
  id: string;
  sender: "user" | "ai" | "agent";
  text: string;
  timestamp: Date;
  status?: "sent" | "delivered" | "read";
}

export interface CustomerInbox {
  id: string;
  name: string;
  avatar: string;
  lastMessage: string;
  time: string;
  unreadCount: number;
  isVip: boolean;
  status: "online" | "offline";
  tags: string[];
}

export interface AIChatConfig {
  autoClassify: boolean;
  autoCloseDeal: boolean;
  autoFeedback: boolean;
  replyDelay: number; // in seconds
  advancedInstructions: string;
}

// Leads Pipeline Card Types
export interface LeadCard {
  id: string;
  customerName: string;
  company: string;
  value: number;
  phone: string;
  avatar: string;
  email: string;
  productOfChoice: string;
  status: "cold" | "warm" | "hot" | "won" | "upsell";
  lastInteraction?: string;
}

// AI Marketing campaign draft concepts
export interface MarketingConcept {
  title: string;
  matchPercent: number;
  summary: string;
  channels: string[];
  suggestedContent: string;
  hashtags: string[];
}

export interface ContentApprovalCard {
  id: string;
  title: string;
  channel: "Facebook" | "TikTok" | "LinkedIn" | "Instagram";
  contentType: string;
  status: "draft" | "pending" | "approved" | "scheduled" | "published";
  bodyText: string;
  outline?: string;
  imageUrl?: string;
  videoUrl?: string;
  generatedAt: string;
  feedback?: string;
  scheduledDate?: string;
  scheduledTime?: string;
  authorUid?: string;
  publishedAt?: string;
  facebookPostId?: string;
  tiktokPostId?: string;
  tiktokShareUrl?: string;
}

export interface PublishEvent {
  id: string;
  date: number; // day in October 2026
  title: string;
  type: string;
  channel: string;
  status: "Draft" | "Approved" | "Published";
}

// Inventory product definition
export interface ProductItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  stock: number;
  minStockAlert: number;
  price: number;
  demandForecast: "Tăng mạnh" | "Ổn định" | "Giảm nhẹ";
  imageUrl: string;
}

export interface ProductCategory {
  id: string;
  name: string;
  code: string;
  description: string;
  colorClass: string;
  status: "Đang dùng" | "Tạm khóa";
}

export interface StockLog {
  id: string;
  type: "nhập" | "xuất";
  sku: string;
  productName: string;
  quantity: number;
  operatorName: string;
  createdAt: string;
  notes: string;
  status: "Thành công" | "Đang xử lý";
}

// HR Employee and Onboarding Tasks
export interface EmployeeNode {
  id: string;
  name: string;
  role: string;
  department: string;
  email: string;
  phone: string;
  avatar: string;
  level: number; // 1 = CEO, 2 = Director, 3 = Manager, 4 = Staff
  parentId?: string;
  status: "online" | "offline";
  division: string;
}

export interface Project {
  id: string;
  name: string;
  companyCode: string;
  creatorUid: string;
  createdAt: any;
}

export interface TaskHistoryEntry {
  time: string;
  user: string;
  action: string;
}

export interface HRTask {
  id: string;
  title: string;
  description?: string;
  assigneeUid: string;
  assignee: string;
  assigneeAvatar: string;
  dueDate: string;
  priority: "High" | "Medium" | "Low" | "Cao" | "Trung bình" | "Thấp";
  status: "Not Started" | "In Progress" | "Review/Testing" | "Done" | "Archived" | "todo" | "doing" | "done";
  category?: "Onboarding" | "Đào tạo" | "Tuyển dụng" | "Văn hóa";
  companyCode: string;
  creatorUid: string;
  createdAt: any;

  // New Notion fields
  projectId?: string;
  startTime?: string;
  estTime?: number;
  endTime?: string;
  actualTime?: number;
  tags?: string[];
  linkNote?: string;
  history?: TaskHistoryEntry[];
}

export interface TrainingCourse {
  id: string;
  title: string;
  category: string;
  duration: string;
  progress: number;
  instructor: string;
  icon: string;
  enrolledStudents: number;
}
