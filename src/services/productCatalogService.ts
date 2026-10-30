import { apiFetch } from "../modules/shared/lib/apiFetch";

export type ProductCatalogType = "physical" | "service" | "bundle";
export type ProductCatalogStatus = "draft" | "active" | "inactive" | "archived";
export type ProductTrackingMode = "none" | "quantity" | "unit_barcode" | "lot" | "serial";
export type ProductResourceKind = "categories" | "brands" | "units" | "attributes";

export type ProductAttributeValue = { code: string; value: string; unitCode?: string };
export type ProductTemplateField = {
  code: string;
  label: string;
  type: "text" | "number" | "boolean" | "select" | "multi-select";
  required: boolean;
  options: string[];
  unitCode?: string;
};

export type ProductTemplate = {
  _id: string;
  code: string;
  name: string;
  productType: ProductCatalogType;
  fields: ProductTemplateField[];
  status: "active" | "inactive";
};

export type ProductResource = {
  _id: string;
  code: string;
  name: string;
  status: "active" | "inactive";
  parentCode?: string;
  defaultTrackingMode?: ProductTrackingMode;
  symbol?: string;
  category?: "count" | "weight" | "volume" | "length" | "time" | "other";
  type?: "text" | "number" | "boolean" | "select" | "multi-select";
  options?: string[];
  description?: string;
};

export type ProductVariant = {
  _id: string;
  sku: string;
  barcode?: string;
  displayName?: string;
  unitCode: string;
  trackingMode: ProductTrackingMode;
  status: "active" | "inactive" | "discontinued";
  optionValues: Array<{ code: string; value: string }>;
  weightGrams?: number;
  lengthMm?: number;
  widthMm?: number;
  heightMm?: number;
  warrantyMonths?: number;
  supplierWarrantyMonths?: number;
  mediaIds?: string[];
};

export type CatalogProduct = {
  _id: string;
  productCode: string;
  name: string;
  productType: ProductCatalogType;
  templateCode?: string;
  categoryCode: string;
  brandCode?: string;
  baseUnitCode: string;
  shortDescription?: string;
  description?: string;
  attributes?: ProductAttributeValue[];
  status: ProductCatalogStatus;
  manufacturer?: string;
  countryOfOrigin?: string;
  taxCategory?: string;
  warrantyMonths?: number;
  mediaIds: string[];
  documentIds: string[];
};

export type CatalogProductDetail = CatalogProduct & { variants: ProductVariant[] };

export type ProductInput = {
  productCode?: string;
  name: string;
  productType: ProductCatalogType;
  templateCode?: string;
  categoryCode: string;
  brandCode?: string;
  baseUnitCode: string;
  shortDescription?: string;
  description?: string;
  attributes?: ProductAttributeValue[];
  manufacturer?: string;
  countryOfOrigin?: string;
  taxCategory?: string;
  warrantyMonths?: number;
  mediaIds?: string[];
  documentIds?: string[];
  status: ProductCatalogStatus;
};

export type VariantInput = {
  sku: string;
  barcode?: string;
  displayName?: string;
  unitCode: string;
  trackingMode: ProductTrackingMode;
  status: "active" | "inactive" | "discontinued";
  optionValues?: Array<{ code: string; value: string }>;
  weightGrams?: number;
  lengthMm?: number;
  widthMm?: number;
  heightMm?: number;
  warrantyMonths?: number;
  supplierWarrantyMonths?: number;
  mediaIds?: string[];
  sellingPrice?: number;
  costPrice?: number;
};

type ApiEnvelope<T> = { success: boolean; data: T };
type ListResult<T> = { items: T[]; total: number; page: number; limit: number };

const root = "/inventory/catalog";
import { getAccessToken } from "./authService";

// In-Memory Resource Cache & Invalidation System
interface ResourceCacheEntry {
  data: ProductResource[];
  timestamp: number;
}

const RESOURCE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes TTL
const resourcesCache = new Map<ProductResourceKind, ResourceCacheEntry>();
const inFlightResourceRequests = new Map<ProductResourceKind, Promise<ProductResource[]>>();

export type ResourceChangeEvent = {
  kind: ProductResourceKind;
  action: "create" | "update" | "delete";
  item?: any;
};

