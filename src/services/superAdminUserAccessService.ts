export interface SuperAdminUser { _id: string; email: string; displayName?: string; role: string; status?: string; lockedAt?: string; permissions?: string[]; }
export interface UserSearchResult { data: SuperAdminUser[]; total: number; page: number; limit: number; }
type Mutation = { reason: string; password?: string; token?: string; step?: number; [key: string]: unknown };

import { superAdminRequest } from "./superAdminRequest";
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  return superAdminRequest(`/api/v1/super-admin${path}`, init) as Promise<T>;
}
function requireReason(reason: string) { if (!reason.trim()) throw new Error("A written reason is required"); }
function mutate(tenantId: string, userId: string, path: string, input: Mutation) { requireReason(input.reason); return request<{ actionId: string }>(`/users/${encodeURIComponent(userId)}${path}?tenantId=${encodeURIComponent(tenantId)}`, { method: "POST", body: JSON.stringify(input) }); }

export const superAdminUserAccessService = {
  search: (tenantId: string, filters: { page?: number; limit?: number; q?: string } = {}) => request<UserSearchResult>(`/users?${new URLSearchParams({ tenantId, page: String(filters.page || 1), limit: String(filters.limit || 20), ...(filters.q ? { q: filters.q } : {}) })}`),
  detail: (tenantId: string, userId: string) => request<SuperAdminUser>(`/users/${encodeURIComponent(userId)}?tenantId=${encodeURIComponent(tenantId)}`),
  lock: (tenantId: string, userId: string, input: Mutation) => mutate(tenantId, userId, "/lock", input),
  unlock: (tenantId: string, userId: string, input: Mutation) => mutate(tenantId, userId, "/unlock", input),
  revokeSessions: (tenantId: string, userId: string, input: Mutation) => mutate(tenantId, userId, "/sessions/revoke", input),
  resetTwoFactor: async (tenantId: string, userId: string, reason: string, stepUp: Omit<Mutation, "reason"> = {}) => mutate(tenantId, userId, "/2fa/reset", { ...stepUp, reason }),
  assignRole: (tenantId: string, userId: string, role: string, permissions: string[], input: Mutation) => mutate(tenantId, userId, "/role", { ...input, role, permissions }),
  startImpersonation: (tenantId: string, userId: string, input: Mutation & { durationMinutes?: number }) => mutate(tenantId, userId, "/impersonation", input),
  stopImpersonation: (tenantId: string, userId: string, input: Mutation) => mutate(tenantId, userId, "/impersonation/stop", input),
};
