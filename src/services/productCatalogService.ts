import { apiFetch } from "../modules/shared/lib/apiFetch";

export type ProductCatalogType = "physical" | "service" | "bundle";
export type ProductCatalogStatus = "draft" | "active" | "inactive" | "archived";
export type ProductTrackingMode = "none" | "quantity" | "lot" | "serial";
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
  symbol?: string;
  category?: "count" | "weight" | "volume" | "length" | "time" | "other";
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
  weightGrams?: number;
  lengthMm?: number;
  widthMm?: number;
  heightMm?: number;
  warrantyMonths?: number;
  mediaIds?: string[];
};

type ApiEnvelope<T> = { success: boolean; data: T };
type ListResult<T> = { items: T[]; total: number; page: number; limit: number };

const root = "/inventory/catalog";
import { getAccessToken } from "./authService";

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
        sourceType: "inventory.product",
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

  async listProducts(params: { q?: string; status?: string; productType?: string; categoryCode?: string; page?: number; limit?: number } = {}) {
    const result = await apiFetch<ApiEnvelope<ListResult<CatalogProduct>>>(`${root}/products`, { params });
    return result.data;
  },

  async getProduct(id: string) {
    const result = await apiFetch<ApiEnvelope<CatalogProductDetail>>(`${root}/products/${id}`);
    return result.data;
  },

  async createProduct(input: ProductInput & { variant: VariantInput }) {
    const result = await apiFetch<ApiEnvelope<CatalogProductDetail>>(`${root}/products`, { method: "POST", body: JSON.stringify(input) });
    return result.data;
  },

  async bulkCreateWithVariants(input: ProductInput & { variants: VariantInput[] }) {
    const result = await apiFetch<ApiEnvelope<CatalogProductDetail>>(`${root}/products/bulk-create-with-variants`, { method: "POST", body: JSON.stringify(input) });
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
    const result = await apiFetch<ApiEnvelope<ProductVariant>>(`${root}/products/${productId}/variants`, { method: "POST", body: JSON.stringify(input) });
    return result.data;
  },

  async createVariants(productId: string, variants: VariantInput[]) {
    const result = await apiFetch<ApiEnvelope<ProductVariant[]>>(`${root}/products/${productId}/variants/bulk`, { method: "POST", body: JSON.stringify({ variants }) });
    return result.data;
  },

  async updateVariant(id: string, input: Partial<Omit<VariantInput, "sku">>) {
    const result = await apiFetch<ApiEnvelope<ProductVariant>>(`${root}/variants/${id}`, { method: "PATCH", body: JSON.stringify(input) });
    return result.data;
  },

  async updateVariants(ids: string[], changes: Partial<Pick<ProductVariant, "status" | "trackingMode">>) {
    const result = await apiFetch<ApiEnvelope<ProductVariant[]>>(`${root}/variants/bulk`, { method: "PATCH", body: JSON.stringify({ ids, changes }) });
    return result.data;
  },

  async deleteVariants(ids: string[]) {
    const result = await apiFetch<ApiEnvelope<{ deletedIds: string[] }>>(`${root}/variants/bulk`, { method: "DELETE", body: JSON.stringify({ ids }) });
    return result.data;
  },

  async listResources(kind: ProductResourceKind) {
    const result = await apiFetch<ApiEnvelope<ProductResource[]>>(`${root}/resources/${kind}`, { params: { status: "active" } });
    return result.data;
  },

  async createResource(kind: ProductResourceKind, input: Record<string, unknown>) {
    const result = await apiFetch<ApiEnvelope<ProductResource>>(`${root}/resources/${kind}`, { method: "POST", body: JSON.stringify(input) });
    return result.data;
  },

  async updateResource(kind: ProductResourceKind, id: string, input: Record<string, unknown>) {
    const result = await apiFetch<ApiEnvelope<ProductResource>>(`${root}/resources/${kind}/${id}`, { method: "PATCH", body: JSON.stringify(input) });
    return result.data;
  },

  async deleteResource(kind: "categories" | "brands", id: string) {
    const result = await apiFetch<ApiEnvelope<{ deletedId: string }>>(`${root}/resources/${kind}/${id}`, { method: "DELETE" });
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
};
