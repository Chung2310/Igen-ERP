import { workerApiFetch } from "./client";
export type WorkerDashboard = {
  totalWorkers: number;
  activeWorkers: number;
  projects: number;
  workersByStatus: { active: number; inactive: number; placed: number };
  projectsByStatus: { planned: number; active: number; completed: number };
  monthlyRegistrations: number[];
  topProjects: Array<{ name: string; allocated: number; quota: number }>;
};
export const workerDashboardApi = { async get(companyCode: string, branchId?: string) { return (await workerApiFetch<{ data: WorkerDashboard }>("/worker-management/dashboard", { params: { companyCode, branchId } })).data; } };
