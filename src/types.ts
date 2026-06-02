export type TabType = 
  | "TỔNG QUAN" 
  | "NHÂN SỰ" 
  | "KHO & SẢN PHẨM" 
  | "MARKETING" 
  | "SALES CRM" 
  | "HIỆU SUẤT AI";

export type HRSubTabType = "SƠ ĐỒ TỔ CHỨC" | "GIAO VIỆC KANBAN" | "ĐÀO TẠO";
export type InventorySubTabType = "DANH MỤC" | "NHẬP / XUẤT KHO" | "DỰ BÁO AI";
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
}

export interface ContentApprovalCard {
  id: string;
  title: string;
  channel: "Facebook" | "TikTok" | "LinkedIn" | "Instagram";
  contentType: string;
  status: "draft" | "pending" | "scheduled";
  bodyText: string;
  imageUrl?: string;
  generatedAt: string;
  feedback?: string;
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
}

export interface HRTask {
  id: string;
  title: string;
  assignee: string;
  assigneeAvatar: string;
  dueDate: string;
  priority: "Cao" | "Trung bình" | "Thấp";
  status: "todo" | "doing" | "done";
  category: "Onboarding" | "Đào tạo" | "Tuyển dụng" | "Văn hóa";
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
