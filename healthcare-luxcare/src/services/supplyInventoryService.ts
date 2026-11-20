import { getAccessToken } from "./authService";
import type { InventoryDraft, InventoryDocumentStatus } from "../../shared/supply-inventory";
export interface InventoryProfile {
  baseUnit: string;
  precision: number;
  trackingMode: "lot" | "none";
  requiresExpiry: boolean;
  conversions: { unit: string; factor: string }[];
  version: number;
}
export interface InventoryCatalogItem {
  _id: string;
  name: string;
  code: string;
  unit: string;
  requiresExpiry?: boolean;
  profile: InventoryProfile | null;
}
export interface InventoryWarehouse {
  _id: string;
  name: string;
  canWrite: boolean;
}
export interface InventoryLine {
  supplyId: string;
  supplyName: string;
  supplyCode: string;
  baseUnit: string;
  precision: number;
  enteredUnit: string;
  enteredQuantity: string;
  quantityScaled: number;
  lotNumber: string;
  manufacturerKey: string;
  expiryDay: string;
  requestedLotId?: string;
  totalValueMinor?: number;
}
export interface InventoryDocument extends Omit<InventoryDraft, "lines"> {
  _id: string;
  number: string;
  status: InventoryDocumentStatus;
  revision: number;
  createdAt: string;
  postedAt?: string;
  createdBy: string;
  approvedBy?: string;
  postedBy?: string;
  decisionReason?: string;
  lines: InventoryLine[];
  history?: { _id: string; action: string; actorId: string; createdAt: string; reason?: string }[];
  movements?: { _id: string; supplyId: string; lotNumber: string; deltaQty: number; deltaValue?: number }[];
}
export interface InventoryBalance {
  _id: string;
  branchId: string;
  warehouseId: string;
  locationId: string;
  supplyId: string;
  lotId: string;
  containerId: string;
  quantityScaled: number;
  valueMinor?: number;
  quality: string;
  version: number;
  supply?: { name: string; code: string };
  warehouseName?: string;
  profile?: InventoryProfile;
  lot?: { lotNumber: string; manufacturerKey?: string; expiryDay: string; recalled: boolean; version?: number };
}
export interface InventoryPage<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
  businessDay?: string;
}
export type InventoryMode = "legacy" | "preparing" | "v2";
export class InventoryApiError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message);
  }
}
async function request<T>(branch: string, path: string, method = "GET", body?: unknown, key?: string): Promise<T> {
  const res = await fetch(`/api/v1/supply-inventory${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${getAccessToken()}`,
      "X-Branch-Id": branch,
      "Content-Type": "application/json",
      ...(key ? { "Idempotency-Key": key } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const json = await res.json();
  if (!res.ok) {
    const failure = json.error && typeof json.error === "object" ? json.error : json;
    throw new InventoryApiError(
      failure.message || `Không thể xử lý yêu cầu kho (HTTP ${res.status}).`,
      failure.code || "REQUEST_FAILED",
    );
  }
  return json.data;
}
export const supplyInventoryService = {
  state: (branch: string) => request<{ mode: InventoryMode }>(branch, "/state"),
  catalog: (branch: string, search = "", page = 1) =>
    request<InventoryPage<InventoryCatalogItem>>(branch, `/catalog?search=${encodeURIComponent(search)}&page=${page}`),
  warehouses: (branch: string) => request<InventoryWarehouse[]>(branch, "/warehouses"),
  documents: (branch: string, page = 1) =>
    request<InventoryPage<InventoryDocument>>(branch, `/documents?page=${page}&limit=20`),
  document: (branch: string, id: string) => request<InventoryDocument>(branch, `/documents/${id}`),
  balances: (branch: string, page = 1) =>
    request<InventoryPage<InventoryBalance>>(branch, `/balances?page=${page}&limit=20`),
  saveDraft: (branch: string, draft: InventoryDraft, key: string, existing?: InventoryDocument) =>
    request<InventoryDocument>(
      branch,
      existing ? `/documents/${existing._id}` : "/documents",
      existing ? "PATCH" : "POST",
      existing ? { ...draft, revision: existing.revision } : draft,
      key,
    ),
  action: (branch: string, doc: InventoryDocument, action: string, reason: string, key: string) =>
    request<InventoryDocument>(
      branch,
      `/documents/${doc._id}/${action}`,
      "POST",
      { revision: doc.revision, reason },
      key,
    ),
  profile: (branch: string, item: InventoryCatalogItem, profile: InventoryProfile) => {
    const { version, ...body } = profile;
    return request<InventoryProfile>(branch, `/profiles/${item._id}`, "PUT", {
      ...body,
      expectedVersion: item.profile?.version || 0,
    });
  },
};
