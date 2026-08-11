import { apiFetch } from "../modules/shared/lib/apiFetch";

export type Supplier = { _id: string; code: string; name: string; taxCode?: string; phone?: string; email?: string; address?: string; paymentTerms?: string; notes?: string; status: "active" | "inactive" };
export type Warehouse = { _id: string; branchId: string; code: string; name: string; kind: string; isDefault: boolean; isActive: boolean };
export type InventoryBalance = { _id: string; warehouseId: string; productId: string; variantId?: string; sku: string; quantity: number; reservedQuantity: number; averageCost: number };
export type GoodsReceiptItem = { productId: string; variantId: string; sku?: string; productName?: string; quantity: number; unitCost: number; lineTotal?: number; note?: string };
export type GoodsReceipt = { _id: string; receiptCode: string; supplierId: string; supplierName: string; warehouseId: string; status: "draft" | "confirmed" | "cancelled"; receivedAt?: string; items: Array<GoodsReceiptItem & { sku: string; productName: string; lineTotal: number }>; subtotal: number; notes?: string; createdAt: string };
type Envelope<T> = { status: string; data: T };

const root = "/inventory";

export const inventoryReceivingService = {
  async listSuppliers(params: { q?: string; status?: string } = {}) { const result = await apiFetch<Envelope<Supplier[]>>(`${root}/receiving/suppliers`, { params }); return result.data; },
  async createSupplier(input: Partial<Supplier> & { name: string }) { const result = await apiFetch<Envelope<Supplier>>(`${root}/receiving/suppliers`, { method: "POST", body: JSON.stringify(input) }); return result.data; },
  async updateSupplier(id: string, input: Partial<Supplier>) { const result = await apiFetch<Envelope<Supplier>>(`${root}/receiving/suppliers/${id}`, { method: "PATCH", body: JSON.stringify(input) }); return result.data; },
  async deleteSupplier(id: string) { const result = await apiFetch<Envelope<Supplier>>(`${root}/receiving/suppliers/${id}`, { method: "DELETE" }); return result.data; },
  async listReceipts(params: { page?: number; limit?: number; status?: string } = {}) { const result = await apiFetch<Envelope<{ items: GoodsReceipt[]; total: number; page: number; limit: number }>>(`${root}/receiving/receipts`, { params }); return result.data; },
  async createReceipt(input: { supplierId: string; warehouseId?: string; receivedAt?: string; notes?: string; items: GoodsReceiptItem[] }) { const result = await apiFetch<Envelope<GoodsReceipt>>(`${root}/receiving/receipts`, { method: "POST", body: JSON.stringify(input) }); return result.data; },
  async confirmReceipt(id: string) { const result = await apiFetch<Envelope<GoodsReceipt>>(`${root}/receiving/receipts/${id}/confirm`, { method: "POST" }); return result.data; },
  async cancelReceipt(id: string, reason: string) { const result = await apiFetch<Envelope<GoodsReceipt>>(`${root}/receiving/receipts/${id}/cancel`, { method: "POST", body: JSON.stringify({ reason }) }); return result.data; },
  async listWarehouses() { const result = await apiFetch<Envelope<Warehouse[]>>(`${root}/warehouses`); return result.data; },
  async listBalances(warehouseId?: string) { const result = await apiFetch<Envelope<InventoryBalance[]>>(`${root}/warehouses/balances`, { params: { warehouseId } }); return result.data; },
};
