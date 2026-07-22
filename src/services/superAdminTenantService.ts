export type Tenant = { code: string; name?: string; ownerEmail?: string; lifecycleStatus?: string; enabledModules?: string[]; [key: string]: unknown };
export type TenantMutation = { actionId: string; result: Tenant };
export type TenantUser = { _id: string; displayName: string; email: string; role: string; status: string; createdAt: string };
export type TenantSummary = { userCount: number; usersByRole: Record<string, number>; enabledModulesCount: number };
export type TenantCreateInput = { code: string; name: string; ownerEmail: string; ownerName: string; ownerPassword: string; enabledModules?: string[] };
type StepUp = { reason: string; password: string; token: string; step: number };

import { superAdminRequest as request } from "./superAdminRequest";
const mutation = (path: string, method: string, body: unknown) => request(path, { method, headers: { "idempotency-key": crypto.randomUUID() }, body: JSON.stringify(body) }) as Promise<TenantMutation>;
export const superAdminTenantService = {
  list: async (query = "") => (await request(`/api/v1/super-admin/tenants${query ? `?query=${encodeURIComponent(query)}` : ""}`)).tenants as Tenant[],
  detail: async (code: string) => request(`/api/v1/super-admin/tenants/${encodeURIComponent(code)}`) as Promise<{ tenant: Tenant; summary: TenantSummary; audit: any[] }>,
  listUsers: async (code: string) => (await request(`/api/v1/super-admin/tenants/${encodeURIComponent(code)}/users`)).users as TenantUser[],
  create: (tenant: TenantCreateInput) => mutation("/api/v1/super-admin/tenants", "POST", tenant),
  update: (code: string, input: Partial<Tenant> & StepUp) => mutation(`/api/v1/super-admin/tenants/${encodeURIComponent(code)}`, "PATCH", input),
  updateModules: (code: string, input: { enabledModules: string[] } & StepUp) => mutation(`/api/v1/super-admin/tenants/${encodeURIComponent(code)}/modules`, "PATCH", input),
  transition: (code: string, input: { lifecycleStatus: string } & StepUp) => mutation(`/api/v1/super-admin/tenants/${encodeURIComponent(code)}/lifecycle`, "POST", input),
  scheduleDeletion: (code: string, input: StepUp) => mutation(`/api/v1/super-admin/tenants/${encodeURIComponent(code)}/deletion`, "POST", input),
  cancelDeletion: (code: string, input: StepUp) => mutation(`/api/v1/super-admin/tenants/${encodeURIComponent(code)}/deletion`, "DELETE", input),
};
