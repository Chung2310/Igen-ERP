export const FIXED_ASSET_STATUSES = ["in_use", "idle", "disposed"] as const;
export type FixedAssetStatus = typeof FIXED_ASSET_STATUSES[number];

export const ASSET_DEPRECIATION_STATUSES = ["planned", "posted"] as const;
export type AssetDepreciationStatus = typeof ASSET_DEPRECIATION_STATUSES[number];

export const ASSET_INVENTORY_SESSION_STATUSES = ["open", "finalized"] as const;
export type AssetInventorySessionStatus = typeof ASSET_INVENTORY_SESSION_STATUSES[number];
export const ASSET_INVENTORY_RESULTS = ["pending", "present", "damaged", "missing", "surplus"] as const;
export type AssetInventoryResult = typeof ASSET_INVENTORY_RESULTS[number];

export interface IAssetLifecycleEvent {
  type: "created" | "updated" | "transferred" | "disposed";
  at: Date;
  by: string;
  note?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}

export interface IFixedAsset {
  companyCode: string;
  branchId: string;
  assetCode: string;
  barcode: string;
  name: string;
  group: string;
  originalCost: number;
  salvageValue: number;
  purchaseDate?: Date;
  inServiceDate: Date;
  usefulLifeMonths: number;
  method: "straight_line";
  location?: string;
  custodianId?: string;
  custodianName?: string;
  status: FixedAssetStatus;
  accumulatedDepreciation: number;
  netBookValue: number;
  disposedAt?: Date;
  disposalAmount?: number;
  disposalReason?: string;
  lifecycleEvents: IAssetLifecycleEvent[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IAssetDepreciation {
  companyCode: string;
  branchId: string;
  assetId: string;
  period: string;
  amount: number;
  accumulatedAfter: number;
  netBookValueAfter: number;
  status: AssetDepreciationStatus;
  postedAt?: Date;
  postedBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IAssetInventoryItem {
  assetId?: string;
  assetCode: string;
  barcode: string;
  name: string;
  expectedBranchId: string;
  expectedLocation?: string;
  expectedCustodianId?: string;
  expectedCustodianName?: string;
  result: AssetInventoryResult;
  scannedAt?: Date;
  scannedBy?: string;
  note?: string;
}

export interface IAssetInventorySession {
  companyCode: string;
  sessionCode: string;
  name: string;
  scope: "company" | "branch";
  branchIds: string[];
  inventoryDate: Date;
  createdBy: string;
  openedAt: Date;
  finalizedBy?: string;
  finalizedAt?: Date;
  status: AssetInventorySessionStatus;
  items: IAssetInventoryItem[];
  createdAt?: Date;
  updatedAt?: Date;
}
