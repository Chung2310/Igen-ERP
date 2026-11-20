import { browserTransport, type ServiceTransport } from "./serviceTransport";
import type { AiSharingDisclosure, AiSharingScope } from "../../shared/ai-sharing";

export function createAiSharingService(transport: ServiceTransport) {
  async function request<T>(path: string, method = "GET", body?: unknown, key?: string): Promise<T> {
    const send = () => {
      const headers = new Headers({ "Content-Type": "application/json" });
      const token = transport.getAccessToken();
      if (token) headers.set("Authorization", "Bearer " + token);
      if (key) headers.set("Idempotency-Key", key);
      return transport.fetch("/api/v1/ai/consent" + path, {
        method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    };
    let response = await send();
    if (response.status === 401 && transport === browserTransport) {
      const refreshed = await transport.fetch("/api/v1/auth/refresh-token", { method: "POST", headers: { "x-luxcare-client": "web" } });
      if (refreshed.ok) {
        const data = await refreshed.json();
        if (data.accessToken) { localStorage.setItem("accessToken", data.accessToken); response = await send(); }
      }
    }
    const envelope = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(envelope.message || envelope.error?.message || "Không thể sử dụng AI."),
      { status: response.status, code: envelope.code || envelope.error?.code, resetAt: envelope.resetAt || envelope.error?.resetAt });
    return envelope.data ?? envelope;
  }
  return {
    status: (scope: AiSharingScope) => request<AiSharingDisclosure>(`/${scope}`),
    accept: (scope: AiSharingScope, disclosureKey: string) => request<AiSharingDisclosure>(`/${scope}`, "POST", { accepted: true, disclosureKey }),
    revoke: (scope: AiSharingScope) => request<{ accepted: false }>(`/${scope}`, "POST", { accepted: false }),
  };
}
export const aiSharingService = createAiSharingService(browserTransport);
