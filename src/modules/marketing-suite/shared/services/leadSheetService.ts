import { getAccessToken } from "./authService";

export type LeadSheetConfig = { enabled: boolean; spreadsheetUrl: string; sheetName: string };
export type LeadSheetStatus = {
  config: LeadSheetConfig; serviceAccountEmail: string; pending: number; failed: number; synced: number; lastError: string;
};
async function request<T>(integrationId: string, suffix = "", body?: unknown, method = "POST"): Promise<T> {
  const response = await fetch(`/api/v1/order-sheets/integrations/${encodeURIComponent(integrationId)}/leads${suffix}`, {
    method: body === undefined && !suffix ? "GET" : method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAccessToken()}` },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || result.error?.message || "Không thể cập nhật cấu hình lưu khách vào Sheet.");
  return result.data as T;
}
export const leadSheetService = {
  get: (id: string) => request<LeadSheetStatus>(id),
  save: (id: string, config: LeadSheetConfig) => request<LeadSheetConfig>(id, "", config, "PUT"),
  test: (id: string, config: LeadSheetConfig) => request<{ title: string }>(id, "/test", config),
  retry: (id: string) => request<{ queued: number }>(id, "/retry", {}),
};
