import { WorkerModel } from "../models/worker.model";
import { WorkerProjectModel } from "../models/worker-project.model";
import type { WorkerScope } from "../contracts";

export async function getWorkerDashboard(scope: WorkerScope) {
  const query = { companyCode: scope.companyCode, ...(scope.branchId ? { branchId: scope.branchId } : {}), deletedAt: null };
  const [totalWorkers, activeWorkers, projects] = await Promise.all([
    WorkerModel.countDocuments(query),
    WorkerModel.countDocuments({ ...query, status: "active" }),
    WorkerProjectModel.countDocuments(query),
  ]);
  return { totalWorkers, activeWorkers, projects };
}
