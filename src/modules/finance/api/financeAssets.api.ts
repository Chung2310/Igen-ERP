import { getAccessToken } from "../../../services/authService";
import { parseApiErrorResponse } from "../../../services/apiClientError";

export type FixedAssetStatus = "in_use" | "idle" | "disposed";
export type AssetDepreciationStatus = "planned" | "posted";
export type AssetInventoryResult = "pending" | "present" | "damaged" | "missing" | "surplus";
export type AssetInventorySessionStatus = "open" | "finalized";

export interface AssetLifecycleEvent {
  type: "created" | "updated" | "transferred" | "disposed";
  at: string;
  by: string;
  note?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}

export interface FixedAsset {
  _id: string;
  branchId: string;
  assetCode: string;
  barcode: string;
  name: string;
  group: string;
  originalCost: number;
  salvageValue: number;
  purchaseDate?: string;
  inServiceDate: string;
  usefulLifeMonths: number;
  location?: string;
  custodianId?: string;
  custodianName?: string;
  status: FixedAssetStatus;
  accumulatedDepreciation: number;
  netBookValue: number;
  disposedAt?: string;
  disposalAmount?: number;
  disposalReason?: string;
  lifecycleEvents: AssetLifecycleEvent[];
}

export interface DepreciationScheduleLine { period: string; amount: number; accumulatedAfter: number; netBookValueAfter: number }
export interface AssetDepreciation {
  _id: string;
  assetId: string;
  period: string;
  amount: number;
  accumulatedAfter: number;
  netBookValueAfter: number;
  status: AssetDepreciationStatus;
  postedAt?: string;
  postedBy?: string;
}

export interface AssetInventoryItem {
  assetId?: string;
  assetCode: string;
  barcode: string;
  name: string;
  expectedBranchId: string;
  expectedLocation?: string;
  expectedCustodianName?: string;
  result: AssetInventoryResult;
  scannedAt?: string;
  scannedBy?: string;
  note?: string;
}

export interface AssetInventorySession {
  _id: string;
  sessionCode: string;
  name: string;
  scope: "company" | "branch";
  branchIds: string[];
  inventoryDate: string;
  status: AssetInventorySessionStatus;
  openedAt: string;
  finalizedAt?: string;
  items: AssetInventoryItem[];
}

export interface AssetInventoryVariance {
  total: number;
  counts: Partial<Record<AssetInventoryResult, number>>;
  variances: AssetInventoryItem[];
}

export interface AssetListQuery { status?: string; group?: string; search?: string }
export interface AssetCreateInput {
  assetCode: string;
  barcode: string;
  name: string;
  group: string;
  originalCost: number;
  salvageValue?: number;
  purchaseDate?: string;
  inServiceDate: string;
  usefulLifeMonths: number;
  location?: string;
  custodianId?: string;
  custodianName?: string;
}

async function request<T>(base: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/v1/finance/${base}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAccessToken() || ""}`, ...(init?.headers || {}) },
  });
  if (!response.ok) throw await parseApiErrorResponse(response);
  const payload = await response.json();
  return payload.data as T;
}

const assets = <T,>(path: string, init?: RequestInit) => request<T>("assets", path, init);
const inventories = <T,>(path: string, init?: RequestInit) => request<T>("asset-inventories", path, init);
const post = (body: unknown) => ({ method: "POST", body: JSON.stringify(body) });

function toQueryString(query: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (value) params.set(key, value);
  const search = params.toString();
  return search ? `?${search}` : "";
}

export const financeAssetsApi = {
  list(query: AssetListQuery = {}) { return assets<FixedAsset[]>(toQueryString(query as Record<string, string | undefined>)); },
  detail(id: string) { return assets<FixedAsset>(`/${encodeURIComponent(id)}`); },
  schedule(id: string) { return assets<DepreciationScheduleLine[]>(`/${encodeURIComponent(id)}/schedule`); },
  create(input: AssetCreateInput) { return assets<FixedAsset>("", post(input)); },
  update(id: string, input: Record<string, unknown>) { return assets<FixedAsset>(`/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(input) }); },
  transfer(id: string, input: { branchId: string; location?: string; custodianId?: string; custodianName?: string; reason: string }) {
    return assets<FixedAsset>(`/${encodeURIComponent(id)}/transfer`, post(input));
  },
  dispose(id: string, input: { disposedAt: string; disposalAmount: number; reason: string }) {
    return assets<FixedAsset>(`/${encodeURIComponent(id)}/disposal`, post(input));
  },
  listDepreciations(period: string) { return assets<AssetDepreciation[]>(`/depreciations?period=${encodeURIComponent(period)}`); },
  runDepreciation(period: string) { return assets<{ period: string; planned: number; lines: AssetDepreciation[] }>("/depreciations/run", post({ period })); },
  postDepreciation(period: string) { return assets<{ period: string; posted: number; lines: AssetDepreciation[] }>("/depreciations/post", post({ period })); },
};

export const financeAssetInventoriesApi = {
  list(status?: string) { return inventories<AssetInventorySession[]>(toQueryString({ status })); },
  detail(id: string) { return inventories<AssetInventorySession>(`/${encodeURIComponent(id)}`); },
  variance(id: string) { return inventories<AssetInventoryVariance>(`/${encodeURIComponent(id)}/variance`); },
  open(input: { sessionCode: string; name: string; scope: "company" | "branch"; branchIds: string[]; inventoryDate: string }) {
    return inventories<AssetInventorySession>("", post(input));
  },
  count(id: string, input: { barcode: string; result: Exclude<AssetInventoryResult, "pending" | "missing">; note?: string }) {
    return inventories<AssetInventorySession>(`/${encodeURIComponent(id)}/counts`, post(input));
  },
  finalize(id: string) { return inventories<{ session: AssetInventorySession; variance: AssetInventoryVariance }>(`/${encodeURIComponent(id)}/finalize`, post({})); },
};
