import type { AiSubscriptionPlan, AiSubscriptionSummary } from "../../shared/marketing-suite/subscription";
import { superAdminRequest } from "./superAdminRequest";
import { getAccessToken } from "./authService";
export type { AiSubscriptionPlan, AiSubscriptionSummary };
export { formatAiPlanPrice } from "../../shared/marketing-suite/subscription";

const root = "/api/v1/super-admin";
const pendingMutations = new Map<string, string>();
async function mutation(path: string, method: string, body: unknown) {
  const payload = JSON.stringify(body);
  const fingerprint = `${method}:${path}:${payload}`;
  const key = pendingMutations.get(fingerprint) || crypto.randomUUID();
  pendingMutations.set(fingerprint, key);
  try {
    const result = await superAdminRequest(root + path, {
      method, headers: { "idempotency-key": key }, body: payload, suppressSuccessToast: true,
    });
    if (!result?.actionId) throw new TypeError("Chưa nhận được kết quả đối soát. Hãy tải lại gói hiện tại trước khi thao tác tiếp.");
    pendingMutations.delete(fingerprint);
    return result;
  } catch (error) {
    // Reuse the same key when a lost network response leaves the outcome unknown.
    if (!(error instanceof TypeError)) pendingMutations.delete(fingerprint);
    throw error;
  }
}
export type SubscriptionPlanInput = Pick<AiSubscriptionPlan, "code" | "name" | "description" | "durationDays" | "aiLimit" | "active"> & { priceVnd: number; reason: string; updatedAt?: string };
export const aiSubscriptionAdminService = {
  async plans(): Promise<AiSubscriptionPlan[]> { return (await superAdminRequest(root + "/ai-subscription/plans")).plans; },
  save: (data: SubscriptionPlanInput, id?: string) => mutation(`/ai-subscription/plans${id ? `/${encodeURIComponent(id)}` : ""}`, id ? "PUT" : "POST", data),
  async current(code: string): Promise<AiSubscriptionSummary | null> {
    return (await superAdminRequest(root + `/tenants/${encodeURIComponent(code)}/ai-subscription`)).subscription;
  },
  assign: (code: string, planId: string, reason: string) => mutation(`/tenants/${encodeURIComponent(code)}/ai-subscription`, "POST", { planId, reason }),
  cancel: (code: string, reason: string) => mutation(`/tenants/${encodeURIComponent(code)}/ai-subscription`, "DELETE", { reason }),
};

export async function getCurrentAiSubscription(signal?: AbortSignal): Promise<AiSubscriptionSummary | null> {
  const response = await fetch("/api/v1/marketing-subscription", {
    headers: { Authorization: `Bearer ${getAccessToken()}` }, signal,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.message || "Không thể tải hạn mức AI.");
  if (!payload?.data || !("subscription" in payload.data)) throw new Error("Chưa nhận được thông tin gói AI. Vui lòng tải lại.");
  return payload.data.subscription;
}

export async function getAvailableAiSubscriptionPlans(signal?: AbortSignal): Promise<AiSubscriptionPlan[]> {
  const response = await fetch("/api/v1/marketing-subscription/plans", {
    headers: { Authorization: `Bearer ${getAccessToken()}` }, signal,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.message || "Không thể tải danh sách gói AI.");
  if (!Array.isArray(payload?.data?.plans)) throw new Error("Chưa nhận được danh sách gói AI. Vui lòng tải lại.");
  return payload.data.plans;
}
