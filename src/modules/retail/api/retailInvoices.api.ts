import { parseApiErrorResponse } from "../../../services/apiClientError";
import { apiFetch, getAccessToken } from "../../shared/lib/apiFetch";
import type { RetailInvoice, RetailScope } from "../types";

const params = (scope: RetailScope) => ({ companyCode: scope.companyCode, branchId: scope.branchId });
const safeFilename = (header: string | null) => {
  const value = header?.match(/filename\s*=\s*(?:"([^"]*)"|([^;]*))/i);
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
};
