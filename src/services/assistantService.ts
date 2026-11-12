import type { AssistantSettings, AssistantReply, AssistantWorkflow, AssistantWorkflowUpdate, AssistantTableAttachment, AssistantTrainingContentForm } from "../shared/assistant-workflow";
import type { AssistantSpeechVoice } from "../shared/assistant-speech-voices";
import type { AssistantSpeechControls } from "../shared/assistant-speech";
import type { AssistantChatMessage, AssistantGeneratedFile } from "../shared/assistant-document";
import type { AssistantChartHistoryItem, AssistantChartResult, AssistantChartType } from "../shared/assistant-chart";
import type { AssistantSlideDeck, AssistantSlideDeckUpdate, AssistantSlideHistoryItem, AssistantSlideStyle } from "../shared/assistant-slide";
import type { AssistantMindmapLocale, AssistantMindmapResult, AssistantMindmapSourceType, AssistantMindmapWriteMode } from "../shared/assistant-mindmap";
import type { AssistantPromptTemplate } from "../components/common/assistant-prompt-library-data";
import type { AssistantProject } from "../components/common/assistant-project-data";
export interface AssistantTurnInput { conversationId: string; requestId: string; projectId?: string; mode?: "work" | "qa"; research?: boolean; text?: string; attachment?: AssistantTableAttachment; file?: File; referenceSelections?: Record<string, string[]>; skipReferenceKeys?: string[]; trainingContent?: AssistantTrainingContentForm; decision?: { id: string; confirmed: boolean; password?: string }; }
export interface AssistantConversationSummary { conversationId: string; mode?: "work" | "qa"; title: string; preview: string; messageCount: number; updatedAt: string; }
export interface AssistantConversationCursor { before: string; beforeId: string; }
export interface AssistantConversationPage { items: AssistantConversationSummary[]; nextCursor: AssistantConversationCursor | null; }
export interface AssistantMemory { id: string; content: string; source?: "explicit" | "manual" | "automatic"; createdAt: string; updatedAt: string; lastUsedAt?: string | null; }
export interface AssistantSessionMemory { summary: string; summaryMessageCount: number; version: number; messageCount: number; busy?: boolean; updatedAt?: string | null; }
export interface AssistantStudioTranscript { id: string; fileName: string; text: string; createdAt: string; }
export interface AssistantStudioMindmapRequest { sourceType: AssistantMindmapSourceType; prompt: string; locale: AssistantMindmapLocale; writeMode: AssistantMindmapWriteMode; file?: File; }
export class AssistantServiceError extends Error {
  constructor(message: string, public readonly status: number) { super(message); this.name = "AssistantServiceError"; }
}
async function request<T>(path: string, init: RequestInit = {}, branchId?: string, deviceId?: string): Promise<T> {
  const token = localStorage.getItem("accessToken");
  const response = await fetch(`/api/v1/chatbot/assistant${path}`, { ...init, headers: { ...(init.body instanceof FormData ? {} : { "Content-Type": "application/json" }), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(branchId ? { "x-branch-id": branchId } : {}), ...(deviceId ? { "x-device-id": deviceId } : {}), ...init.headers } });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.success) throw new AssistantServiceError(result.message || "Không thể kết nối trợ lý AI.", response.status);
  return result.data;
}
export const assistantService = {
  projects: (branchId?: string) => request<AssistantProject[]>("/projects", {}, branchId),
  saveProjects: (projects: AssistantProject[], branchId?: string) => request<AssistantProject[]>("/projects", { method: "PUT", body: JSON.stringify({ projects }) }, branchId),
  promptTemplates: (signal?: AbortSignal) => request<{ templates: AssistantPromptTemplate[]; favoriteIds: string[] }>("/prompt-templates", { signal }),
  createPromptTemplate: (data: Omit<AssistantPromptTemplate, "id" | "owner">) => request<AssistantPromptTemplate>("/prompt-templates", { method: "POST", body: JSON.stringify(data) }),
  setPromptTemplateFavorite: (id: string, favorite: boolean) => request<{ favorite: boolean }>(`/prompt-templates/${encodeURIComponent(id)}/favorite`, { method: "PATCH", body: JSON.stringify({ favorite }) }),
  createStudioSlideDeck: async (data: { prompt: string; pageCount: number; style: AssistantSlideStyle; file?: File }, signal?: AbortSignal): Promise<AssistantSlideDeck> => {
    if (!data.file) return request<AssistantSlideDeck>("/studio/slides", { method: "POST", body: JSON.stringify({ prompt: data.prompt, pageCount: data.pageCount, style: data.style }), signal });
    const form = new FormData();
    form.append("prompt", data.prompt);
    form.append("pageCount", String(data.pageCount));
    form.append("style", data.style);
    form.append("document", data.file);
    const token = localStorage.getItem("accessToken");
    const response = await fetch("/api/v1/chatbot/assistant/studio/slides", {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
      signal,
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.success) throw new Error(result.message || "Không thể tạo slide lúc này.");
    return result.data as AssistantSlideDeck;
  },
  studioSlideDecks: () => request<AssistantSlideHistoryItem[]>("/studio/slides"),
  studioSlideDeck: (id: string) => request<AssistantSlideDeck>(`/studio/slides/${encodeURIComponent(id)}`),
  updateStudioSlideDeck: (id: string, data: AssistantSlideDeckUpdate) => request<AssistantSlideDeck>(`/studio/slides/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(data) }),
  createStudioMindmap: async (data: AssistantStudioMindmapRequest): Promise<AssistantMindmapResult> => {
    const form = new FormData();
    form.append("sourceType", data.sourceType);
    form.append("prompt", data.prompt);
    form.append("locale", data.locale);
    form.append("writeMode", data.writeMode);
    if (data.file) form.append("document", data.file);
    const token = localStorage.getItem("accessToken");
    const response = await fetch("/api/v1/chatbot/assistant/studio/mindmaps", {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.success) throw new Error(result.message || "Không thể tạo mindmap lúc này.");
    return result.data as AssistantMindmapResult;
  },
  studioTranscripts: () => request<AssistantStudioTranscript[]>("/studio/transcriptions"),
  studioCharts: () => request<AssistantChartHistoryItem[]>("/studio/charts"),
  studioChart: (id: string) => request<AssistantChartResult>(`/studio/charts/${encodeURIComponent(id)}`),
  createStudioChart: async (file: File, prompt: string, chartType: AssistantChartType): Promise<AssistantChartResult> => {
    const form = new FormData();
    form.append("file", file);
    form.append("prompt", prompt);
    form.append("chartType", chartType);
    const token = localStorage.getItem("accessToken");
    const response = await fetch("/api/v1/chatbot/assistant/studio/charts", {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.success) throw new Error(result.message || "Không thể tạo biểu đồ từ tệp dữ liệu.");
    return result.data as AssistantChartResult;
  },
  editStudioChart: async (id: string, data: { request: string; title?: string; chartType?: AssistantChartType }): Promise<AssistantChartResult> =>
    request<AssistantChartResult>(`/studio/charts/${encodeURIComponent(id)}/edit`, { method: "POST", body: JSON.stringify(data) }),
  deleteStudioChart: (id: string) => request<{ deleted: boolean }>(`/studio/charts/${encodeURIComponent(id)}`, { method: "DELETE" }),
  extractSpeechDocument: async (file: File): Promise<{ fileName: string; text: string }> => {
    const form = new FormData();
    form.append("document", file);
    const token = localStorage.getItem("accessToken");
    const response = await fetch("/api/v1/chatbot/assistant/speech/document", {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.success) throw new Error(result.message || "Không thể đọc tệp tài liệu.");
    return result.data as { fileName: string; text: string };
  },
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
  state: (id: string, signal?: AbortSignal, branchId?: string) => request<{ messages: AssistantChatMessage[]; lastReply: AssistantReply | null; busy: boolean; mode?: "work" | "qa"; requestId?: string }>(`/conversations/${encodeURIComponent(id)}`, { signal }, branchId),
  turn: (data: AssistantTurnInput, signal?: AbortSignal, branchId?: string, deviceId?: string) => {
    if (!data.file) return request<AssistantReply>("/turns", { method: "POST", body: JSON.stringify(data), signal }, branchId, deviceId);
    const { file, ...payload } = data;
    const form = new FormData();
    form.append("payload", JSON.stringify(payload));
    form.append("file", file);
    return request<AssistantReply>("/turns", { method: "POST", body: form, signal }, branchId, deviceId);
  },
  downloadFile: async (file: AssistantGeneratedFile, branchId?: string, signal?: AbortSignal): Promise<Blob> => {
    const token = localStorage.getItem("accessToken");
    const response = await fetch(`/api/v1/chatbot/assistant/conversations/${encodeURIComponent(file.conversationId)}/files/${encodeURIComponent(file.id)}`, {
      signal,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(branchId ? { "x-branch-id": branchId } : {}) },
    });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(result.message || "Không thể tải tệp. Bạn thử lại nhé.");
    }
    if (response.headers.get("content-type")?.split(";")[0] !== file.mimeType.split(";")[0]) throw new Error("Máy chủ trả về định dạng tệp không hợp lệ.");
    return response.blob();
  },
  speech: async (text: string, signal?: AbortSignal, voice?: AssistantSpeechVoice, controls?: AssistantSpeechControls): Promise<Blob> => {
    const token = localStorage.getItem("accessToken");
    let response: Response;
    try {
      response = await fetch("/api/v1/chatbot/assistant/speech", {
        method: "POST",
        signal,
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ text, ...(voice ? { voice } : {}), ...(controls ? { controls } : {}) }),
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
