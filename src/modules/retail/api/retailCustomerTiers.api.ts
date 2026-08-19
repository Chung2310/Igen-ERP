import { apiFetch } from "../../shared/lib/apiFetch";
import type { RetailCustomerTierHistory, RetailScope } from "../types";

const params = (scope: RetailScope) => ({ companyCode: scope.companyCode, branchId: scope.branchId });

export const retailCustomerTiersApi = {
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
