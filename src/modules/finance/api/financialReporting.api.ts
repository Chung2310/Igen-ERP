import { getAccessToken } from "../../../services/authService";
import { parseApiErrorResponse } from "../../../services/apiClientError";
export async function financialReportRequest(path: string, query: Record<string, string> = {}, method = "GET", body?: unknown, signal?: AbortSignal) {
  const response = await fetch(`/api/v1/finance/reporting${path}?${new URLSearchParams(query)}`, { method, signal, headers: { Authorization: `Bearer ${getAccessToken() || ""}`, "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  if (!response.ok) throw await parseApiErrorResponse(response);
  return (await response.json()).data;
}
