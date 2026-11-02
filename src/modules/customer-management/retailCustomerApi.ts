import { apiFetch } from "../shared/lib/apiFetch";

export type CustomerRetailScope = { companyCode: string; branchId: string };
export type CustomerPointPolicy = { enabled: boolean; earnVndPerPoint: number; redeemVndPerPoint: number; maxRedeemPercent: number; version: number };
export type CustomerPointEntry = { _id: string; type: string; points: number; balanceBefore?: number; balanceAfter: number; reason: string; createdAt: string; branchId?: string };
export type CustomerReceivableEntry = { _id: string; type: string; amount: number; signedAmount: number; runningBalance: number; reason?: string; orderId?: string; createdAt: string; createdByName?: string };

export const retailCustomerApi = {
  async pointPolicy(scope: CustomerRetailScope) {
    return (await apiFetch<{ success: true; data: CustomerPointPolicy }>("/retail/points/policy", { params: scope })).data;
  },
  async updatePointPolicy(scope: CustomerRetailScope, policy: CustomerPointPolicy) {
    return (await apiFetch<{ success: true; data: CustomerPointPolicy }>("/retail/points/policy", { method: "PUT", params: scope, body: JSON.stringify(policy) })).data;
  },
  async points(scope: CustomerRetailScope, customerId: string) {
    return (await apiFetch<{ success: true; data: { balance: number; totalEarned: number; totalRedeemed: number; ledger: CustomerPointEntry[] } }>(`/retail/points/customers/${customerId}`, { params: scope })).data;
  },
  async adjustPoints(scope: CustomerRetailScope, customerId: string, points: number, reason: string, idempotencyKey: string) {
    return apiFetch(`/retail/points/customers/${customerId}/adjust`, { method: "POST", params: scope, body: JSON.stringify({ points, reason, idempotencyKey }) });
  },
  async receivables(scope: CustomerRetailScope, customerId: string) {
    return (await apiFetch<{ success: true; data: { items: CustomerReceivableEntry[]; total: number; page: number; limit: number; currentBalance: number } }>(`/retail/receivables/customers/${customerId}`, { params: { ...scope, limit: 100 } })).data;
  },
};
