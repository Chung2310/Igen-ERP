import { getAccessToken } from "../../../services/authService";
import { parseApiErrorResponse } from "../../../services/apiClientError";

export type MarketingAutomationType = "thank_you" | "birthday" | "holiday" | "remarketing";
export type MarketingChannel = "email" | "sms" | "zalo" | "tiktok";

export interface MarketingAutomationConfig {
  enabled: boolean;
  channels: MarketingChannel[];
  subject: string;
  html: string;
}

export interface MarketingSettings extends Record<MarketingAutomationType, MarketingAutomationConfig> {
  companyCode: string;
  timeZone: string;
  sendTime: string;
  remarketingInactiveDays: number;
  remarketingCooldownDays: number;
  attachInvoicePdf: boolean;
}

export interface MarketingChannelStatus {
  channel: MarketingChannel;
  label: string;
  implemented: boolean;
  configured: boolean;
}

export interface MarketingSettingsResponse {
  settings: MarketingSettings;
  channels: MarketingChannelStatus[];
  variables: string[];
  defaults: Record<MarketingAutomationType, { subject: string; html: string }>;
}

export interface MarketingCampaign {
  _id: string;
  name: string;
  runDate: string;
  targetTierCodes: string[];
  channels: MarketingChannel[];
  subject: string;
  html: string;
  enabled: boolean;
}

export interface MarketingDelivery {
  _id: string;
  automationType: MarketingAutomationType;
  channel: MarketingChannel;
  customerName: string;
  recipient: string;
  subject: string;
  status: "queued" | "sending" | "sent" | "skipped" | "failed";
  attempt: number;
  maxAttempts: number;
  error?: string;
  createdAt: string;
  sentAt?: string;
}

export interface MarketingRun {
  _id: string;
  automationType: MarketingAutomationType;
  businessDate: string;
  trigger: "scheduled" | "manual";
  status: "running" | "completed" | "failed";
  eligible: number;
  queued: number;
  skipped: number;
  failed: number;
  duplicates: number;
  startedAt: string;
  completedAt?: string;
}

export type ScanStats = { eligible: number; queued: number; skipped: number; failed: number; duplicates: number };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/v1/marketing${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAccessToken() || ""}`, ...(init?.headers || {}) },
  });
  if (!response.ok) throw await parseApiErrorResponse(response);
  const payload = await response.json();
  return payload.data as T;
}

export const marketingApi = {
  getSettings() { return request<MarketingSettingsResponse>("/settings"); },
  updateSettings(input: Partial<MarketingSettings>) { return request<MarketingSettings>("/settings", { method: "PUT", body: JSON.stringify(input) }); },
  listCampaigns() { return request<MarketingCampaign[]>("/campaigns"); },
  createCampaign(input: Partial<MarketingCampaign>) { return request<MarketingCampaign>("/campaigns", { method: "POST", body: JSON.stringify(input) }); },
  updateCampaign(id: string, input: Partial<MarketingCampaign>) { return request<MarketingCampaign>(`/campaigns/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(input) }); },
  deleteCampaign(id: string) { return request<{ deleted: boolean }>(`/campaigns/${encodeURIComponent(id)}`, { method: "DELETE" }); },
  listRuns(limit = 20) { return request<MarketingRun[]>(`/runs?limit=${limit}`); },
  runScan(type: "birthday" | "holiday" | "remarketing") { return request<ScanStats>(`/runs/${type}`, { method: "POST" }); },
  listDeliveries(params: { automationType?: string; status?: string; limit?: number } = {}) {
    const query = new URLSearchParams();
    if (params.automationType) query.set("automationType", params.automationType);
    if (params.status) query.set("status", params.status);
    query.set("limit", String(params.limit || 50));
    return request<MarketingDelivery[]>(`/deliveries?${query.toString()}`);
  },
  retryDelivery(id: string) { return request<{ status: "sent" | "failed"; error?: string }>(`/deliveries/${encodeURIComponent(id)}/retry`, { method: "POST" }); },
  sendTest(automationType: MarketingAutomationType, recipient: string) {
    return request<{ status: string; reason?: string }>("/test-send", { method: "POST", body: JSON.stringify({ automationType, recipient }) });
  },
};
