import type { AssistantChartHistoryItem } from "../shared/assistant-chart";
import type { AssistantSlideHistoryItem } from "../shared/assistant-slide";
import type { AssistantSpeechHistoryItem } from "./assistantSpeechHistory";
import type { AssistantStudioTranscript } from "./assistantService";

export type AssistantStudioCreationKind = "create-image" | "infographic" | "edit-image" | "mindmap";

export interface AssistantStudioCreationRecord {
  id: string;
  userId: string;
  kind: AssistantStudioCreationKind;
  title: string;
  summary: string;
  prompt: string;
  createdAt: string;
  payload: unknown;
}

export type AssistantStudioHistoryEntry = {
  id: string;
  kind: AssistantStudioCreationKind | "chart" | "transcription" | "speech" | "slide";
  label: string;
  title: string;
  summary: string;
  createdAt: string;
  payload: unknown;
};

const databaseName = "igen-erp-ai-studio";
const databaseVersion = 2;
const speechStoreName = "speech-history";
const creationStoreName = "creation-history";
const maxCreationHistoryItems = 30;
const maxCreationHistoryBytes = 80 * 1024 * 1024;

export function openAssistantStudioDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("Trình duyệt không hỗ trợ lưu lịch sử AI Studio."));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, databaseVersion);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(speechStoreName)) {
        const store = database.createObjectStore(speechStoreName, { keyPath: "id" });
        store.createIndex("userId", "userId");
        store.createIndex("createdAt", "createdAt");
      }
      if (!database.objectStoreNames.contains(creationStoreName)) {
        const store = database.createObjectStore(creationStoreName, { keyPath: "id" });
        store.createIndex("userId", "userId");
        store.createIndex("createdAt", "createdAt");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Không mở được lịch sử AI Studio."));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("Không lưu được lịch sử AI Studio."));
    transaction.onabort = () => reject(transaction.error || new Error("Lưu lịch sử AI Studio đã bị hủy."));
  });
}

export async function listAssistantStudioCreationHistory(userId: string): Promise<AssistantStudioCreationRecord[]> {
  const database = await openAssistantStudioDatabase();
  const transaction = database.transaction(creationStoreName, "readonly");
  const request = transaction.objectStore(creationStoreName).index("userId").getAll(userId) as IDBRequest<AssistantStudioCreationRecord[]>;
  const items = await new Promise<AssistantStudioCreationRecord[]>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error || new Error("Không tải được lịch sử AI Studio."));
  });
  return items.sort((first, second) => second.createdAt.localeCompare(first.createdAt));
}

export async function saveAssistantStudioCreationHistory(input: Omit<AssistantStudioCreationRecord, "id" | "createdAt">): Promise<AssistantStudioCreationRecord> {
  const database = await openAssistantStudioDatabase();
  const record: AssistantStudioCreationRecord = {
    ...input,
    id: typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    createdAt: new Date().toISOString(),
  };
  const transaction = database.transaction(creationStoreName, "readwrite");
  transaction.objectStore(creationStoreName).put(record);
  await transactionDone(transaction);

  const items = await listAssistantStudioCreationHistory(input.userId);
  let storedBytes = 0;
  const expiredIds: string[] = [];
  items.forEach((item, index) => {
    const itemBytes = new Blob([JSON.stringify(item.payload)]).size;
    if (index >= maxCreationHistoryItems || storedBytes + itemBytes > maxCreationHistoryBytes) expiredIds.push(item.id);
    else storedBytes += itemBytes;
  });
  if (expiredIds.length) {
    const pruneTransaction = database.transaction(creationStoreName, "readwrite");
    const store = pruneTransaction.objectStore(creationStoreName);
    expiredIds.forEach((id) => store.delete(id));
    await transactionDone(pruneTransaction);
  }
  return record;
}

export function combineAssistantStudioHistory(input: {
  creations: AssistantStudioCreationRecord[];
  charts: AssistantChartHistoryItem[];
  slides: AssistantSlideHistoryItem[];
  transcripts: AssistantStudioTranscript[];
  speech: AssistantSpeechHistoryItem[];
}): AssistantStudioHistoryEntry[] {
  const entries: AssistantStudioHistoryEntry[] = [
    ...input.creations.map((item) => ({
      id: `${item.kind}:${item.id}`,
      kind: item.kind,
      label: item.kind === "create-image" ? "Tạo ảnh" : item.kind === "infographic" ? "Tạo graphic" : item.kind === "mindmap" ? "Tạo Mindmap" : "Chỉnh sửa ảnh",
      title: item.title,
      summary: item.summary,
      createdAt: item.createdAt,
      payload: item,
    })),
    ...input.charts.map((item) => ({
      id: `chart:${item.id}`,
      kind: "chart" as const,
      label: "Tạo biểu đồ",
      title: item.title,
      summary: `${item.fileName} · ${item.chartType}${item.summary ? ` · ${item.summary}` : ""}`,
      createdAt: item.createdAt,
      payload: item,
    })),
    ...input.slides.map((item) => ({
      id: `slide:${item.id}`,
      kind: "slide" as const,
      label: "Tạo slide",
      title: item.title,
      summary: `${item.slideCount} trang${item.sourceFileName ? ` · ${item.sourceFileName}` : item.subtitle ? ` · ${item.subtitle}` : ""}`,
      createdAt: item.createdAt,
      payload: item,
    })),
    ...input.transcripts.map((item) => ({
      id: `transcription:${item.id}`,
      kind: "transcription" as const,
      label: "Chép lời",
      title: item.fileName,
      summary: item.text.slice(0, 180),
      createdAt: item.createdAt,
      payload: item,
    })),
    ...input.speech.map((item) => ({
      id: `speech:${item.id}`,
      kind: "speech" as const,
      label: "Tạo audio",
      title: item.text.replace(/\s+/g, " ").slice(0, 72) || "Audio đã tạo",
      summary: `Giọng ${item.voiceName}`,
      createdAt: item.createdAt,
      payload: item,
    })),
  ];
  return entries.sort((first, second) => second.createdAt.localeCompare(first.createdAt));
}
