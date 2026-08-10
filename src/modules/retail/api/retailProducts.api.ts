import { apiFetch } from "../../shared/lib/apiFetch";
import type { RetailProduct, RetailScope } from "../types";
export const retailProductsApi = { async list(scope: RetailScope, query: { q?: string; barcode?: string; page?: number; limit?: number } = {}) { const response = await apiFetch<{ success: true; data: { items: RetailProduct[]; total: number; page: number; limit: number } }>("/retail/orders/products", { params: { ...scope, ...query } }); return response.data; } };
