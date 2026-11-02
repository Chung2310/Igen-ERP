import { apiFetch } from "../../shared/lib/apiFetch";
import type { RetailOrder, RetailOrderPaymentStatus, RetailOrderResult, RetailPaymentInput, RetailPaymentQr, RetailScope } from "../types";
export const retailOrdersApi = {
  async reconcileDraftRequest(scope: RetailScope, input: unknown) {
    const response = await apiFetch<{ success: true; data: any }>("/retail/orders/draft-requests/reconcile", { method: "POST", params: scope, body: JSON.stringify(input) }); return response.data;
  },
  async revokeDraftRequest(scope: RetailScope, input: unknown) {
    const response = await apiFetch<{ success: true; data: any }>("/retail/orders/draft-requests/revoke", { method: "POST", params: scope, body: JSON.stringify(input) }); return response.data;
  },
  async reconcileCheckout(scope: RetailScope, input: { idempotencyKey: string; payload: unknown }) {
    const response = await apiFetch<{ success: true; data: any }>("/retail/orders/checkout/reconcile", { method: "POST", params: scope, body: JSON.stringify(input) }); return response.data;
  },
  async revokeCheckout(scope: RetailScope, input: { idempotencyKey: string; payload: unknown }) {
    const response = await apiFetch<{ success: true; data: any }>("/retail/orders/checkout/revoke", { method: "POST", params: scope, body: JSON.stringify(input) }); return response.data;
  },
  async list(scope: RetailScope, query: Record<string, string | number | boolean | undefined> = {}) { const response = await apiFetch<{ success: true; data: { items: RetailOrder[]; total: number; page: number; limit: number } }>("/retail/orders", { params: { ...scope, ...query } }); return response.data; },
  async detail(scope: RetailScope, id: string) { const response = await apiFetch<{ success: true; data: RetailOrder }>(`/retail/orders/${id}`, { params: scope }); return response.data; },
  async paymentStatus(scope: RetailScope, id: string) { const response = await apiFetch<{ success: true; data: RetailOrderPaymentStatus }>(`/retail/orders/${id}/payment-status`, { params: scope }); return response.data; },
  async paymentQr(scope: RetailScope, id: string) { const response = await apiFetch<{ success: true; data: RetailPaymentQr }>(`/retail/orders/${id}/payment-qr`, { params: scope }); return response.data; },
  async quote(scope: RetailScope, input: unknown) { const response = await apiFetch<{ success: true; data: any }>("/retail/orders/quote", { method: "POST", params: scope, body: JSON.stringify(input) }); return response.data; },
  async checkout(scope: RetailScope, input: unknown) { const response = await apiFetch<{ success: true; data: RetailOrderResult }>("/retail/orders/checkout", { method: "POST", params: scope, body: JSON.stringify(input) }); return response.data; },
  async createDraft(scope: RetailScope, input: unknown) { const response = await apiFetch<{ success: true; data: RetailOrder }>("/retail/orders", { method: "POST", params: scope, body: JSON.stringify(input) }); return response.data; },
  async updateDraft(scope: RetailScope, id: string, input: unknown) { const response = await apiFetch<{ success: true; data: RetailOrder }>(`/retail/orders/${id}`, { method: "PATCH", params: scope, body: JSON.stringify(input) }); return response.data; },
  async confirm(scope: RetailScope, id: string, input: { expectedVersion: number; expectedGrandTotal: number; payments: RetailPaymentInput[]; idempotencyKey: string; posSessionId?: string }) { const response = await apiFetch<{ success: true; data: RetailOrderResult }>(`/retail/orders/${id}/confirm`, { method: "POST", params: scope, body: JSON.stringify(input) }); return response.data; },
  async revokeCollection(scope: RetailScope, id: string, input: { cashSessionId?: string; payments: RetailPaymentInput[]; idempotencyKey: string; expectedVersion: number }) {
    const response = await apiFetch<{ success: true; data: { status: "revoked"; message: string } }>(`/retail/orders/${id}/payments/revoke`, { method: "POST", params: scope, body: JSON.stringify(input) });
    return response.data;
  },
  async reconcileCollection(scope: RetailScope, id: string, input: { cashSessionId?: string; payments: RetailPaymentInput[]; idempotencyKey: string; expectedVersion: number }) {
    const response = await apiFetch<{ success: true; data: { status: "completed" | "not_found" | "processing" | "conflict" | "revoked"; message: string; order?: RetailOrder } }>(`/retail/orders/${id}/payments/reconcile`, { method: "POST", params: scope, body: JSON.stringify(input) });
    return response.data;
  },
  async collect(scope: RetailScope, id: string, payments: RetailPaymentInput[], request: { cashSessionId?: string; idempotencyKey: string; expectedVersion: number }) { const response = await apiFetch<{ success: true; data: RetailOrder }>(`/retail/orders/${id}/payments`, { method: "POST", params: scope, body: JSON.stringify({ payments, ...request }) }); return response.data; },
  async revokeCancellation(scope: RetailScope, id: string, input: unknown) {
    const response = await apiFetch<{ success: true; data: { status: "revoked"; message: string } }>(`/retail/orders/${id}/cancel/revoke`, { method: "POST", params: scope, body: JSON.stringify(input) });
    return response.data;
  },
  async reconcileCancellation(scope: RetailScope, id: string, input: unknown) {
    const response = await apiFetch<{ success: true; data: { status: "completed" | "not_found" | "processing" | "conflict" | "revoked"; message: string; order?: RetailOrder } }>(`/retail/orders/${id}/cancel/reconcile`, { method: "POST", params: scope, body: JSON.stringify(input) });
    return response.data;
  },
  async cancel(scope: RetailScope, id: string, input: unknown) { const response = await apiFetch<{ success: true; data: RetailOrder }>(`/retail/orders/${id}/cancel`, { method: "POST", params: scope, body: JSON.stringify(input) }); return response.data; },
  async deleteCancelled(scope: RetailScope, id: string) { const response = await apiFetch<{ success: true; data: { id: string } }>(`/retail/orders/${id}`, { method: "DELETE", params: scope }); return response.data; },
  async idempotency(scope: RetailScope, key: string) { const response = await apiFetch<{ success: true; data: any }>(`/retail/orders/idempotency/${encodeURIComponent(key)}`, { params: scope }); return response.data; },
};
