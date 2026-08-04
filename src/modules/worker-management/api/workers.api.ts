import { workerApiFetch } from "./client";
import type { Worker, WorkerInput } from "../types";

export const WORKER_BASE = "/worker-management/workers";
export const workerApi = {
  async list() { return (await workerApiFetch<{ workers: Worker[] }>(WORKER_BASE)).workers; },
  async create(input: WorkerInput) { return (await workerApiFetch<{ worker: Worker }>(WORKER_BASE, { method: "POST", body: JSON.stringify(input) })).worker; },
  async update(id: string, input: WorkerInput) { return (await workerApiFetch<{ worker: Worker }>(`${WORKER_BASE}/${id}`, { method: "PATCH", body: JSON.stringify(input) })).worker; },
  async delete(id: string) { return (await workerApiFetch<{ worker: Worker }>(`${WORKER_BASE}/${id}`, { method: "DELETE" })).worker; },
};