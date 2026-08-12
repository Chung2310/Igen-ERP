import { apiFetch } from "../../shared/lib/apiFetch";
import type { RetailReceivableEntry, RetailScope } from "../types";

const params = (scope: RetailScope) => ({ companyCode: scope.companyCode, branchId: scope.branchId });
export const retailReceivablesApi = {
  async history(scope: RetailScope, customerId: string, query: { type?: string; from?: string; to?: string; page?: number; limit?: number } = {}) {
    const response = await apiFetch<{ success: true; data: { items: RetailReceivableEntry[]; total: number; page: number; limit: number; currentBalance: number } }>(`/retail/receivables/customers/${customerId}`, { params: { ...params(scope), ...query } });
    return response.data;
  },
  async adjust(scope: RetailScope, input: { customerId: string; orderId?: string; amount: number; reason: string; direction: "increase" | "decrease"; idempotencyKey: string }) {
    const response = await apiFetch<{ success: true; data: RetailReceivableEntry }>("/retail/receivables/adjustments", { method: "POST", params: params(scope), body: JSON.stringify(input) });
    return response.data;
  },
  async reverse(scope: RetailScope, entryId: string, reason: string) {
    const response = await apiFetch<{ success: true; data: RetailReceivableEntry }>(`/retail/receivables/${entryId}/reversal`, { method: "POST", params: params(scope), body: JSON.stringify({ reason }) });
    return response.data;
  },
};
