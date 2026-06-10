export type CRMSubTabType = "PHỄU KHÁCH HÀNG" | "OMNI-INBOX CHAT";

export interface ChatMessage {
  id: string;
  sender: "user" | "ai" | "agent";
  text: string;
  timestamp: Date;
  status?: "sent" | "delivered" | "read";
  attachments?: Array<{
    type: string;
    url: string;
  }>;
}

export interface ChatPagination {
  limit: number;
  hasMore: boolean;
  nextBefore: string | null;
  loadingMore: boolean;
}

export interface CustomerInbox {
  id: string;
  recipientId?: string;
  name: string;
  avatar: string;
  avatarUrl?: string;
  lastMessage: string;
  time: string;
  unreadCount: number;
  isVip: boolean;
  status: "online" | "offline";
  tags: string[];
  channel?: "facebook" | "zalo";
}

export interface AIChatConfig {
  autoClassify: boolean;
  autoCloseDeal: boolean;
  autoFeedback: boolean;
  replyDelay: number; // in seconds
  advancedInstructions: string;
}

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
