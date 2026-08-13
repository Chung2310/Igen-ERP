import { getAccessToken } from "../../../services/authService";
import { parseApiErrorResponse } from "../../../services/apiClientError";

export type ReminderRunStatus = "running" | "completed" | "failed";
export type ReminderDeliveryStatus = "queued" | "sending" | "sent" | "skipped" | "failed";
export interface ReminderDelivery { _id: string; channel: "in_app" | "marketing"; status: ReminderDeliveryStatus; attempt: number; maxAttempts: number; error?: string; createdAt: string }
export interface ReminderRun { _id: string; businessDate: string; trigger: "scheduled" | "manual"; status: ReminderRunStatus; eligible: number; queued: number; skipped: number; failed: number; duplicates: number; startedAt: string; completedAt?: string }
export interface ReminderRunDetail extends ReminderRun { deliveries: ReminderDelivery[] }

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/v1/finance/reminders${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAccessToken() || ""}`, ...(init?.headers || {}) },
  });
  if (!response.ok) throw await parseApiErrorResponse(response);
  const payload = await response.json();
  return payload.data as T;
}

export const financeRemindersApi = {
  listRuns(limit = 20) { return request<ReminderRun[]>(`/runs?limit=${limit}`); },
  getRun(id: string) { return request<ReminderRunDetail>(`/runs/${encodeURIComponent(id)}`); },
  runNow() { return request<{ eligible: number; queued: number; skipped: number; failed: number; duplicates: number }>("/runs", { method: "POST" }); },
  retry(deliveryId: string) { return request<{ status: "sent" | "failed"; retry?: boolean }>(`/deliveries/${encodeURIComponent(deliveryId)}/retry`, { method: "POST" }); },
};
