import { superAdminRequest } from "./superAdminRequest";
import type { UserActivityCategory, UserActivityEvent } from "./superAdminUserAccessService";

export interface MonitorEvent extends UserActivityEvent {
  actorName?: string; actorEmail?: string; actorRole?: string; branchId?: string;
  entityId?: string; statusCode?: number; correlationId?: string;
}
export interface ActivityMonitorFilters {
  companyCode?: string; userId?: string; category?: UserActivityCategory | "";
  result?: "success" | "failure" | ""; from?: string; to?: string; search?: string; page?: number;
}
export interface MonitorSnapshot {
  data: MonitorEvent[]; total: number; page: number; limit: number;
  summary: { failures: number; companies: number; activeUsers: number };
  generatedAt: string; retentionDays: number;
}
export interface MonitorAccount { _id: string; displayName?: string; email: string; companyCode: string; role: string; }
function query(input: Record<string, unknown>) {
  return new URLSearchParams(Object.entries(input).filter(([, value]) => value !== "" && value != null).map(([key, value]) => [key, String(value)]));
}
export const activityMonitorService = {
  list: (filters: ActivityMonitorFilters, signal?: AbortSignal): Promise<MonitorSnapshot> =>
    superAdminRequest(`/api/v1/super-admin/activity/events?${query({ ...filters, limit: 30 })}`, { signal, suppressErrorToast: true }),
  accounts: (companyCode: string, search: string, signal?: AbortSignal): Promise<MonitorAccount[]> =>
    superAdminRequest(`/api/v1/super-admin/activity/accounts?${query({ companyCode, search })}`, { signal, suppressErrorToast: true }),
};
