import { AsyncLocalStorage } from "node:async_hooks";
export interface AiSharingRouting {
  model: string; providers: string[]; routes?: Record<string, string[]>; companyCode?: string;
}
export const aiSharingContext = new AsyncLocalStorage<AiSharingRouting>();
/** Called immediately before forming any OpenRouter payload in a consented operation. */
export function consentedProviderRouting(model: string) {
  const sharing = aiSharingContext.getStore();
  if (!sharing) return undefined;
  const providers = sharing.routes?.[model] || (sharing.model === model ? sharing.providers : undefined);
  if (!providers?.length) throw new Error("Model AI đã thay đổi so với thông tin bạn đồng ý.");
  return { only: providers, allow_fallbacks: false, zdr: true, data_collection: "deny" as const };
}
