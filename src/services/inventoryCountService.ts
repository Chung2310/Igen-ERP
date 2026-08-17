import { apiFetch } from "../modules/shared/lib/apiFetch";
export type CountStatus = "draft" | "counting" | "pending_approval" | "completed" | "cancelled" | "conflict";
export type CountItem = { _id: string; productId: string; variantId?: string; sku: string; barcode?: string; productName: string; systemQuantity: number; countedQuantity: number; quantityDelta: number; note?: string };
export type InventoryCount = { _id: string; countCode: string; warehouseId: string; status: CountStatus; items: CountItem[]; createdAt: string };
type Envelope<T> = { status: string; data: T };
const root = "/inventory/counts";
export const inventoryCountService = {
  async create(warehouseId: string) { return (await apiFetch<Envelope<InventoryCount>>(root, { method: "POST", body: JSON.stringify({ warehouseId }) })).data; },
  async updateItem(id: string, itemId: string, countedQuantity: number) { return (await apiFetch<Envelope<InventoryCount>>(root + "/" + id + "/items/" + itemId, { method: "PATCH", body: JSON.stringify({ countedQuantity }) })).data; },
};