type ResourceChangeListener = (event: ResourceChangeEvent) => void;
const resourceChangeListeners = new Set<ResourceChangeListener>();

export function subscribeResourceChanges(listener: ResourceChangeListener): () => void {
  resourceChangeListeners.add(listener);
  return () => {
    resourceChangeListeners.delete(listener);
  };
}

function notifyResourceChange(kind: ProductResourceKind, action: "create" | "update" | "delete", item?: any) {
  // 1. Invalidate cache for this kind immediately
  resourcesCache.delete(kind);
  // 2. Notify all subscribers
  const event: ResourceChangeEvent = { kind, action, item };
  resourceChangeListeners.forEach((listener) => {
    try {
      listener(event);
    } catch (err) {
      console.error("[ResourceSync] listener error:", err);
    }
  });
}

function stripCatalogVariantPricing<T extends Record<string, any>>(variant: T): T {
  if (!variant || typeof variant !== "object") return variant;
  const { sellingPrice: _s, costPrice: _c, price: _p, ...clean } = variant;
  return clean as T;
}

export const productCatalogService = {
  async uploadMedia(file: File) {
    const base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });

    const response = await fetch("/api/v1/media/upload", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getAccessToken()}`,
      },
      body: JSON.stringify({
        file: base64Data,
        // Catalog saves URL strings, without a managed-upload finalization token.
        // Use permanent media storage so the pending-upload purge cannot delete saved images.
        folder: "igen_erp/inventory/products",
        fileName: file.name,
        mimeType: file.type,
        size: file.size,
      }),
    });

    if (!response.ok) {
      throw new Error("Lỗi tải tệp lên server.");
    }

    const data = await response.json();
    return data.url as string;
  },

  async listProducts(params: { q?: string; status?: string; productType?: string; categoryCode?: string; brandCode?: string; page?: number; limit?: number } = {}) {
    const result = await apiFetch<ApiEnvelope<ListResult<CatalogProduct>>>(`${root}/products`, { params });
    return result.data;
  },

  async getProduct(id: string) {
    const result = await apiFetch<ApiEnvelope<CatalogProductDetail>>(`${root}/products/${id}`);
    return result.data;
  },

  async createProduct(input: ProductInput & { variant: VariantInput }) {
    const payload = {
      ...input,
      variant: stripCatalogVariantPricing(input.variant),
    };
    const result = await apiFetch<ApiEnvelope<CatalogProductDetail>>(`${root}/products`, { method: "POST", body: JSON.stringify(payload) });
    return result.data;
  },

  async bulkCreateWithVariants(input: ProductInput & { variants: VariantInput[] }) {
    const payload = {
      ...input,
      variants: (input.variants || []).map(stripCatalogVariantPricing),
    };
    const result = await apiFetch<ApiEnvelope<CatalogProductDetail>>(`${root}/products/bulk-create-with-variants`, { method: "POST", body: JSON.stringify(payload) });
    return result.data;
  },

  async updateProduct(id: string, input: Partial<ProductInput> & { brandCode?: string | null }) {
    const result = await apiFetch<ApiEnvelope<CatalogProductDetail>>(`${root}/products/${id}`, { method: "PATCH", body: JSON.stringify(input) });
    return result.data;
  },

  async deleteProduct(id: string) {
    const result = await apiFetch<ApiEnvelope<void>>(`${root}/products/${id}`, { method: "DELETE" });
    return result.data;
  },

  async createVariant(productId: string, input: VariantInput) {
    const payload = stripCatalogVariantPricing(input);
    const result = await apiFetch<ApiEnvelope<ProductVariant>>(`${root}/products/${productId}/variants`, { method: "POST", body: JSON.stringify(payload) });
    return result.data;
  },

  async createVariants(productId: string, variants: VariantInput[]) {
    const payload = (variants || []).map(stripCatalogVariantPricing);
    const result = await apiFetch<ApiEnvelope<ProductVariant[]>>(`${root}/products/${productId}/variants/bulk`, { method: "POST", body: JSON.stringify({ variants: payload }) });
    return result.data;
  },

  async updateVariant(id: string, input: Partial<VariantInput>) {
    const payload = stripCatalogVariantPricing(input);
    const result = await apiFetch<ApiEnvelope<ProductVariant>>(`${root}/variants/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
    return result.data;
  },
  async upsertPrice(variantId: string, sellingPrice: number, costPrice = 0, branchId?: string) {
    const result = await apiFetch<ApiEnvelope<any>>(`${root}/prices/${variantId}`, { method: "PUT", body: JSON.stringify({ sellingPrice, costPrice, branchId }) });
    return result.data;
  },
  async listPrices() {
    const result = await apiFetch<ApiEnvelope<{ items: Array<{ variantId: string; sellingPrice: number; costPrice?: number }> }>>(`${root}/prices`);
    return result.data.items;
  },

  async updateVariants(ids: string[], changes: Partial<Pick<ProductVariant, "status" | "trackingMode">>) {
    const result = await apiFetch<ApiEnvelope<ProductVariant[]>>(`${root}/variants/bulk`, { method: "PATCH", body: JSON.stringify({ ids, changes }) });
    return result.data;
  },

  async deleteVariants(ids: string[]) {
    const result = await apiFetch<ApiEnvelope<{ deletedIds: string[] }>>(`${root}/variants/bulk`, { method: "DELETE", body: JSON.stringify({ ids }) });
    return result.data;
  },


  async listResources(kind: ProductResourceKind, options: { forceRefresh?: boolean } = {}) {
    const now = Date.now();
    if (!options.forceRefresh) {
      const cached = resourcesCache.get(kind);
      if (cached && now - cached.timestamp < RESOURCE_CACHE_TTL_MS) {
        return cached.data;
      }
      const inFlight = inFlightResourceRequests.get(kind);
      if (inFlight) {
        return inFlight;
      }
    }

    const fetchPromise = (async () => {
      try {
        const result = await apiFetch<ApiEnvelope<ProductResource[]>>(`${root}/resources/${kind}`, { params: { status: "active" } });
        const data = result.data || [];
        resourcesCache.set(kind, { data, timestamp: Date.now() });
        return data;
      } finally {
        inFlightResourceRequests.delete(kind);
      }
    })();

    inFlightResourceRequests.set(kind, fetchPromise);
    return fetchPromise;
  },

  invalidateResourceCache(kind?: ProductResourceKind) {
    if (kind) {
      resourcesCache.delete(kind);
    } else {
      resourcesCache.clear();
    }
  },

  async createResource(kind: ProductResourceKind, input: Record<string, unknown>) {
    const result = await apiFetch<ApiEnvelope<ProductResource>>(`${root}/resources/${kind}`, { method: "POST", body: JSON.stringify(input) });
    notifyResourceChange(kind, "create", result.data);
    return result.data;
  },

  async updateResource(kind: ProductResourceKind, id: string, input: Record<string, unknown>) {
    const result = await apiFetch<ApiEnvelope<ProductResource>>(`${root}/resources/${kind}/${id}`, { method: "PATCH", body: JSON.stringify(input) });
    notifyResourceChange(kind, "update", result.data);
    return result.data;
  },

  async deleteResource(kind: ProductResourceKind, id: string) {
    const result = await apiFetch<ApiEnvelope<{ deletedId: string }>>(`${root}/resources/${kind}/${id}`, { method: "DELETE" });
    notifyResourceChange(kind, "delete", { deletedId: id });
    return result.data;
  },

  async listTemplates() {
    const result = await apiFetch<ApiEnvelope<ProductTemplate[]>>(`${root}/templates`, { params: { status: "active" } });
    return result.data;
  },

  async createTemplate(input: { code?: string; name: string; productType: ProductCatalogType; fields: ProductTemplateField[] }) {
    const result = await apiFetch<ApiEnvelope<ProductTemplate>>(`${root}/templates`, { method: "POST", body: JSON.stringify(input) });
    return result.data;
  },

  async updateTemplate(id: string, input: Partial<{ name: string; fields: ProductTemplateField[]; status: "active" | "inactive" }>) {
    const result = await apiFetch<ApiEnvelope<ProductTemplate>>(`${root}/templates/${id}`, { method: "PATCH", body: JSON.stringify(input) });
    return result.data;
  },

  async seedDefaults() {
    const result = await apiFetch<ApiEnvelope<any>>(`${root}/resources/seed/defaults`, { method: "POST" });
    return result.data;
  },
};
