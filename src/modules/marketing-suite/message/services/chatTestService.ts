import { getAccessToken } from "../../shared/services/authService";
import type { LeadIntakeField, LeadCollectionStatus } from "../../../../../shared/marketing-suite/lead-intake";
import type { ChatTestSession, ChatTestMessage, CreateChatTestSession } from "../../../../../shared/marketing-suite/chat-test";
import type { AIChatConfig } from "../types/crm";

export interface ChatTestState {
  session: ChatTestSession;
  aiConfig: AIChatConfig;
  messages: ChatTestMessage[];
  leads: Array<{
    id: string; customerName: string; phone: string; email: string;
    answers?: Record<string, string>; intakeFields?: LeadIntakeField[]; collectionStatus?: LeadCollectionStatus;
  }>;
}
const root = "/api/v1/omni-inbox/chat-test";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(root + path, {
    ...options, headers: { Authorization: `Bearer ${getAccessToken()}`, ...options.headers },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || "Không kết nối được phiên thử nghiệm.");
  return result.data as T;
}

export const chatTestService = {
  list(signal?: AbortSignal) { return request<ChatTestSession[]>("", { signal }); },
  create(input: CreateChatTestSession) {
    return request<ChatTestSession>("", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  },
  read(id: string, signal?: AbortSignal) { return request<ChatTestState>(`/${id}`, { signal }); },
  send(id: string, clientMessageId: string, text: string, file?: File | File[]) {
    const body = new FormData();
    body.set("clientMessageId", clientMessageId);
    body.set("text", text);
    for (const image of Array.isArray(file) ? file : file ? [file] : []) body.append("image", image);
    return request<{ id: string }>(`/${id}/messages`, { method: "POST", body });
  },
  remove(id: string) { return request<void>(`/${id}`, { method: "DELETE" }); },
  createLead(id: string) { return request<{ id: string }>(`/${id}/lead`, { method: "POST" }); },
  retry(id: string, messageId: string) { return request<void>(`/${id}/messages/${messageId}/retry`, { method: "POST" }); },
  saveConfig(id: string, aiConfig: AIChatConfig) {
    return request<AIChatConfig>(`/${id}/config`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ aiConfig }) });
  },
  preview(id: string, message: string, images: string[]) {
    return request<{ text: string; isMock: boolean; mode: string; contextMatches: number }>(`/${id}/preview`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message, images }) });
  },
  async image(sessionId: string, messageId: string, signal: AbortSignal, index = 0) {
    const response = await fetch(`${root}/${sessionId}/messages/${messageId}/image${index ? `?index=${index}` : ""}`, {
      signal, headers: { Authorization: `Bearer ${getAccessToken()}` },
    });
    if (!response.ok) throw new Error("Không tải được ảnh thử nghiệm.");
    return response.blob();
  },
};
