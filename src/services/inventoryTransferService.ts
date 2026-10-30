import { apiFetch } from "../modules/shared/lib/apiFetch";
export interface TransferDestination { _id: string; branchId: string; branchName: string; name: string; code: string; isDefault: boolean }
export interface TransferLine { productId: string; variantId: string; sku: string; productName: string; quantity: number; unitCost: number; trackingMode: string; unitIdentifiers: string[]; serialUnitIds: string[] }
export interface InventoryTransfer { _id: string; transferCode: string; fromBranchId: string; fromWarehouseId: string; fromWarehouseName: string; toBranchId: string; toWarehouseId: string; toWarehouseName: string; status: "in_transit" | "received" | "cancelled"; items: TransferLine[]; reason: string; createdByName: string; createdAt: string; receivedByName?: string; receivedAt?: string; cancelledByName?: string; cancelReason?: string }
export interface TransferCreateInput { fromWarehouseId: string; toBranchId: string; toWarehouseId: string; reason: string; idempotencyKey: string; items: Array<{ productId: string; variantId: string; sku: string; quantity: number; unitIdentifiers: string[] }> }
type Envelope<T> = { data: T };
const root = "/inventory/transfers";
const headers = (branchId: string) => ({ "x-branch-id": branchId });
export const inventoryTransferService = {
  async destinations(branchId: string, signal?: AbortSignal) { return (await apiFetch<Envelope<TransferDestination[]>>(`${root}/destinations`, { headers: headers(branchId), signal })).data; },
  async list(branchId: string, page = 1, status = "", signal?: AbortSignal) { return (await apiFetch<Envelope<{ items: InventoryTransfer[]; page: number; limit: number; total: number }>>(root, { params: { page, status }, headers: headers(branchId), signal })).data; },
  async create(branchId: string, input: TransferCreateInput) { return (await apiFetch<Envelope<InventoryTransfer>>(root, { method: "POST", headers: headers(branchId), body: JSON.stringify(input) })).data; },
  async accept(branchId: string, id: string) { return (await apiFetch<Envelope<InventoryTransfer>>(`${root}/${id}/accept`, { method: "POST", headers: headers(branchId) })).data; },
  async cancel(branchId: string, id: string, reason: string) { return (await apiFetch<Envelope<InventoryTransfer>>(`${root}/${id}/cancel`, { method: "POST", headers: headers(branchId), body: JSON.stringify({ reason }) })).data; },
};
