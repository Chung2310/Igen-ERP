export interface SuperAdminUser { _id: string; email: string; displayName?: string; role: string; status?: string; lockedAt?: string; permissions?: string[]; }
export interface UserSearchResult { data: SuperAdminUser[]; total: number; page: number; limit: number; }
export type UserActivityCategory = "authentication" | "view" | "search" | "data" | "communication" | "configuration" | "security" | "business";
export interface UserActivityEvent { eventId: string; userId: string; companyCode: string; actionType: string; category: UserActivityCategory; result: "success" | "failure"; method?: string; route?: string; description: string; sourceIp?: string; userAgent?: string; deviceSummary?: string; durationMs?: number; occurredAt: string; }
export interface UserActivityResult { data: UserActivityEvent[]; total: number; page: number; limit: number; }
export interface PermissionCatalogEntry { code: string; label: string; group: string; }
export interface ActiveImpersonation { actionId: string; actorId: string; targetUserId: string; reason?: string; startedAt?: string; expiresAt: string; }
type Mutation = { reason: string; password?: string; token?: string; step?: number; [key: string]: unknown };

import { superAdminRequest } from "./superAdminRequest";
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  return superAdminRequest(`/api/v1/super-admin${path}`, init) as Promise<T>;
}
function requireReason(reason: string) { if (!reason.trim()) throw new Error("A written reason is required"); }
function mutate(tenantId: string, userId: string, path: string, input: Mutation) { requireReason(input.reason); return request<{ actionId: string }>(`/users/${encodeURIComponent(userId)}${path}?tenantId=${encodeURIComponent(tenantId)}`, { method: "POST", headers: { "idempotency-key": crypto.randomUUID() }, body: JSON.stringify(input) }); }

export const superAdminUserAccessService = {
  permissionCatalog: () => request<{ catalog: PermissionCatalogEntry[] }>("/permission-catalog"),
  activeImpersonation: (tenantId: string, userId: string) => request<{ active: ActiveImpersonation | null }>(`/users/${encodeURIComponent(userId)}/impersonation?tenantId=${encodeURIComponent(tenantId)}`),
  search: (tenantId: string, filters: { page?: number; limit?: number; q?: string } = {}) => request<UserSearchResult>(`/users?${new URLSearchParams({ tenantId, page: String(filters.page || 1), limit: String(filters.limit || 20), ...(filters.q ? { q: filters.q } : {}) })}`),
  detail: (tenantId: string, userId: string) => request<SuperAdminUser>(`/users/${encodeURIComponent(userId)}?tenantId=${encodeURIComponent(tenantId)}`),
  activity: (tenantId: string, userId: string, filters: { from?: string; to?: string; category?: UserActivityCategory | ""; result?: "success" | "failure" | ""; search?: string; page?: number; limit?: number } = {}) => {
    const query = new URLSearchParams({ tenantId, page: String(filters.page || 1), limit: String(filters.limit || 20) });
    if (filters.from) query.set("from", filters.from);
    if (filters.to) query.set("to", filters.to);
    if (filters.category) query.set("category", filters.category);
    if (filters.result) query.set("result", filters.result);
    if (filters.search) query.set("search", filters.search);
    return request<UserActivityResult>(`/users/${encodeURIComponent(userId)}/activity?${query}`);
  },
  lock: (tenantId: string, userId: string, input: Mutation) => mutate(tenantId, userId, "/lock", input),
  unlock: (tenantId: string, userId: string, input: Mutation) => mutate(tenantId, userId, "/unlock", input),
  revokeSessions: (tenantId: string, userId: string, input: Mutation) => mutate(tenantId, userId, "/sessions/revoke", input),
  resetTwoFactor: async (tenantId: string, userId: string, reason: string, stepUp: Omit<Mutation, "reason"> = {}) => mutate(tenantId, userId, "/2fa/reset", { ...stepUp, reason }),
  assignRole: (tenantId: string, userId: string, role: string, permissions: string[], input: Mutation) => mutate(tenantId, userId, "/role", { ...input, role, permissions }),
  startImpersonation: (tenantId: string, userId: string, input: Mutation & { durationMinutes?: number }) => mutate(tenantId, userId, "/impersonation", input),
  stopImpersonation: (tenantId: string, userId: string, input: Mutation) => mutate(tenantId, userId, "/impersonation/stop", input),
};
