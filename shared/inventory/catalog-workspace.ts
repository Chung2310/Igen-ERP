export const INVENTORY_WORKSPACE_MODES = ["goods", "services", "mixed"] as const;
export type InventoryWorkspaceMode = (typeof INVENTORY_WORKSPACE_MODES)[number];
export type CatalogKind = Exclude<InventoryWorkspaceMode, "mixed">;

export interface CatalogWorkspaceSettings {
  mode: InventoryWorkspaceMode;
  configured: boolean;
  hasSerial: boolean;
}

export interface CatalogBranchSummary {
  sellingPriceMin: number | null;
  sellingPriceMax: number | null;
  availableStock: number | null;
}
