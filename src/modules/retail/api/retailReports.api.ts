import { parseApiErrorResponse } from "../../../services/apiClientError";
import { apiFetch, getAccessToken } from "../../shared/lib/apiFetch";
import type { RetailReport, RetailReportFilters, RetailScope } from "../types";

const DEFAULT_EXPORT_FILENAME = "bao-cao-ban-le.xlsx";

function reportParams(scope: RetailScope, filters: RetailReportFilters) {
  const params: Record<string, string> = {
    companyCode: scope.companyCode,
    branchId: scope.branchId,
  };

  if ((filters.preset === "7d" || filters.preset === "30d") && filters.from === undefined && filters.to === undefined) {
    params.preset = filters.preset;
  } else if (filters.preset === undefined && typeof filters.from === "string" && typeof filters.to === "string") {
    params.from = filters.from;
    params.to = filters.to;
  }

  return params;
}

function buildExportUrl(scope: RetailScope, filters: RetailReportFilters): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(reportParams(scope, filters))) {
    if (value !== undefined) query.set(key, value);
  }
  return `/api/v1/retail/reports/export?${query.toString()}`;
}

function sanitizeFilename(filename: string): string {
  const safe = filename
    .replace(/[\u0000-\u001f\u007f/\\:*?"<>|]/g, "-")
    .replace(/^[.\s-]+/, "")
    .trim();
  return safe || DEFAULT_EXPORT_FILENAME;
}

function exportFilename(contentDisposition: string | null): string {
  const encoded = contentDisposition?.match(/filename\*\s*=\s*UTF-8''([^;]+)/i)?.[1]?.trim().replace(/^['"]|['"]$/g, "");
  if (encoded) {
    try {
      return sanitizeFilename(decodeURIComponent(encoded));
    } catch {
      return DEFAULT_EXPORT_FILENAME;
    }
  }

  const plain = contentDisposition?.match(/filename\s*=\s*(?:"([^"]*)"|([^;]*))/i);
  return sanitizeFilename((plain?.[1] || plain?.[2] || DEFAULT_EXPORT_FILENAME).trim());
}

function throwIfExportAborted(signal?: AbortSignal) {
  if (!signal?.aborted) return;
  throw signal.reason instanceof Error ? signal.reason : new DOMException("The operation was aborted.", "AbortError");
}

export const retailReportsApi = {
  async remindOverdueDebt(scope: RetailScope): Promise<{ overdueOrders: number; recipients: number; created: number; duplicates: number }> {
    const response = await apiFetch<{ success: true; data: { overdueOrders: number; recipients: number; created: number; duplicates: number } }>("/retail/reports/debt-reminders/run", {
      method: "POST",
      params: { companyCode: scope.companyCode, branchId: scope.branchId },
    });
    return response.data;
  },

  async summary(scope: RetailScope, filters: RetailReportFilters): Promise<RetailReport> {
    const response = await apiFetch<{ success: true; data: RetailReport }>("/retail/reports/summary", {
      params: reportParams(scope, filters),
    });
    return response.data;
  },

  async export(scope: RetailScope, filters: RetailReportFilters, signal?: AbortSignal): Promise<void> {
    throwIfExportAborted(signal);
    const response = await fetch(buildExportUrl(scope, filters), {
      headers: { Authorization: `Bearer ${getAccessToken()}` },
      signal,
    });
    throwIfExportAborted(signal);
    if (!response.ok) {
      const apiError = await parseApiErrorResponse(response);
      throwIfExportAborted(signal);
      throw apiError;
    }

    const blob = await response.blob();
    throwIfExportAborted(signal);
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = exportFilename(response.headers.get("Content-Disposition"));
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    try {
      anchor.click();
    } finally {
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    }
  },
};
