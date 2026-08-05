import { WorkerModel } from "../models/worker.model";
import { WorkerProjectModel } from "../models/worker-project.model";
import type { WorkerScope } from "../contracts";

export async function getWorkerDashboard(scope: WorkerScope) {
  const query = { companyCode: scope.companyCode, ...(scope.branchId ? { branchId: scope.branchId } : {}), deletedAt: null };
  const [totalWorkers, activeWorkers, projects, allWorkers, allProjects] = await Promise.all([
    WorkerModel.countDocuments(query),
    WorkerModel.countDocuments({ ...query, status: "active" }),
    WorkerProjectModel.countDocuments(query),
    WorkerModel.find(query).select("status registrationDate").lean(),
    WorkerProjectModel.find(query).select("status name quota workerIds").lean(),
  ]);

  // Group workers by status
  const workersByStatus = { active: 0, inactive: 0, placed: 0 };
  allWorkers.forEach((w) => {
    if (w.status === "active") workersByStatus.active++;
    else if (w.status === "inactive") workersByStatus.inactive++;
    else if (w.status === "placed") workersByStatus.placed++;
  });

  // Group projects by status
  const projectsByStatus = { planned: 0, active: 0, completed: 0 };
  allProjects.forEach((p) => {
    if (p.status === "planned") projectsByStatus.planned++;
    else if (p.status === "active") projectsByStatus.active++;
    else if (p.status === "completed") projectsByStatus.completed++;
  });

  // Monthly registrations for current year
  const currentYear = new Date().getFullYear();
  const monthlyRegistrations = Array(12).fill(0);
  allWorkers.forEach((w) => {
    if (!w.registrationDate) return;
    let date: Date | null = null;
    if (w.registrationDate.includes("/")) {
      const parts = w.registrationDate.split("/").map(Number);
      if (parts.length === 3 && !isNaN(parts[2])) {
        date = new Date(parts[2], parts[1] - 1, parts[0]);
      }
    } else {
      const parsed = Date.parse(w.registrationDate);
      if (!isNaN(parsed)) {
        date = new Date(parsed);
      }
    }

    if (date && date.getFullYear() === currentYear) {
      const month = date.getMonth();
      if (month >= 0 && month < 12) {
        monthlyRegistrations[month]++;
      }
    }
  });

  // Top projects with resource allocation
  const topProjects = allProjects.slice(0, 5).map((p) => ({
    name: p.name,
    allocated: p.workerIds?.length || 0,
    quota: p.quota || 0,
  }));

  return {
    totalWorkers,
    activeWorkers,
    projects,
    workersByStatus,
    projectsByStatus,
    monthlyRegistrations,
    topProjects,
  };
}
