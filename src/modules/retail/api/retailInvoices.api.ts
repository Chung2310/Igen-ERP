import { parseApiErrorResponse } from "../../../services/apiClientError";
import { apiFetch, getAccessToken } from "../../shared/lib/apiFetch";
import type { RetailInvoice, RetailScope } from "../types";

const params = (scope: RetailScope) => ({ companyCode: scope.companyCode, branchId: scope.branchId });
const safeFilename = (header: string | null) => {
  const value = header?.match(/filename\s*=\s*(?:"([^"]*)"|([^;]*))/i);
  // eslint-disable-next-line no-control-regex
  return (value?.[1] || value?.[2] || "hoa-don.pdf").replace(/[\u0000-\u001f\u007f/\\:*?"<>|]/g, "-").replace(/^[.\s-]+/, "") || "hoa-don.pdf";
};

export const retailInvoicesApi = {
  async list(scope: RetailScope, query: Record<string, string | number | undefined> = {}) {
    const response = await apiFetch<{ success: true; data: { items: RetailInvoice[]; total: number; page: number; limit: number } }>("/retail/invoices", { params: { ...params(scope), ...query } });
    return response.data;
  },
  async detail(scope: RetailScope, id: string) {
    const response = await apiFetch<{ success: true; data: RetailInvoice }>(`/retail/invoices/${id}`, { params: params(scope) });
    return response.data;
  },
  async registerPosPrint(scope: RetailScope, id: string) {
    const response = await apiFetch<{ success: true; data: RetailInvoice }>(`/retail/invoices/${id}/pos-print`, { method: "POST", params: params(scope) });
    return response.data;
  },
  async registerSePayPaymentPrint(scope: RetailScope, id: string, transactionKey: string) {
    const response = await apiFetch<{ success: true; data: { invoice: RetailInvoice; alreadyPrinted: boolean } }>(`/retail/invoices/${id}/payment-print`, { method: "POST", params: params(scope), body: JSON.stringify({ transactionKey }) });
    return response.data;
  },
  async reprint(scope: RetailScope, id: string) {
    const response = await apiFetch<{ success: true; data: RetailInvoice }>(`/retail/invoices/${id}/reprint`, { method: "POST", params: params(scope) });
    return response.data;
  },
  async downloadPdf(scope: RetailScope, id: string, signal?: AbortSignal): Promise<void> {
    const query = new URLSearchParams(params(scope));
    const response = await fetch(`/api/v1/retail/invoices/${encodeURIComponent(id)}/pdf?${query.toString()}`, { headers: { Authorization: `Bearer ${getAccessToken()}` }, signal });
    if (!response.ok) throw await parseApiErrorResponse(response);
    const objectUrl = URL.createObjectURL(await response.blob());
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = safeFilename(response.headers.get("Content-Disposition"));
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    try { anchor.click(); } finally { anchor.remove(); URL.revokeObjectURL(objectUrl); }
  },
  async downloadBulkPdf(
    scope: RetailScope,
    payload: { ids?: string[]; q?: string; status?: string; from?: string; to?: string; paperSize?: "A4" | "A5" | "80mm" | "58mm" },
    signal?: AbortSignal,
  ): Promise<void> {
    const query = new URLSearchParams(params(scope));
    const response = await fetch(`/api/v1/retail/invoices/bulk-pdf?${query.toString()}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getAccessToken()}`,
      },
      body: JSON.stringify(payload),
      signal,
    });
    if (!response.ok) throw await parseApiErrorResponse(response);
    const objectUrl = URL.createObjectURL(await response.blob());
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = safeFilename(response.headers.get("Content-Disposition"));
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    try { anchor.click(); } finally { anchor.remove(); URL.revokeObjectURL(objectUrl); }
  },
};
