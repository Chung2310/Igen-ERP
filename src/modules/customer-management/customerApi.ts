import { apiFetch } from "../shared/lib/apiFetch";
import type { BillingProfile, BillingProfileInput, Customer, CustomerInput, CustomerLeadNeeds, CustomerListQuery, CustomerModule, CustomerModuleLinks, CustomerModuleRecord, CustomerPurchaseHistory, CustomerPurchaseHistoryScope, CustomerStatus, PaginatedCustomers } from "./types";
import type { CustomerTransactionDetail, CustomerTransactionFilter, CustomerTransactionRow, CustomerTransactionsResult } from '../../../shared/customer-transactions';
import type { CustomerSourceBatchRow, CustomerSourceCandidates, CustomerSourceLinkInput, CustomerSourceRef } from "./types";

export const customerApi = {
  async leadNeeds(id: string, companyCode: string, signal?: AbortSignal) {
    return (await apiFetch<{ data: CustomerLeadNeeds[] }>(`/customers/${id}/lead-needs`, { params: { companyCode }, signal })).data;
  },
  async moduleLinks(id: string, scope: CustomerPurchaseHistoryScope, signal?: AbortSignal) {
    return (await apiFetch<{ data: CustomerModuleLinks }>(`/customers/${id}/module-links`, { params: scope, signal })).data;
  },
  async linkedModules(scope: CustomerPurchaseHistoryScope, customerIds: string[], signal?: AbortSignal) {
    return (await apiFetch<{ data: Record<string, CustomerModule[]> }>("/customers/linked-modules", {
      params: { ...scope, customerIds: customerIds.join(",") }, signal,
    })).data;
  },
  async sourceRecords(module: CustomerModule, scope: CustomerPurchaseHistoryScope, q: string, signal?: AbortSignal) {
    return (await apiFetch<{ data: CustomerModuleRecord[] }>(`/customers/source-records/${module}`, { params: { ...scope, q }, signal })).data;
  },
  async sourceQueue(module: CustomerModule, scope: CustomerPurchaseHistoryScope, q: string, page: number, signal?: AbortSignal) {
    return (await apiFetch<{ data: { items: CustomerModuleRecord[]; hasMore: boolean } }>(`/customers/source-records/${module}/queue`, {
      params: { ...scope, q, page }, signal,
    })).data;
  },
  async sourceTransferSetting(module: CustomerModule, scope: CustomerPurchaseHistoryScope, signal?: AbortSignal) {
    return (await apiFetch<{ data: { hidden: boolean } }>(`/customers/source-transfer-settings/${module}`, { params: scope, signal })).data;
  },
  async setSourceTransferHidden(module: CustomerModule, scope: CustomerPurchaseHistoryScope, hidden: boolean) {
    return (await apiFetch<{ data: { hidden: boolean } }>(`/customers/source-transfer-settings/${module}`, {
      method: "PATCH", params: scope, body: JSON.stringify({ hidden }),
    })).data;
  },
  async sourceBatchPreview(scope: CustomerPurchaseHistoryScope, records: CustomerSourceRef[]) {
    return (await apiFetch<{ data: CustomerSourceBatchRow[] }>("/customers/source-records/batch/preview", {
      method: "POST", params: scope, body: JSON.stringify({ records }),
    })).data;
  },
  async sourceBatchTransfer(scope: CustomerPurchaseHistoryScope, records: CustomerSourceRef[], approved: CustomerSourceRef[]) {
    return (await apiFetch<{ data: CustomerSourceBatchRow[] }>("/customers/source-records/batch/transfer", {
      method: "POST", params: scope, body: JSON.stringify({ records, approved }),
    })).data;
  },
  async sourceCustomerCandidates(module: CustomerModule, sourceId: string, scope: CustomerPurchaseHistoryScope, q?: string, signal?: AbortSignal) {
    return (await apiFetch<{ data: CustomerSourceCandidates }>(`/customers/source-records/${module}/${encodeURIComponent(sourceId)}/customers`, { params: { ...scope, q }, signal })).data;
  },
  async importSourceRecord(module: CustomerModule, sourceId: string, scope: CustomerPurchaseHistoryScope, input: CustomerSourceLinkInput) {
    return (await apiFetch<{ data: Customer }>(`/customers/source-records/${module}/${encodeURIComponent(sourceId)}/customer`, {
      method: "POST", params: scope, body: JSON.stringify(input),
    })).data;
  },
  async moduleLinkCandidates(id: string, module: CustomerModule, scope: CustomerPurchaseHistoryScope & { q: string }) {
    return (await apiFetch<{ data: CustomerModuleRecord[] }>(`/customers/${id}/module-links/${module}/candidates`, { params: scope })).data;
  },
  async unlinkModuleRecord(id: string, module: CustomerModule, sourceId: string, scope: CustomerPurchaseHistoryScope) {
    await apiFetch(`/customers/${id}/module-links/${module}/${encodeURIComponent(sourceId)}`, { method: "DELETE", params: scope });
  },
  async linkModuleRecord(id: string, module: CustomerModule, sourceId: string, scope: CustomerPurchaseHistoryScope) {
    return (await apiFetch<{ data: CustomerModuleRecord }>(`/customers/${id}/module-links/${module}/${encodeURIComponent(sourceId)}`, { method: "PUT", params: scope })).data;
  },
  async transactions(id: string, scope: CustomerPurchaseHistoryScope, query: { type: CustomerTransactionFilter; from: string; to: string; page: number; limit: number }, signal?: AbortSignal) {
    return (await apiFetch<{ data: CustomerTransactionsResult }>(`/customers/${id}/transactions`, { params: { ...scope, ...query }, headers: { 'x-branch-id': scope.branchId }, signal })).data;
  },
  async transactionDetail(id: string, scope: CustomerPurchaseHistoryScope, row: CustomerTransactionRow, signal?: AbortSignal) {
    return (await apiFetch<{ data: CustomerTransactionDetail }>(`/customers/${id}/transactions/${row.kind}/${row.sourceId}`, { params: { ...scope, eventId: row.eventId }, headers: { 'x-branch-id': scope.branchId }, signal })).data;
  },
  async list(query: CustomerListQuery = {}) {
    const response = await apiFetch<{ success: true; data: PaginatedCustomers }>("/customers", { params: query });
    return response.data;
  },
  async searchActive(query: Pick<CustomerListQuery, "companyCode" | "q" | "limit">, signal?: AbortSignal) {
    const response = await apiFetch<{ success: true; data: Array<{ customerId: string; customerCode: string; name: string; phone: string; type: Customer["type"]; status: CustomerStatus; tier?: { code: string; name: string } }> }>("/customers/search", { params: query, signal });
    return response.data;
  },
  async detail(id: string, companyCode?: string, signal?: AbortSignal) {
    const response = await apiFetch<{ success: true; data: Customer }>(`/customers/${encodeURIComponent(id)}`, { params: { companyCode }, signal });
    return response.data;
  },
  async create(input: CustomerInput, companyCode?: string) {
    const response = await apiFetch<{ success: true; data: Customer }>("/customers", { method: "POST", params: { companyCode }, body: JSON.stringify(input) });
    return response.data;
  },
  async update(id: string, input: CustomerInput, version: number, companyCode?: string) {
    const response = await apiFetch<{ success: true; data: Customer }>(`/customers/${id}`, { method: "PATCH", params: { companyCode }, body: JSON.stringify({ ...input, version }) });
    return response.data;
  },
  async setStatus(id: string, status: CustomerStatus, version: number, companyCode?: string) {
    const response = await apiFetch<{ success: true; data: Customer }>(`/customers/${id}/${status === "active" ? "activate" : "deactivate"}`, { method: "POST", params: { companyCode }, body: JSON.stringify({ version }) });
    return response.data;
  },
  async billingProfiles(id: string, companyCode?: string) {
    const response = await apiFetch<{ success: true; data: BillingProfile[] }>(`/customers/${id}/billing-profiles`, { params: { companyCode } }); return response.data;
  },
  async createBillingProfile(id: string, input: BillingProfileInput, companyCode?: string) {
    const response = await apiFetch<{ success: true; data: { profile: BillingProfile; warnings: Array<{ code: string; message: string }> } }>(`/customers/${id}/billing-profiles`, { method: "POST", params: { companyCode }, body: JSON.stringify(input) }); return response.data;
  },
  async purchaseHistory(id: string, scope: CustomerPurchaseHistoryScope) {
    const response = await apiFetch<{ success: true; data: CustomerPurchaseHistory }>(`/customers/${id}/purchase-history`, { params: scope });
    return response.data;
  },
  async getSettings(companyCode: string) {
    const response = await apiFetch<{ success: true; data: { companyCode: string; customerTiers: Array<{ code: string; name: string; minGrossProfit?: number; minSpend?: number }> } }>("/customers/settings", { params: { companyCode } });
    return response.data;
  },
  async updateSettings(input: { customerTiers: Array<{ code: string; name: string; minGrossProfit: number }> }, companyCode: string) {
    const response = await apiFetch<{ success: true; data: { companyCode: string; customerTiers: Array<{ code: string; name: string; minGrossProfit: number; minSpend?: number }> } }>("/customers/settings", { method: "PATCH", params: { companyCode }, body: JSON.stringify(input) });
    return response.data;
  },
};
