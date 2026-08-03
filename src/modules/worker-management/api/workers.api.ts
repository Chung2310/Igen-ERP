import { apiFetch } from "../../shared-management/api";
import type { Worker, WorkerInput } from "../types";
export const workerApi = {
  async list() { return (await apiFetch<{ workers: Worker[] }>("/workers")).workers; },
  async create(input: WorkerInput) { return (await apiFetch<{ worker: Worker }>("/workers", { method: "POST", body: JSON.stringify(input) })).worker; },
  async update(id: string, input: WorkerInput) { return (await apiFetch<{ worker: Worker }>(`/workers/${id}`, { method: "PATCH", body: JSON.stringify(input) })).worker; },
  async delete(id: string) { return (await apiFetch<{ worker: Worker }>(`/workers/${id}`, { method: "DELETE" })).worker; },
};
