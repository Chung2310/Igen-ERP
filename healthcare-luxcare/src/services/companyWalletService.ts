import { browserTransport } from "./serviceTransport";
import type { CompanyWalletState } from "../../shared/ai-access";
async function request<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const headers = new Headers({ "Content-Type": "application/json" });
  const token = browserTransport.getAccessToken();
  if (token) headers.set("Authorization", "Bearer " + token);
  const response = await browserTransport.fetch("/api/v1/company-wallet" + path,
    { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const envelope = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(envelope.message || "Không thể tải ví công ty.");
  return envelope.data ?? envelope;
}
export const companyWalletService = {
  status: () => request<CompanyWalletState>("/status"),
  deposit: (amountVND: number) => request<{ orderCode: number; checkoutUrl: string; bankTransfer?: { qrUrl?: string; transferContent?: string; amountVND: number } }>("/deposit", "POST", { amountVND }),
  check: (orderCode: number) => request<{ status: string }>(`/deposit/${orderCode}`),
};
