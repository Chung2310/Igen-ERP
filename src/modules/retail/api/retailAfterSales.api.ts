import { apiFetch } from "../../shared/lib/apiFetch";
import type { RetailAfterSale, RetailAfterSaleInput, RetailScope } from "../types";
export const retailAfterSalesApi = {
  async list(scope: RetailScope, query: Record<string, string | undefined> = {}) { const r = await apiFetch<{ success: true; data: { items: RetailAfterSale[]; total: number } }>("/retail/after-sales", { params: { ...scope, ...query } }); return r.data; },
  async detail(scope: RetailScope, id: string) { const r = await apiFetch<{ success: true; data: RetailAfterSale }>(`/retail/after-sales/${id}`, { params: scope }); return r.data; },
  async revoke(scope: RetailScope, input: RetailAfterSaleInput) {
    const r = await apiFetch<{ success: true; data: { status: "revoked"; message: string } }>("/retail/after-sales/revoke", { method: "POST", params: scope, body: JSON.stringify(input) }); return r.data;
  },
  async reconcile(scope: RetailScope, input: RetailAfterSaleInput) {
    const r = await apiFetch<{ success: true; data: { status: "completed" | "not_found" | "conflict" | "revoked"; message: string; document?: Pick<RetailAfterSale, "_id" | "code" | "orderId" | "type" | "receiptId" | "receiptCode"> } }>("/retail/after-sales/reconcile", { method: "POST", params: scope, body: JSON.stringify(input) });
    return r.data;
  },
  async create(scope: RetailScope, input: RetailAfterSaleInput) { const r = await apiFetch<{ success: true; data: RetailAfterSale }>("/retail/after-sales", { method: "POST", params: scope, body: JSON.stringify(input) }); return r.data; },
};
