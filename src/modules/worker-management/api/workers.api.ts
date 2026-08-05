import { workerApiFetch } from "./client";
import type { Worker, WorkerInput, WorkerScope } from "../types";

export const WORKER_BASE = "/worker-management/workers";

const scopeParams = (scope: WorkerScope) => ({
  companyCode: scope.companyCode,
  branchId: scope.branchId,
});

export const workerApi = {
  async list(scope: WorkerScope) {
    return (
      await workerApiFetch<{ workers: Worker[] }>(WORKER_BASE, {
        params: scopeParams(scope),
      })
    ).workers;
  },

  async create(input: WorkerInput, scope: WorkerScope) {
    return (
      await workerApiFetch<{ worker: Worker }>(WORKER_BASE, {
        method: "POST",
        body: JSON.stringify(input),
        params: scopeParams(scope),
      })
    ).worker;
  },

  async update(id: string, input: WorkerInput, scope: WorkerScope) {
    return (
      await workerApiFetch<{ worker: Worker }>(`${WORKER_BASE}/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
        params: scopeParams(scope),
      })
    ).worker;
  },

  async delete(id: string, scope: WorkerScope) {
    return (
      await workerApiFetch<{ worker: Worker }>(`${WORKER_BASE}/${id}`, {
        method: "DELETE",
        params: scopeParams(scope),
      })
    ).worker;
  },
};
