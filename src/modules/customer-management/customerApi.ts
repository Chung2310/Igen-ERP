import { apiFetch } from "../shared/lib/apiFetch";
import type { BillingProfile, BillingProfileInput, Customer, CustomerInput, CustomerListQuery, CustomerPurchaseHistory, CustomerPurchaseHistoryScope, CustomerStatus, PaginatedCustomers } from "./types";
import type { CustomerTransactionDetail, CustomerTransactionFilter, CustomerTransactionRow, CustomerTransactionsResult } from '../../../shared/customer-transactions';

export const customerApi = {
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
  async searchActive(query: Pick<CustomerListQuery, "companyCode" | "q" | "limit">) {
    const response = await apiFetch<{ success: true; data: Array<{ customerId: string; customerCode: string; name: string; phone: string; type: Customer["type"]; status: CustomerStatus; tier?: { code: string; name: string } }> }>("/customers/search", { params: query });
    return response.data;
  },
  async detail(id: string, companyCode?: string) {
    const response = await apiFetch<{ success: true; data: Customer }>(`/customers/${id}`, { params: { companyCode } });
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
    const response = await apiFetch<{ success: true; data: { companyCode: string; customerTiers: Array<{ code: string; name: string; minSpend: number }> } }>("/customers/settings", { params: { companyCode } });
    return response.data;
  },
  async updateSettings(input: { customerTiers: Array<{ code: string; name: string; minSpend: number }> }, companyCode: string) {
    const response = await apiFetch<{ success: true; data: { companyCode: string; customerTiers: Array<{ code: string; name: string; minSpend: number }> } }>("/customers/settings", { method: "PATCH", params: { companyCode }, body: JSON.stringify(input) });
    return response.data;
  },
};
