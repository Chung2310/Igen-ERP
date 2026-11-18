import type { LeadIntakeField } from "./lead-intake";

export const CHAT_TEST_MAX_IMAGES = 3;
export const CHAT_TEST_MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export interface ChatTestSession {
  id: string;
  label: string;
  channel: "facebook" | "zalo";
  createdAt: string;
  pending: boolean;
  fields: LeadIntakeField[];
  ocrEnabled: boolean;
  provider?: string;
  sourceAccountId?: string;
  directLeadWrites?: boolean;
  documentDomain?: "general" | "telecom";
}

export interface ChatTestMessage {
  id: string;
  text: string;
  reply: string;
  status: "pending" | "processing" | "completed" | "failed";
  hasImage: boolean;
  imageCount?: number;
  fileName?: string;
  createdAt: string;
  latencyMs?: number;
  phase?: string;
  error?: string;
  ocr?: { status: string; issue?: string; values: Record<string, string>; leadId?: string };
}

export interface CreateChatTestSession {
  documentDomain?: "general" | "telecom";
  channel: "facebook" | "zalo";
  sourceAccountId?: string;
  ocrEnabled: boolean;
  provider?: string;
  contractFieldKey?: string;
}
