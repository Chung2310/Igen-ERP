import { AI_CREDITS_ENABLED } from "../../shared/features";
import * as legacy from "./ai-billing.service";
import * as quota from "./free-ai.service";

export function withAiUsage<T>(userId: string, task: string, work: () => Promise<T>, companyCode?: string): Promise<T> {
  return AI_CREDITS_ENABLED
    ? legacy.withAiBilling(userId, task, work, companyCode)
    : quota.withAiQuota(userId, task, work);
}
export const beforeAiProviderCall = () =>
  AI_CREDITS_ENABLED ? legacy.beforeAiProviderCall() : quota.beforeAiProviderCall();
export const recordAiProviderUsage = (data: unknown, model: string, provider = "openrouter") =>
  AI_CREDITS_ENABLED ? legacy.recordAiProviderUsage(data, model, provider) : quota.recordAiProviderUsage(data);
export const isAiUsageActive = () => (AI_CREDITS_ENABLED ? legacy.isAiBillingActive() : quota.isAiQuotaActive());
export const isAiUsageError = (error: unknown) =>
  AI_CREDITS_ENABLED ? legacy.isAiBillingError(error) : quota.isAiQuotaError(error);
