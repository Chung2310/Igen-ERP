export type Tenant = { code: string; name?: string; ownerEmail?: string; lifecycleStatus?: string; [key: string]: unknown };
export type TenantMutation = { actionId: string; result: Tenant };
type StepUp = { reason: string; password: string; token: string; step: number };

import { superAdminRequest as request } from "./superAdminRequest";
const mutation = (path: string, method: string, body: unknown) => request(path, { method, headers: { "idempotency-key": crypto.randomUUID() }, body: JSON.stringify(body) }) as Promise<TenantMutation>;
export const superAdminTenantService = {
  list: async (query = "") => (await request(`/api/v1/super-admin/tenants${query ? `?query=${encodeURIComponent(query)}` : ""}`)).tenants as Tenant[],
  detail: async (code: string) => request(`/api/v1/super-admin/tenants/${encodeURIComponent(code)}`),
  create: (tenant: Pick<Tenant, "code" | "name" | "ownerEmail">) => mutation("/api/v1/super-admin/tenants", "POST", tenant),
  update: (code: string, input: Partial<Tenant> & StepUp) => mutation(`/api/v1/super-admin/tenants/${encodeURIComponent(code)}`, "PATCH", input),
  transition: (code: string, input: { lifecycleStatus: string } & StepUp) => mutation(`/api/v1/super-admin/tenants/${encodeURIComponent(code)}/lifecycle`, "POST", input),
  scheduleDeletion: (code: string, input: StepUp) => mutation(`/api/v1/super-admin/tenants/${encodeURIComponent(code)}/deletion`, "POST", input),
  cancelDeletion: (code: string, input: StepUp) => mutation(`/api/v1/super-admin/tenants/${encodeURIComponent(code)}/deletion`, "DELETE", input),
};
