import { workerApiFetch } from "./client";
export type WorkerDashboard = { totalWorkers: number; activeWorkers: number; projects: number };
export const workerDashboardApi = { async get(companyCode: string, branchId?: string) { return (await workerApiFetch<{ data: WorkerDashboard }>("/worker-management/dashboard", { params: { companyCode, branchId } })).data; } };
