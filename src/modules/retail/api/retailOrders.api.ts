import { apiFetch } from "../../shared/lib/apiFetch";
import type { RetailOrder, RetailOrderResult, RetailPaymentInput, RetailPaymentQr, RetailScope } from "../types";
export const retailOrdersApi = {
  async list(scope: RetailScope, query: Record<string, string | number | boolean | undefined> = {}) { const response = await apiFetch<{ success: true; data: { items: RetailOrder[]; total: number; page: number; limit: number } }>("/retail/orders", { params: { ...scope, ...query } }); return response.data; },
  async detail(scope: RetailScope, id: string) { const response = await apiFetch<{ success: true; data: RetailOrder }>(`/retail/orders/${id}`, { params: scope }); return response.data; },
  async paymentQr(scope: RetailScope, id: string) { const response = await apiFetch<{ success: true; data: RetailPaymentQr }>(`/retail/orders/${id}/payment-qr`, { params: scope }); return response.data; },
  async quote(scope: RetailScope, input: unknown) { const response = await apiFetch<{ success: true; data: any }>("/retail/orders/quote", { method: "POST", params: scope, body: JSON.stringify(input) }); return response.data; },
  async createDraft(scope: RetailScope, input: unknown) { const response = await apiFetch<{ success: true; data: RetailOrder }>("/retail/orders", { method: "POST", params: scope, body: JSON.stringify(input) }); return response.data; },
  async updateDraft(scope: RetailScope, id: string, input: unknown) { const response = await apiFetch<{ success: true; data: RetailOrder }>(`/retail/orders/${id}`, { method: "PATCH", params: scope, body: JSON.stringify(input) }); return response.data; },
  async confirm(scope: RetailScope, id: string, input: { expectedGrandTotal: number; payments: RetailPaymentInput[]; idempotencyKey: string }) { const response = await apiFetch<{ success: true; data: RetailOrderResult }>(`/retail/orders/${id}/confirm`, { method: "POST", params: scope, body: JSON.stringify(input) }); return response.data; },
  async collect(scope: RetailScope, id: string, payments: RetailPaymentInput[]) { const response = await apiFetch<{ success: true; data: RetailOrder }>(`/retail/orders/${id}/payments`, { method: "POST", params: scope, body: JSON.stringify({ payments }) }); return response.data; },
  async cancel(scope: RetailScope, id: string, input: unknown) { const response = await apiFetch<{ success: true; data: RetailOrder }>(`/retail/orders/${id}/cancel`, { method: "POST", params: scope, body: JSON.stringify(input) }); return response.data; },
  async deleteCancelled(scope: RetailScope, id: string) { const response = await apiFetch<{ success: true; data: { id: string } }>(`/retail/orders/${id}`, { method: "DELETE", params: scope }); return response.data; },
  async idempotency(scope: RetailScope, key: string) { const response = await apiFetch<{ success: true; data: any }>(`/retail/orders/idempotency/${encodeURIComponent(key)}`, { params: scope }); return response.data; },
};
