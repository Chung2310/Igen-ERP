import { browserTransport, type ServiceTransport } from "./serviceTransport";
import type { Contract, ContractFileItem, Employee, Extension } from "../types/hrContract";
import type { PaginatedResponse } from "../types/pagination";

export interface ContractFilters {
  companyCode: string;
  branchId?: string;
  page?: number;
  limit?: number;
  employeeId?: string;
  search?: string;
}
export interface ContractList {
  contracts: Contract[];
  employees: Employee[];
  expiringContracts: Contract[];
  total: number;
  page: number;
  limit: number;
}
export type ContractInput = Pick<Contract, "contractType" | "employeeId" | "startDate" | "endDate" | "status" | "note">;
export type ContractScope = Pick<ContractFilters, "companyCode" | "branchId">;
export type ExtensionInput = Pick<Extension, "newEndDate" | "extensionDate" | "reason">;
export type ContractAttachments = Partial<Pick<Contract, "contractFiles" | "signedImages">>;
export type ExtensionAttachments = Partial<Pick<Extension, "extensionFiles" | "signedImages">>;
export type ContractUploadKind = "contract" | "signed" | "extension" | "extensionSigned";
export function createHrContractService({ fetch, getAccessToken }: ServiceTransport) {
  async function request(path: string, filters: object, init: RequestInit = {}) {
    const query = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== "") query.set(key, String(value));
    });
    const response = await fetch(`/api/v1/hr-contracts${path}?${query}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${getAccessToken()}`,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
      },
    });
    const body = await response.json();
    if (!response.ok)
      throw Object.assign(new Error(body.message || "Không tải được hợp đồng."), { status: response.status });
    return body;
  }
  return {
    async upload(
      scope: ContractScope,
      value: { file: string; name: string; mimeType: string; size: number; kind: ContractUploadKind },
      signal?: AbortSignal,
    ): Promise<Pick<ContractFileItem, "url" | "uploadToken">> {
      return (await request("/upload", scope, { method: "POST", body: JSON.stringify(value), signal })).data;
    },
    async extend(
      scope: ContractScope,
      id: string,
      value: ExtensionInput & ExtensionAttachments,
    ): Promise<{ contract: Contract; extension: Extension }> {
      return (
        await request(`/${encodeURIComponent(id)}/extensions`, scope, {
          method: "POST",
          body: JSON.stringify(value),
        })
      ).data;
    },
    async create(scope: ContractScope, value: ContractInput & ContractAttachments): Promise<Contract> {
      return (await request("", scope, { method: "POST", body: JSON.stringify(value) })).data;
    },
    async update(
      scope: ContractScope,
      id: string,
      value: Partial<ContractInput> & ContractAttachments,
    ): Promise<Contract> {
      return (await request(`/${encodeURIComponent(id)}`, scope, { method: "PATCH", body: JSON.stringify(value) }))
        .data;
    },
    async list(filters: ContractFilters): Promise<ContractList> {
      return (await request("", filters)).data;
    },
    async extensions(
      filters: Pick<ContractFilters, "companyCode" | "branchId" | "page" | "limit"> & { contractId?: string },
    ): Promise<PaginatedResponse<Extension>> {
      const body = await request("/extensions/list", filters);
      return { data: body.data, pagination: body.pagination };
    },
  };
}
export const hrContractService = createHrContractService(browserTransport);
