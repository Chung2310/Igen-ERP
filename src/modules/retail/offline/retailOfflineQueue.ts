import type { RetailScope } from "../types";
export type RetailOfflineStatus = "pending" | "syncing" | "failed" | "synced";
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
  return {
    async put(item) {
      (await db)
        .transaction("orders", "readwrite")
        .objectStore("orders")
        .put(item);
    },
    async list(scope) {
      const all = (await request(
        (await db).transaction("orders").objectStore("orders").getAll(),
      )) as RetailOfflineOrder[];
      return all
        .filter((x) => matches(x, scope))
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },
    async claimNext(scope) {
      const database = await db,
        transaction = database.transaction("orders", "readwrite"),
        store = transaction.objectStore("orders"),
        all = (await request(store.getAll())) as RetailOfflineOrder[];
      const item = all
        .filter(
          (x) =>
            matches(x, scope) && x.status === "pending",
        )
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
      if (!item) return null;
      const claimed = {
        ...item,
        status: "syncing" as const,
        attempts: item.attempts + 1,
        updatedAt: new Date().toISOString(),
      };
      store.put(claimed);
      return claimed;
    },
    async update(id, patch) {
      const database = await db,
        transaction = database.transaction("orders", "readwrite"),
        store = transaction.objectStore("orders"),
        item = (await request(store.get(id))) as RetailOfflineOrder | undefined;
      if (item)
        store.put({
          ...item,
          ...patch,
          idempotencyKey: item.idempotencyKey,
          updatedAt: new Date().toISOString(),
        });
    },
    async remove(id) {
      (await db)
        .transaction("orders", "readwrite")
        .objectStore("orders")
        .delete(id);
    },
  };
}
