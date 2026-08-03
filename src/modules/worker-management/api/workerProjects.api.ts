import { apiFetch } from "../../shared-management/api";
import type { WorkerProject, WorkerProjectInput } from "../types";

export const workerProjectsApi = {
  async getList() {
    return (await apiFetch<{ data: WorkerProject[] }>("/batches")).data;
  },
  async getDetail(id: string) {
    return (await apiFetch<{ data: WorkerProject }>(`/batches/${id}`)).data;
  },
  async create(input: WorkerProjectInput) {
    return (await apiFetch<{ data: WorkerProject }>("/batches", {
      method: "POST",
      body: JSON.stringify(input),
    })).data;
  },
  async update(id: string, input: Partial<WorkerProjectInput>) {
    return (await apiFetch<{ data: WorkerProject }>(`/batches/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    })).data;
  },
  async delete(id: string) {
    return (await apiFetch<{ message: string }>(`/batches/${id}`, {
      method: "DELETE",
    }));
  },
  async addWorker(id: string, workerId: string) {
    return (await apiFetch<{ data: WorkerProject }>(`/batches/${id}/workers`, {
      method: "POST",
      body: JSON.stringify({ workerId }),
    })).data;
  },
  async removeWorker(id: string, workerId: string) {
    return (await apiFetch<{ data: WorkerProject }>(`/batches/${id}/workers/${workerId}`, {
      method: "DELETE",
    })).data;
  },
};
