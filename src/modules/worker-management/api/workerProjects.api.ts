import { workerApiFetch } from "./client";
import type {
  WorkerProject,
  WorkerProjectInput,
  WorkerScope,
} from "../types";

export const WORKER_PROJECTS_BASE = "/worker-management/projects";

const scopeParams = (scope: WorkerScope) => ({
  companyCode: scope.companyCode,
  branchId: scope.branchId,
});

export const workerProjectsApi = {
  async getList(
    scope: WorkerScope,
    filters: { page?: number; limit?: number; search?: string; status?: string } = {},
  ) {
    return await workerApiFetch<{
      data: WorkerProject[];
      total: number;
      page: number;
      limit: number;
    }>(WORKER_PROJECTS_BASE, {
      params: { ...scopeParams(scope), ...filters },
    });
  },

  async getDetail(id: string, scope: WorkerScope) {
    return (
      await workerApiFetch<{ data: WorkerProject }>(
        `${WORKER_PROJECTS_BASE}/${id}`,
        { params: scopeParams(scope) },
      )
    ).data;
  },

  async create(input: WorkerProjectInput, scope: WorkerScope) {
    return (
      await workerApiFetch<{ data: WorkerProject }>(WORKER_PROJECTS_BASE, {
        method: "POST",
        body: JSON.stringify(input),
        params: scopeParams(scope),
      })
    ).data;
  },

  async update(
    id: string,
    input: Partial<WorkerProjectInput>,
    scope: WorkerScope,
  ) {
    return (
      await workerApiFetch<{ data: WorkerProject }>(
        `${WORKER_PROJECTS_BASE}/${id}`,
        {
          method: "PATCH",
          body: JSON.stringify(input),
          params: scopeParams(scope),
        },
      )
    ).data;
  },

  async delete(id: string, scope: WorkerScope) {
    return workerApiFetch<{ message: string }>(
      `${WORKER_PROJECTS_BASE}/${id}`,
      {
        method: "DELETE",
        params: scopeParams(scope),
      },
    );
  },

  async addWorker(id: string, workerId: string, scope: WorkerScope) {
    return (
      await workerApiFetch<{ data: WorkerProject }>(
        `${WORKER_PROJECTS_BASE}/${id}/workers`,
        {
          method: "POST",
          body: JSON.stringify({ workerId }),
          params: scopeParams(scope),
        },
      )
    ).data;
  },

  async addWorkers(id: string, workerIds: string[], scope: WorkerScope) {
    return (
      await workerApiFetch<{ data: WorkerProject }>(
        `${WORKER_PROJECTS_BASE}/${id}/workers/bulk`,
        {
          method: "POST",
          body: JSON.stringify({ workerIds }),
          params: scopeParams(scope),
        },
      )
    ).data;
  },

  async removeWorker(id: string, workerId: string, scope: WorkerScope) {
    return (
      await workerApiFetch<{ data: WorkerProject }>(
        `${WORKER_PROJECTS_BASE}/${id}/workers/${workerId}`,
        {
          method: "DELETE",
          params: scopeParams(scope),
        },
      )
    ).data;
  },
};
