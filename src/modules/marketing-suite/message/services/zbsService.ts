import type { ZbsBatch, ZbsBatchSummary, ZbsDraftInput, ZbsMapping, ZbsTemplate } from "../../../../../shared/marketing-suite/zbs";
import { getAccessToken } from "../../shared/services/authService";
export type ZbsAccount = { oaId: string; name: string };
async function request<T>(path: string, method = "GET", body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/api/v1/zalo/zbs${path}`, { method, signal,
    headers: { Authorization: `Bearer ${getAccessToken()}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || "Không thể xử lý Zalo ZBS.");
  return result;
}
export const zbsService = {
  accounts: () => request<{ data: ZbsAccount[] }>("/accounts"),
  templates: (oaId: string, signal?: AbortSignal) => request<{ data: ZbsTemplate[] }>(`/templates?oaId=${encodeURIComponent(oaId)}`, "GET", undefined, signal),
  sync: (oaId: string, force = true, signal?: AbortSignal) => request<{ data: ZbsTemplate[] }>("/templates/sync", "POST", { oaId, force }, signal),
  saveMapping: (oaId: string, templateId: string, mapping: ZbsMapping) => request(`/templates/${encodeURIComponent(templateId)}/mapping`, "PUT", { oaId, mapping }),
  draft: (input: ZbsDraftInput) => request<{ data: ZbsBatch }>("/drafts", "POST", input),
  batch: (id: string) => request<{ data: ZbsBatch }>(`/batches/${id}`),
  batches: (oaId: string, page: number, leadId = "") => request<{ data: ZbsBatchSummary[]; hasMore: boolean }>(`/batches?${new URLSearchParams({ oaId, page: String(page), ...(leadId ? { leadId } : {}) })}`),
  confirm: (id: string) => request<{ data: ZbsBatch }>(`/batches/${id}/confirm`, "POST", { confirmed: true }),
  reconcile: (id: string) => request<{ data: ZbsBatch }>(`/batches/${id}/reconcile`, "POST", {}),
  control: (id: string, action: "pause" | "resume" | "cancel") => request<{ data: ZbsBatch }>(`/batches/${id}/control`, "POST", { action }),
};
