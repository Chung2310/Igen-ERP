import type { RetailScope } from "../types";
export type RetailOfflineStatus = "pending" | "syncing" | "failed" | "synced" | "revoked";
export interface RetailOfflineOrder {
  id: string;
  companyCode: string;
  branchId: string;
  userId: string;
  idempotencyKey: string;
  payload: unknown;
  status: RetailOfflineStatus;
  attempts: number;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}
export type OfflineScope = RetailScope & { userId: string };
export interface RetailOfflineQueue {
  put(item: RetailOfflineOrder): Promise<void>;
  list(scope: OfflineScope): Promise<RetailOfflineOrder[]>;
  claimNext(scope: OfflineScope): Promise<RetailOfflineOrder | null>;
  update(id: string, patch: Partial<RetailOfflineOrder>): Promise<void>;
  remove(id: string): Promise<void>;
}
const matches = (item: RetailOfflineOrder, scope: OfflineScope) =>
  item.companyCode === scope.companyCode &&
  item.branchId === scope.branchId &&
  item.userId === scope.userId;
export function createRetailOfflineOrder(
  scope: OfflineScope,
  payload: unknown,
  idempotencyKey: string,
  now = new Date(),
): RetailOfflineOrder {
  const timestamp = now.toISOString();
  return {
    id: crypto.randomUUID(),
    ...scope,
    idempotencyKey,
    payload,
    status: "pending",
    attempts: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}
export function createMemoryRetailOfflineQueue(): RetailOfflineQueue {
  const items = new Map<string, RetailOfflineOrder>();
  return {
    async put(item) {
      items.set(item.id, structuredClone(item));
    },
    async list(scope) {
      return [...items.values()]
        .filter((x) => matches(x, scope))
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map((x) => structuredClone(x));
    },
    async claimNext(scope) {
      const item = [...items.values()]
        .filter(
          (x) =>
            matches(x, scope) && x.status === "pending",
        )
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
      if (!item) return null;
      item.status = "syncing";
      item.attempts++;
      item.updatedAt = new Date().toISOString();
      return structuredClone(item);
    },
    async update(id, patch) {
      const item = items.get(id);
      if (!item) throw new Error("Không tìm thấy yêu cầu thanh toán đã lưu.");
      if (item)
        items.set(id, {
          ...item,
          ...patch,
          idempotencyKey: item.idempotencyKey,
          updatedAt: new Date().toISOString(),
        });
    },
    async remove(id) {
      items.delete(id);
    },
  };
}

export function createIndexedDbRetailOfflineQueue(
  factory: IDBFactory = indexedDB,
): RetailOfflineQueue {
  const db = new Promise<IDBDatabase>((resolve, reject) => {
    const request = factory.open("igen-retail-offline", 1);
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore("orders", {
        keyPath: "id",
      });
      store.createIndex("scope", [
        "companyCode",
        "branchId",
        "userId",
        "createdAt",
      ]);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  const request = <T>(value: IDBRequest<T>) =>
    new Promise<T>((resolve, reject) => {
      value.onsuccess = () => resolve(value.result);
      value.onerror = () => reject(value.error);
    });
  const transaction = async <T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => Promise<T>): Promise<T> => {
    const tx = (await db).transaction("orders", mode);
    const done = new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error || new Error("Không lưu được yêu cầu thanh toán."));
      tx.onerror = () => reject(tx.error || new Error("Lỗi lưu yêu cầu thanh toán."));
    });
    void done.catch(() => undefined);
    try {
      const result = await work(tx.objectStore("orders"));
      await done;
      return result;
    } catch (error) {
      try { tx.abort(); } catch { /* transaction already finished */ }
      await done.catch(() => undefined);
      throw error;
    }
  };
  return {
    async put(item) { await transaction("readwrite", async store => { await request(store.put(item)); }); },
    async list(scope) {
      const all = await transaction("readonly", store => request(store.getAll())) as RetailOfflineOrder[];
      return all.filter(x => matches(x, scope)).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },
    async claimNext(scope) {
      return transaction("readwrite", async store => {
        const all = await request(store.getAll()) as RetailOfflineOrder[];
        const item = all.filter(x => matches(x, scope) && x.status === "pending").sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
        if (!item) return null;
        const claimed = { ...item, status: "syncing" as const, attempts: item.attempts + 1, updatedAt: new Date().toISOString() };
        await request(store.put(claimed));
        return claimed;
      });
    },
    async update(id, patch) {
      await transaction("readwrite", async store => {
        const item = await request(store.get(id)) as RetailOfflineOrder | undefined;
        if (!item) throw new Error("Không tìm thấy yêu cầu thanh toán đã lưu.");
        await request(store.put({ ...item, ...patch, id: item.id, companyCode: item.companyCode, branchId: item.branchId, userId: item.userId, idempotencyKey: item.idempotencyKey, updatedAt: new Date().toISOString() }));
      });
    },
    async remove(id) { await transaction("readwrite", async store => { await request(store.delete(id)); }); },
  };
}
