import { apiFetch } from "../../shared/lib/apiFetch";
import type { RetailProduct, RetailScope } from "../types";

export interface RetailOfficialCategory {
  code: string;
  name: string;
  parentCode?: string;
}

export const retailProductsApi = {
  async list(
    scope: RetailScope,
    query: { q?: string; barcode?: string; page?: number; limit?: number } = {},
  ) {
    const response = await apiFetch<{
      success: true;
      data: {
        items: RetailProduct[];
        total: number;
        page: number;
        limit: number;
        categories?: RetailOfficialCategory[];
      };
    }>("/retail/orders/products", { params: { ...scope, ...query } });
    return response.data;
  },

  async categories(scope: RetailScope) {
    const response = await apiFetch<{
      success: true;
      data: RetailOfficialCategory[];
    }>("/retail/orders/categories", { params: scope });
    return response.data;
  },
};
