import { apiFetch } from "../../shared/lib/apiFetch";
import type { RetailCustomer, RetailCustomerDetail, RetailCustomerTierHistory, RetailScope } from "../types";

type CustomerInput = Pick<RetailCustomer, "name" | "phone" | "email" | "address" | "notes">;
const params = (scope: RetailScope) => ({ companyCode: scope.companyCode, branchId: scope.branchId });

export const retailCustomersApi = {
  async list(scope: RetailScope, query: { q?: string; page?: number; limit?: number; tier?: string } = {}) {
    const response = await apiFetch<{ success: true; data: { items: RetailCustomer[]; total: number; page: number; limit: number } }>("/retail/customers", { params: { ...params(scope), ...query } });
    return response.data;
  },
  async create(input: CustomerInput, scope: RetailScope) {
    const response = await apiFetch<{ success: true; data: RetailCustomer }>("/retail/customers", { method: "POST", params: params(scope), body: JSON.stringify(input) });
    return response.data;
  },
  async update(id: string, input: CustomerInput, scope: RetailScope) {
    const response = await apiFetch<{ success: true; data: RetailCustomer }>(`/retail/customers/${id}`, { method: "PATCH", params: params(scope), body: JSON.stringify(input) });
    return response.data;
  },
  async detail(id: string, scope: RetailScope) {
    const response = await apiFetch<{ success: true; data: RetailCustomerDetail }>(`/retail/customers/${id}`, { params: params(scope) });
    return response.data;
  },
  async tierHistory(id: string, scope: RetailScope) {
    const response = await apiFetch<{ success: true; data: RetailCustomerTierHistory[] }>(`/retail/customers/${id}/tier-history`, { params: params(scope) });
    return response.data;
  },
  async overrideTier(id: string, input: { tierCode: string; reason: string; effectiveFrom: string; effectiveTo: string }, scope: RetailScope) {
    const response = await apiFetch<{ success: true; data: RetailCustomerTierHistory }>(`/retail/customers/${id}/tier-overrides`, { method: "POST", params: params(scope), body: JSON.stringify(input) });
    return response.data;
  },
  async tierSummary(scope: RetailScope, query: { from?: string; to?: string; tier?: string } = {}) {
    const response = await apiFetch<{ success: true; data: Array<{ tierCode: string; customerCount: number; netSales: number; orderCount: number; averageOrderFrequency: number }> }>("/retail/customers/tier-summary", { params: { ...params(scope), ...query } });
    return response.data;
  },
};
