import { apiFetch } from "../modules/shared/lib/apiFetch";

export type SerialUnitStatus = "in_stock" | "sold" | "returned" | "defective" | "repairing" | "scrapped";
export interface InventorySerialUnit { _id: string; companyCode: string; branchId: string; warehouseId?: string; productId: string; variantId?: string; sku: string; productName: string; internalBarcode: string; normalizedInternalBarcode: string; serialNumber: string; normalizedSerialNumber: string; status: SerialUnitStatus; supplierWarranty?: { startAt?: string; endAt?: string; supplierName?: string; months?: number }; currentDocumentType?: string; currentDocumentId?: string; createdAt: string; updatedAt: string }
export interface InventorySerialEvent { _id: string; serialUnitId: string; serialNumber: string; eventType: string; fromStatus?: SerialUnitStatus; toStatus: SerialUnitStatus; documentType?: string; documentId?: string; reason?: string; actorName: string; occurredAt: string }
type Envelope<T> = { status: "success"; data: T };
type ListResult = { items: InventorySerialUnit[]; total: number; page: number; limit: number };

const root = "/inventory/serials";

export const inventorySerialService = {
  async list(params: { serial?: string; sku?: string; warehouseId?: string; productId?: string; variantId?: string; trackingMode?: "serial" | "unit_barcode"; forSale?: boolean; status?: SerialUnitStatus; page?: number; limit?: number } = {}) {
    const result = await apiFetch<Envelope<ListResult>>(root, { params });
    return result.data;
  },
  async get(id: string) {
    const result = await apiFetch<Envelope<InventorySerialUnit>>(`${root}/${id}`);
    return result.data;
  },
  async history(id: string) {
    const result = await apiFetch<Envelope<InventorySerialEvent[]>>(`${root}/${id}/history`);
    return result.data;
  },
  async importBatch(input: { productId: string; variantId?: string; sku: string; productName: string; serialNumbers: string[]; warehouseId?: string }) {
    const result = await apiFetch<Envelope<InventorySerialUnit[]>>(root, { method: "POST", body: JSON.stringify(input) });
    return result.data;
  },
  async transition(id: string, input: { toStatus: SerialUnitStatus; eventType: string; reason?: string; documentType?: string; documentId?: string }) {
    const result = await apiFetch<Envelope<InventorySerialUnit>>(`${root}/${id}/transition`, { method: "POST", body: JSON.stringify(input) });
    return result.data;
  },
  async transfer(id: string, input: { toBranchId: string; toWarehouseId?: string; reason: string; documentType?: string; documentId?: string }) {
    const result = await apiFetch<Envelope<InventorySerialUnit>>(`${root}/${id}/transfer`, { method: "POST", body: JSON.stringify(input) });
    return result.data;
  },
};
