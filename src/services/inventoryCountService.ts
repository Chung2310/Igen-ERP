import { apiFetch } from "../modules/shared/lib/apiFetch";
export type CountStatus = "draft" | "counting" | "pending_approval" | "completed" | "cancelled" | "conflict";
export type CountItem = { _id: string; productId: string; variantId?: string; sku: string; barcode?: string; productName: string; systemQuantity: number; countedQuantity: number; quantityDelta: number; note?: string };
export type InventoryCount = { _id: string; countCode: string; warehouseId: string; status: CountStatus; items: CountItem[]; createdAt: string };
type Envelope<T> = { status: string; data: T };
const root = "/inventory/counts";
const queueKey = "igen.inventory-count.pending";
type PendingUpdate = { id: string; itemId: string; countedQuantity: number };
function readQueue(): PendingUpdate[] { try { return JSON.parse(localStorage.getItem(queueKey) || "[]"); } catch { return []; } }
function writeQueue(items: PendingUpdate[]) { localStorage.setItem(queueKey, JSON.stringify(items)); }
export const inventoryCountService = {
  async list(warehouseId?: string) { return (await apiFetch<Envelope<InventoryCount[]>>(root, { params: warehouseId ? { warehouseId } : {} })).data; },
  async get(id: string) { return (await apiFetch<Envelope<InventoryCount>>(root + "/" + id)).data; },
  async create(warehouseId: string) { return (await apiFetch<Envelope<InventoryCount>>(root, { method: "POST", body: JSON.stringify({ warehouseId }) })).data; },
  async updateItem(id: string, itemId: string, countedQuantity: number) {
    try { return (await apiFetch<Envelope<InventoryCount>>(root + "/" + id + "/items/" + itemId, { method: "PATCH", body: JSON.stringify({ countedQuantity }) })).data; }
    catch (error) { if (!navigator.onLine) { const queue = readQueue().filter((item) => !(item.id === id && item.itemId === itemId)); queue.push({ id, itemId, countedQuantity }); writeQueue(queue); } throw error; }
  },
  async syncPending() {
    const pending = readQueue(); const remaining: PendingUpdate[] = [];
    for (const item of pending) { try { await this.updateItem(item.id, item.itemId, item.countedQuantity); } catch { remaining.push(item); } }
    writeQueue(remaining);
  },
  async start(id: string) { return (await apiFetch<Envelope<InventoryCount>>(root + "/" + id + "/start", { method: "POST" })).data; },
  async submit(id: string) { return (await apiFetch<Envelope<InventoryCount>>(root + "/" + id + "/submit", { method: "POST" })).data; },
  async approve(id: string) { return (await apiFetch<Envelope<InventoryCount>>(root + "/" + id + "/approve", { method: "POST" })).data; },
  async cancel(id: string) { return (await apiFetch<Envelope<InventoryCount>>(root + "/" + id + "/cancel", { method: "POST" })).data; },
};
