import { getAccessToken } from "../../../services/authService";
import { parseApiErrorResponse } from "../../../services/apiClientError";

export type ReceivableStatus = "open" | "partially_paid" | "settled" | "written_off";
export interface FinanceReceivable {
  _id: string;
  receivableCode: string;
  customerId: string;
  customerName: string;
  sourceCode?: string;
  dueDate: string;
  originalAmount: number;
  paidAmount: number;
  balance: number;
  status: ReceivableStatus;
  daysOverdue: number;
  reminderCount: number;
}
export interface ReceivableListResult { items: FinanceReceivable[]; total: number }
export interface ReceivableListQuery { page?: number; limit?: number; status?: ReceivableStatus; customerId?: string; from?: string; to?: string }
export interface CollectionInput { amount: number; paymentMethod: "cash" | "transfer" | "card" | "other"; reference?: string; idempotencyKey: string }

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/v1/finance/receivables${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAccessToken() || ""}`, ...(init?.headers || {}) },
  });
  if (!response.ok) throw await parseApiErrorResponse(response);
  const payload = await response.json();
  return payload.data as T;
}

export const financeReceivablesApi = {
  list(query: ReceivableListQuery = {}) {
    const params = new URLSearchParams(Object.entries(query).filter(([, value]) => value !== undefined).map(([key, value]) => [key, String(value)]));
    return request<ReceivableListResult>(params.size ? `?${params}` : "");
  },
  detail(id: string) { return request<{ receivable: FinanceReceivable; entries: unknown[] }>(`/${encodeURIComponent(id)}`); },
  aging() { return request<Record<string, { count: number; balance: number }>>("/aging"); },
  collect(id: string, input: CollectionInput) { return request<FinanceReceivable>(`/${encodeURIComponent(id)}/payments`, { method: "POST", body: JSON.stringify(input) }); },
};
