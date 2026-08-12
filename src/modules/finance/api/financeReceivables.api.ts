import { getAccessToken } from "../../../services/authService";
import { parseApiErrorResponse } from "../../../services/apiClientError";

export type ReceivableStatus =
  "open" | "partially_paid" | "settled" | "written_off";
export interface FinanceReceivable {
  _id: string;
  receivableCode: string;
  customerId: string;
  customerName: string;
  sourceCode?: string;
  sourceType?: string;
  sourceId?: string;
  dueDate: string;
  originalAmount: number;
  paidAmount: number;
  adjustedAmount: number;
  balance: number;
  status: ReceivableStatus;
  daysOverdue: number;
  reminderCount: number;
}
export interface ReceivableListResult {
  items: FinanceReceivable[];
  total: number;
}
export type AgingBucket = "0-30" | "31-60" | "61-90" | "over90";
export interface ReceivableListQuery {
  page?: number;
  limit?: number;
  status?: ReceivableStatus;
  customerId?: string;
  from?: string;
  to?: string;
  agingBucket?: AgingBucket;
}
export interface CollectionInput {
  amount: number;
  paymentMethod: "cash" | "transfer" | "card" | "other";
  reference?: string;
  idempotencyKey: string;
}
export interface ReceivableEntry {
  _id: string;
  type: string;
  amount: number;
  runningBalance: number;
  reason?: string;
  createdAt: string;
  reversalOfEntryId?: string;
}
export interface ReceivableDetail {
  receivable: FinanceReceivable;
  entries: ReceivableEntry[];
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/v1/finance/receivables${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getAccessToken() || ""}`,
      ...(init?.headers || {}),
    },
  });
  if (!response.ok) throw await parseApiErrorResponse(response);
  const payload = await response.json();
  return payload.data as T;
}

export const financeReceivablesApi = {
  list(query: ReceivableListQuery = {}) {
    const params = new URLSearchParams(
      Object.entries(query)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => [key, String(value)]),
    );
    return request<ReceivableListResult>(params.size ? `?${params}` : "");
  },
  detail(id: string) {
    return request<ReceivableDetail>(`/${encodeURIComponent(id)}`);
  },
  aging() {
    return request<Record<string, { count: number; balance: number }>>(
      "/aging",
    );
  },
  collect(id: string, input: CollectionInput) {
    return request<FinanceReceivable>(`/${encodeURIComponent(id)}/payments`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  adjust(
    id: string,
    input: {
      amount: number;
      direction: "increase" | "decrease";
      reason: string;
      idempotencyKey: string;
    },
  ) {
    return request<FinanceReceivable>(
      `/${encodeURIComponent(id)}/adjustments`,
      { method: "POST", body: JSON.stringify(input) },
    );
  },
  writeOff(id: string, reason: string) {
    return request<FinanceReceivable>(`/${encodeURIComponent(id)}/write-off`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
  },
  suspend(id: string, input: { until: string; reason: string }) {
    return request<FinanceReceivable>(`/${encodeURIComponent(id)}/suspend`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  reverse(id: string, entryId: string, reason: string) {
    return request<FinanceReceivable>(
      `/${encodeURIComponent(id)}/entries/${encodeURIComponent(entryId)}/reversal`,
      { method: "POST", body: JSON.stringify({ reason }) },
    );
  },
};
