import type { AssistantSettings, AssistantReply, AssistantWorkflow, AssistantWorkflowUpdate, AssistantTableAttachment, AssistantTrainingContentForm } from "../shared/assistant-workflow";
export interface AssistantTurnInput { conversationId: string; requestId: string; mode?: "work" | "qa"; text?: string; attachment?: AssistantTableAttachment; referenceSelections?: Record<string, string[]>; skipReferenceKeys?: string[]; trainingContent?: AssistantTrainingContentForm; decision?: { id: string; confirmed: boolean; password?: string }; }
export interface AssistantConversationSummary { conversationId: string; mode?: "work" | "qa"; title: string; preview: string; messageCount: number; updatedAt: string; }
export interface AssistantConversationCursor { before: string; beforeId: string; }
export interface AssistantConversationPage { items: AssistantConversationSummary[]; nextCursor: AssistantConversationCursor | null; }
export interface AssistantMemory { id: string; content: string; source?: "explicit" | "manual" | "automatic"; createdAt: string; updatedAt: string; }
async function request<T>(path: string, init: RequestInit = {}, branchId?: string, deviceId?: string): Promise<T> {
  const token = localStorage.getItem("accessToken");
  const response = await fetch(`/api/v1/chatbot/assistant${path}`, { ...init, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(branchId ? { "x-branch-id": branchId } : {}), ...(deviceId ? { "x-device-id": deviceId } : {}), ...init.headers } });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.success) throw new Error(result.message || "Không thể kết nối trợ lý AI.");
  return result.data;
}
export const assistantService = {
  settings: (signal?: AbortSignal) => request<AssistantSettings>("/settings", { signal }),
  saveSettings: (data: AssistantSettings) => request<AssistantSettings>("/settings", { method: "PATCH", body: JSON.stringify(data) }),
  memories: (signal?: AbortSignal) => request<AssistantMemory[]>("/memory", { signal }),
  createMemory: (content: string) => request<{ item: AssistantMemory; created: boolean }>("/memory", { method: "POST", body: JSON.stringify({ content }) }),
  updateMemory: (id: string, content: string) => request<AssistantMemory>(`/memory/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ content }) }),
  deleteMemory: (id: string) => request<{ deleted: boolean }>(`/memory/${encodeURIComponent(id)}`, { method: "DELETE" }),
  workflows: (signal?: AbortSignal) => request<AssistantWorkflow[]>("/workflows", { signal }),
  interpretWorkflow: (id: string, data: { version: number; text: string }, signal?: AbortSignal) => request<AssistantWorkflow>(`/workflows/${encodeURIComponent(id)}/interpret`, { method: "POST", body: JSON.stringify(data), signal }),
  saveWorkflow: (id: string, data: AssistantWorkflowUpdate) => request<AssistantWorkflow>(`/workflows/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(data) }),
  resetWorkflow: (id: string, version: number) => request<AssistantWorkflow>(`/workflows/${encodeURIComponent(id)}/reset`, { method: "POST", body: JSON.stringify({ version }) }),
  conversations: (cursor?: AssistantConversationCursor, signal?: AbortSignal, branchId?: string) => {
    const query = new URLSearchParams({ limit: "30", ...(cursor || {}) });
    return request<AssistantConversationPage>(`/conversations?${query.toString()}`, { signal }, branchId);
  },
  state: (id: string, signal?: AbortSignal, branchId?: string) => request<{ messages: { role: "user" | "assistant"; content: string }[]; lastReply: AssistantReply | null; busy: boolean; mode?: "work" | "qa"; requestId?: string }>(`/conversations/${encodeURIComponent(id)}`, { signal }, branchId),
  turn: (data: AssistantTurnInput, signal?: AbortSignal, branchId?: string, deviceId?: string) => request<AssistantReply>("/turns", { method: "POST", body: JSON.stringify(data), signal }, branchId, deviceId),
};
