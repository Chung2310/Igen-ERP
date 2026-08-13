import { workerApiFetch } from "./client";
import type {
  WorkerContractAlertSummary,
  WorkerLaborContract,
  WorkerLaborContractInput,
  WorkerScope,
} from "../types";

export const WORKER_CONTRACT_BASE = "/worker-management/labor-contracts";

const scopeParams = (scope: WorkerScope) => ({
  companyCode: scope.companyCode,
  branchId: scope.branchId,
});

type ContractFilters = {
  workerId?: string;
  status?: string;
  alert?: "expiring" | "expired" | "any";
};

export const workerLaborContractApi = {
  async list(scope: WorkerScope, filters: ContractFilters = {}) {
    return (
      await workerApiFetch<{ data: WorkerLaborContract[] }>(WORKER_CONTRACT_BASE, {
        params: { ...scopeParams(scope), ...filters },
      })
    ).data;
  },

  async history(id: string, scope: WorkerScope) {
    return (
      await workerApiFetch<{ data: WorkerLaborContract[] }>(
        `${WORKER_CONTRACT_BASE}/${id}/history`,
        { params: scopeParams(scope) },
      )
    ).data;
  },

  async expiringSummary(scope: WorkerScope) {
    return (
      await workerApiFetch<{ data: WorkerContractAlertSummary }>(
        `${WORKER_CONTRACT_BASE}/expiring-summary`,
        { params: scopeParams(scope) },
      )
    ).data;
  },

  async create(input: WorkerLaborContractInput, scope: WorkerScope) {
    return (
      await workerApiFetch<{ data: WorkerLaborContract }>(WORKER_CONTRACT_BASE, {
        method: "POST",
        body: JSON.stringify(input),
        params: scopeParams(scope),
      })
    ).data;
  },

  async update(id: string, input: Partial<WorkerLaborContractInput>, scope: WorkerScope) {
    return (
      await workerApiFetch<{ data: WorkerLaborContract }>(`${WORKER_CONTRACT_BASE}/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
        params: scopeParams(scope),
      })
    ).data;
  },

  /** Trả về cả kỳ cũ đã khóa và kỳ mới vừa tạo. */
  async renew(id: string, input: WorkerLaborContractInput, scope: WorkerScope) {
    return (
      await workerApiFetch<{
        data: { previous: WorkerLaborContract; current: WorkerLaborContract };
      }>(`${WORKER_CONTRACT_BASE}/${id}/renew`, {
        method: "POST",
        body: JSON.stringify(input),
        params: scopeParams(scope),
      })
    ).data;
  },

  async remove(id: string, scope: WorkerScope) {
    return workerApiFetch<{ success: boolean }>(`${WORKER_CONTRACT_BASE}/${id}`, {
      method: "DELETE",
      params: scopeParams(scope),
    });
  },
};
