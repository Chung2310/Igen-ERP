import { normalizeLeadContractCode, normalizeLeadContractProvider } from "../../../../../shared/marketing-suite/telecom-invoice";

export type ContractLeadIdentity = { fieldKey: string; code: string; provider: string; providerFieldKey?: string };

export function contractDocumentKey(provider: string, code: string) {
  const normalizedProvider = normalizeLeadContractProvider(provider);
  const normalizedCode = normalizeLeadContractCode(code);
  if (!normalizedProvider || !normalizedCode) throw new Error("Nhà mạng hoặc số hợp đồng không hợp lệ.");
  return `contract:${encodeURIComponent(normalizedProvider)}:${encodeURIComponent(normalizedCode)}`;
}
