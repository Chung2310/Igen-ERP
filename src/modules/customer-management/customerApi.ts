import { apiFetch } from "../shared/lib/apiFetch";
import type { Customer, CustomerInput, CustomerListQuery, CustomerStatus, PaginatedCustomers } from "./types";

export const customerApi = {
  async list(query: CustomerListQuery = {}) {
    const response = await apiFetch<{ success: true; data: PaginatedCustomers }>("/customers", { params: query });
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
};
