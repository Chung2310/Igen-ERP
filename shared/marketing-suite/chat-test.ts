import type { LeadIntakeField } from "./lead-intake";

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
