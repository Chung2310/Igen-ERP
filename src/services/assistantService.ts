import type { AssistantSettings, AssistantReply, AssistantWorkflow, AssistantWorkflowUpdate, AssistantTableAttachment, AssistantTrainingContentForm } from "../shared/assistant-workflow";
import type { AssistantSpeechVoice } from "../shared/assistant-speech-voices";
export interface AssistantTurnInput { conversationId: string; requestId: string; mode?: "work" | "qa"; text?: string; attachment?: AssistantTableAttachment; referenceSelections?: Record<string, string[]>; skipReferenceKeys?: string[]; trainingContent?: AssistantTrainingContentForm; decision?: { id: string; confirmed: boolean; password?: string }; }
export interface AssistantConversationSummary { conversationId: string; mode?: "work" | "qa"; title: string; preview: string; messageCount: number; updatedAt: string; }
export interface AssistantConversationCursor { before: string; beforeId: string; }
export interface AssistantConversationPage { items: AssistantConversationSummary[]; nextCursor: AssistantConversationCursor | null; }
export interface AssistantMemory { id: string; content: string; source?: "explicit" | "manual" | "automatic"; createdAt: string; updatedAt: string; lastUsedAt?: string | null; }
export interface AssistantSessionMemory { summary: string; summaryMessageCount: number; version: number; messageCount: number; busy?: boolean; updatedAt?: string | null; }
export interface AssistantStudioTranscript { id: string; fileName: string; text: string; createdAt: string; }
async function request<T>(path: string, init: RequestInit = {}, branchId?: string, deviceId?: string): Promise<T> {
  const token = localStorage.getItem("accessToken");
  const response = await fetch(`/api/v1/chatbot/assistant${path}`, { ...init, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(branchId ? { "x-branch-id": branchId } : {}), ...(deviceId ? { "x-device-id": deviceId } : {}), ...init.headers } });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.success) throw new Error(result.message || "Không thể kết nối trợ lý AI.");
  return result.data;
}
export const assistantService = {
  studioTranscripts: () => request<AssistantStudioTranscript[]>("/studio/transcriptions"),
  transcribeStudioAudio: async (file: File): Promise<AssistantStudioTranscript> => {
    const form = new FormData();
    form.append("audio", file);
    const token = localStorage.getItem("accessToken");
    const response = await fetch("/api/v1/chatbot/assistant/studio/transcriptions", {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.success) throw new Error(result.message || "Không thể chuyển giọng nói thành văn bản.");
    return result.data as AssistantStudioTranscript;
  },
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
  sessionMemory: (id: string, signal?: AbortSignal, branchId?: string) => request<AssistantSessionMemory>(`/conversations/${encodeURIComponent(id)}/memory`, { signal }, branchId),
  saveSessionMemory: (id: string, summary: string, version: number, branchId?: string) => request<AssistantSessionMemory>(`/conversations/${encodeURIComponent(id)}/memory`, { method: "PATCH", body: JSON.stringify({ summary, version }) }, branchId),
  clearSessionMemory: (id: string, branchId?: string) => request<AssistantSessionMemory>(`/conversations/${encodeURIComponent(id)}/memory`, { method: "DELETE" }, branchId),
  deleteConversation: (id: string, branchId?: string) => request<{ deleted: boolean }>(`/conversations/${encodeURIComponent(id)}`, { method: "DELETE" }, branchId),
  state: (id: string, signal?: AbortSignal, branchId?: string) => request<{ messages: { role: "user" | "assistant"; content: string; createdAt?: string }[]; lastReply: AssistantReply | null; busy: boolean; mode?: "work" | "qa"; requestId?: string }>(`/conversations/${encodeURIComponent(id)}`, { signal }, branchId),
  turn: (data: AssistantTurnInput, signal?: AbortSignal, branchId?: string, deviceId?: string) => request<AssistantReply>("/turns", { method: "POST", body: JSON.stringify(data), signal }, branchId, deviceId),
  speech: async (text: string, signal?: AbortSignal, voice?: AssistantSpeechVoice): Promise<Blob> => {
    const token = localStorage.getItem("accessToken");
    let response: Response;
    try {
      response = await fetch("/api/v1/chatbot/assistant/speech", {
        method: "POST",
        signal,
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ text, ...(voice ? { voice } : {}) }),
      });
    } catch (error) {
      if (signal?.aborted) throw error;
      throw new Error("Không kết nối được dịch vụ tạo giọng nói. Hãy thử lại sau.");
    }
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(result.message || "Không thể tạo giọng nói lúc này.");
    }
    if (response.headers.get("content-type")?.split(";")[0] !== "audio/mpeg") {
      throw new Error("Máy chủ không trả về tệp âm thanh MP3 hợp lệ.");
    }
    return response.blob();
  },
};
