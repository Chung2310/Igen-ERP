import { superAdminRequest } from "./superAdminRequest";
export type ServicePlan = { _id: string; code: string; name: string; description: string; priceVnd: number; durationDays: number; modules: string[]; active: boolean; updatedAt: string };
export type ServiceSubscription = { planId: string; planName: string; priceVnd: number; modules: string[]; startsAt: string; expiresAt: string; status: "active" | "cancelled" | "expired" };
export type ServicePlanInput = Pick<ServicePlan, "code" | "name" | "description" | "priceVnd" | "durationDays" | "modules" | "active"> & { reason: string; updatedAt?: string };
const root = "/api/v1/super-admin";
const pendingMutations = new Map<string, string>();
async function mutate(path: string, method: string, body: unknown) {
  const payload = JSON.stringify(body);
  const fingerprint = `${method}:${path}:${payload}`;
  const key = pendingMutations.get(fingerprint) || crypto.randomUUID();
  pendingMutations.set(fingerprint, key);
  try {
    const result = await superAdminRequest(root + path, {
      method, headers: { "idempotency-key": key }, body: payload, suppressSuccessToast: true,
    });
    if (!result?.actionId) throw new TypeError("Chưa xác nhận được kết quả cấp gói. Hãy tải lại trước khi thao tác tiếp.");
    pendingMutations.delete(fingerprint);
    return result;
  } catch (error) {
    const status = (error as { status?: number })?.status;
    if (status && status >= 400 && status < 500 && status !== 408) pendingMutations.delete(fingerprint);
    throw error;
  }
}
export const servicePlanAdminService = {
  plans: async () => (await superAdminRequest(root + "/service-plans")).plans as ServicePlan[],
  current: async (code: string) => (await superAdminRequest(root + `/tenants/${encodeURIComponent(code)}/service-plan`)).subscription as ServiceSubscription | null,
  save: (input: ServicePlanInput, id?: string) => mutate(`/service-plans${id ? "/" + encodeURIComponent(id) : ""}`, id ? "PUT" : "POST", input),
  assign: (code: string, planId: string, reason: string, expectedStartsAt: string | null, planUpdatedAt: string) =>
    mutate(`/tenants/${encodeURIComponent(code)}/service-plan`, "POST", { planId, reason, expectedStartsAt, planUpdatedAt }),
  cancel: (code: string, reason: string, expectedStartsAt: string) =>
    mutate(`/tenants/${encodeURIComponent(code)}/service-plan`, "DELETE", { reason, expectedStartsAt }),
};
