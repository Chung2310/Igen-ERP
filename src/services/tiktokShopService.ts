import { apiFetch } from "../modules/shared/lib/apiFetch";

export interface TikTokShopStatus {
  connected: boolean;
  connections: TikTokShopConnection[];
  shops: Array<{ cipher: string; id?: string; code?: string; name: string; region?: string; retailBranchId?: string }>;
}

export interface TikTokShopConnection {
  id: string;
  openId: string;
  shops: TikTokShopStatus["shops"];
  scopes: string[];
  connectedAt?: string;
  sync: {
    at?: string;
    status: "never" | "success" | "failed";
    error?: string;
    stats: { total: number; matched: number; unmatched: number };
  };
}

export interface TikTokShopProduct {
  _id: string;
  shopName: string;
  tiktokProductId: string;
  title: string;
  status: string;
  imageUrl?: string;
  detailsSyncStatus?: "pending" | "complete" | "incomplete" | "failed";
  detailsSyncedAt?: string;
  missingInfo?: string[];
  detailsSyncError?: string;
  description?: string;
  categoryName?: string;
  skus: Array<{
    skuId: string;
    sellerSku: string;
    barcode?: string;
    displayName?: string;
    optionValues?: Array<{ code: string; value: string }>;
    priceAmount: string;
    currency: string;
    inventoryQuantity: number;
    hasInventorySnapshot?: boolean;
    inventory?: Array<{ warehouseId: string; quantity: number }>;
    localProductId?: string;
    localVariantId?: string;
  }>;
  lastOutboundSyncAt?: string;
  lastOutboundSyncStatus?: "never" | "success" | "failed";
  lastOutboundSyncError?: string;
}

export interface TikTokOrderSyncBatch {
  batchId: string;
  shopsScanned: number;
  queued: number;
  errors: string[];
}

export interface TikTokOrderSyncProgress {
  batchId: string;
  total: number;
  processed: number;
  pending: number;
  failed: number;
  invoicesCreated: number;
  errors: string[];
}

export interface TikTokCatalogProduct {
  _id: string;
  productCode: string;
  name: string;
  description: string;
  mediaIds: string[];
  manufacturer: string;
  countryOfOrigin: string;
  attributes: Array<{ code: string; value: string; unitCode?: string }>;
  variants: Array<{
    _id: string;
    sku: string;
    barcode: string;
    displayName: string;
    optionValues: Array<{ code: string; value: string }>;
    weightGrams: number;
    lengthMm: number;
    widthMm: number;
    heightMm: number;
    imageUrls: string[];
    stock: number;
    sellingPrice: number;
    priceConflict: boolean;
  }>;
}

export interface TikTokListingAttribute {
  id: string;
  name: string;
  required: boolean;
  isSales: boolean;
  inputType: string;
  values: Array<{ id: string; name: string }>;
}

const unwrap = <T,>(response: { data: T }) => response.data;

export const tiktokShopApi = {
  status: () => apiFetch<{ data: TikTokShopStatus }>("/integrations/tiktok-shop/status").then(unwrap),
  orderBranches: () => apiFetch<{ data: Array<{ _id: string; code: string; name: string }> }>("/integrations/tiktok-shop/order-branches").then(unwrap),
  orderBranch: () => apiFetch<{ data: { branchId: string } }>("/integrations/tiktok-shop/order-branch").then(unwrap),
  setOrderBranch: (branchId: string) => apiFetch<{ data: { branchId: string } }>("/integrations/tiktok-shop/order-branch", { method: "PATCH", body: JSON.stringify({ branchId }) }).then(unwrap),
  authorizationUrl: () => apiFetch<{ data: { authUrl: string } }>("/integrations/tiktok-shop/auth-url").then(unwrap),
  syncProducts: () => apiFetch<{ data: { total: number; matched: number; unmatched: number; connections: number; detailsSynced: number; complete: number; incomplete: number; detailFailed: number } }>("/integrations/tiktok-shop/sync-products", { method: "POST" }).then(unwrap),
  syncOrders: () => apiFetch<{ data: TikTokOrderSyncBatch }>("/integrations/tiktok-shop/sync-orders", { method: "POST" }).then(unwrap),
  orderSyncProgress: (batchId: string) => apiFetch<{ data: TikTokOrderSyncProgress }>(`/integrations/tiktok-shop/sync-orders/${encodeURIComponent(batchId)}`).then(unwrap),
  importProducts: (branchId?: string) => apiFetch<{ data: { products: number; createdProducts: number; createdVariants: number; linkedExisting: number; importedPrices: number; importedStock: number; failed: number; errors: string[] } }>("/integrations/tiktok-shop/import-products", { method: "POST", body: JSON.stringify({ ...(branchId ? { branchId } : {}) }) }).then(unwrap),
  syncInventoryAndPrices: (branchId?: string) => apiFetch<{ data: { products: number; skus: number; updated: number; skipped: number; pendingReviewSkipped: number; failed: number; errors: string[] } }>("/integrations/tiktok-shop/sync-inventory-prices", { method: "POST", body: JSON.stringify({ ...(branchId ? { branchId } : {}) }) }).then(unwrap),
  products: () => apiFetch<{ data: { items: TikTokShopProduct[]; total: number } }>("/integrations/tiktok-shop/products", { params: { pageSize: 100 } }).then(unwrap),
  catalogProducts: () => apiFetch<{ data: { items: TikTokCatalogProduct[] } }>("/integrations/tiktok-shop/catalog-products").then(unwrap),
  listingCategories: (connectionId: string, shopCipher: string) => apiFetch<{ data: { categories: Array<{ id: string; name: string; parentId: string }>; categoryVersion: string; currency: string; shop: { cipher: string; name: string; region: string } } }>("/integrations/tiktok-shop/listing/categories", { params: { connectionId, shopCipher } }).then(unwrap),
  listingWarehouses: (connectionId: string, shopCipher: string) => apiFetch<{ data: { warehouses: Array<{ id: string; name: string; type?: string }> } }>("/integrations/tiktok-shop/listing/warehouses", { params: { connectionId, shopCipher } }).then(unwrap),
  listingAttributes: (connectionId: string, shopCipher: string, categoryId: string) => apiFetch<{ data: { attributes: TikTokListingAttribute[] } }>(`/integrations/tiktok-shop/listing/categories/${encodeURIComponent(categoryId)}/attributes`, { params: { connectionId, shopCipher } }).then(unwrap),
  publishProduct: (input: Record<string, unknown>) => apiFetch<{ data: { created: boolean; linked: boolean; productId: string; status?: string; skus?: number; message?: string } }>("/integrations/tiktok-shop/listing/products", { method: "POST", body: JSON.stringify(input) }).then(unwrap),
  disconnect: (connectionId: string) => apiFetch<{ data: { disconnected: boolean } }>(`/integrations/tiktok-shop/connections/${encodeURIComponent(connectionId)}`, { method: "DELETE" }).then(unwrap),
};
