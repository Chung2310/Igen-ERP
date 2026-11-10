export interface AssistantSpeechHistoryItem {
  id: string;
  userId: string;
  text: string;
  voiceName: string;
  audio: Blob;
  createdAt: string;
}

const databaseName = "igen-erp-ai-studio";
const storeName = "speech-history";
const maxHistoryItems = 20;
const maxHistoryBytes = 50 * 1024 * 1024;

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("Trình duyệt không hỗ trợ lưu lịch sử audio."));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(storeName)) {
        const store = database.createObjectStore(storeName, { keyPath: "id" });
        store.createIndex("userId", "userId");
        store.createIndex("createdAt", "createdAt");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Không mở được kho lịch sử audio."));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("Không lưu được lịch sử audio."));
    transaction.onabort = () => reject(transaction.error || new Error("Lưu lịch sử audio đã bị hủy."));
  });
}

export function getAssistantSpeechHistoryUserId(): string {
  const token = localStorage.getItem("accessToken");
  const payloadPart = token?.split(".")[1];
  if (!payloadPart) return "browser";
  try {
    const payload = JSON.parse(atob(payloadPart.replace(/-/g, "+").replace(/_/g, "/"))) as Record<string, unknown>;
    const id = payload.id ?? payload.userId ?? payload.sub;
    return typeof id === "string" && id ? id : "browser";
  } catch {
    return "browser";
  }
}

export async function listAssistantSpeechHistory(userId: string): Promise<AssistantSpeechHistoryItem[]> {
  const database = await openDatabase();
  const transaction = database.transaction(storeName, "readonly");
  const request = transaction.objectStore(storeName).index("userId").getAll(userId) as IDBRequest<AssistantSpeechHistoryItem[]>;
  const items = await new Promise<AssistantSpeechHistoryItem[]>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error || new Error("Không tải được lịch sử audio."));
  });
  return items.sort((first, second) => second.createdAt.localeCompare(first.createdAt));
}

export async function saveAssistantSpeechHistory(input: Omit<AssistantSpeechHistoryItem, "id" | "createdAt">): Promise<AssistantSpeechHistoryItem> {
  const database = await openDatabase();
  const record: AssistantSpeechHistoryItem = {
    ...input,
    id: typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    createdAt: new Date().toISOString(),
  };
  const transaction = database.transaction(storeName, "readwrite");
  transaction.objectStore(storeName).put(record);
  await transactionDone(transaction);

  const items = await listAssistantSpeechHistory(input.userId);
  let storedBytes = 0;
  const expiredIds: string[] = [];
  items.forEach((item, index) => {
    if (index >= maxHistoryItems || storedBytes + item.audio.size > maxHistoryBytes) expiredIds.push(item.id);
    else storedBytes += item.audio.size;
  });
  if (expiredIds.length) {
    const pruneTransaction = database.transaction(storeName, "readwrite");
    const store = pruneTransaction.objectStore(storeName);
    expiredIds.forEach((id) => store.delete(id));
    await transactionDone(pruneTransaction);
  }

  return record;
}
