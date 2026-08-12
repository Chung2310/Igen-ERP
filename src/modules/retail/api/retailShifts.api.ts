import { apiFetch } from "../../shared/lib/apiFetch";
import type { RetailScope, RetailShift } from "../types";
export const retailShiftsApi = {
  async current(scope: RetailScope) { const response = await apiFetch<{ success: true; data: RetailShift | null }>("/retail/shifts/current", { params: scope }); return response.data; },
  async list(scope: RetailScope, query: Record<string, string | number | undefined> = {}) { const response = await apiFetch<{ success: true; data: { items: RetailShift[]; total: number; page: number; limit: number } }>("/retail/shifts", { params: { ...scope, ...query } }); return response.data; },
  async open(scope: RetailScope, input: { openingFloat: number; terminalId?: string }) { const response = await apiFetch<{ success: true; data: RetailShift }>("/retail/shifts/open", { method: "POST", params: scope, body: JSON.stringify(input) }); return response.data; },
  async movement(scope: RetailScope, id: string, input: { type: "in" | "out"; amount: number; reason: string }) { const response = await apiFetch<{ success: true; data: RetailShift }>(`/retail/shifts/${id}/cash-movements`, { method: "POST", params: scope, body: JSON.stringify(input) }); return response.data; },
  async close(scope: RetailScope, id: string, input: { countedCash: number; varianceReason?: string }) { const response = await apiFetch<{ success: true; data: RetailShift }>(`/retail/shifts/${id}/close`, { method: "POST", params: scope, body: JSON.stringify(input) }); return response.data; },
  async approve(scope: RetailScope, id: string) { const response = await apiFetch<{ success: true; data: RetailShift }>(`/retail/shifts/${id}/approve`, { method: "POST", params: scope }); return response.data; },
};
