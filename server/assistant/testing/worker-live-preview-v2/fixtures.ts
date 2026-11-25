import { buildWorkerReport } from "../../../modules/worker-management/services/worker-report.service";
import { extraFixture } from './extra-scenarios';
import { moduleFixture } from './module-scenarios';
export const branchId = "64b000000000000000000001";
const id = (number: number) => number.toString(16).padStart(24, "0");
export const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
export const workers = Array.from({ length: 7 }, (_, i) => ({ _id: id(101 + i), id: id(101 + i), fullName: `LAO-DONG-MAU-${String(i + 1).padStart(2, "0")}`, branchId, branchName: "MẪU-QA", status: "active", laborType: "official" }));
export const projects = [
  { _id: id(201), id: id(201), code: "QA-KHO-01", name: "QA-KHO-01", workerIds: workers.slice(0, 3).map(w => w.id), quota: 5 },
  { _id: id(202), id: id(202), code: "QA-BANLE-02", name: "QA-BANLE-02", workerIds: workers.slice(3, 5).map(w => w.id), quota: 2 },
  { _id: id(203), id: id(203), code: "QA-LAB-03", name: "QA-LAB-03", workerIds: workers.slice(3, 7).map(w => w.id), quota: 6 },
].map(project => ({ ...project, branchId, branchName: "MẪU-QA", status: "active", daysOfWeek: [0, 1, 2, 3, 4, 5, 6], location: "Địa điểm mẫu ban đầu", startDate: "2026-01-01", endDate: "2026-12-31" }));
export const contracts = [0, 3, 4].map((index, i) => ({ _id: id(301 + i), id: id(301 + i), code: `HD-QA-${index + 1}`, workerId: workers[index].id, workerName: workers[index].fullName, clientName: "CÔNG TY MẪU QA-OLD", startDate: "2026-01-01", endDate: "2026-12-31", status: "active", branchId }));
const logs = [
  { _id: id(401), projectId: projects[0].id, workerId: workers[0].id, date: today, status: "late", checkIn: { time: new Date(`${today}T09:00:00+07:00`) } },
  { _id: id(402), projectId: projects[0].id, workerId: workers[1].id, date: today, status: "on-time", checkIn: { time: new Date(`${today}T07:00:00+07:00`) } },
];
const normalize = (value: unknown) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").toLowerCase();
const filtered = (rows: any[], url: URL) => {
  const search = normalize(url.searchParams.get("search"));
  const workerId = url.searchParams.get("workerId");
  return rows.filter(row => (!workerId || row.workerId === workerId) && (!search || normalize(Object.values(row).filter(v => typeof v === "string").join(" ")).includes(search)));
};
export function businessFixture(url: URL) {
  if (process.env.ASSISTANT_WORKER_LIVE_CASE_IDS?.includes('N')) {
    const result=moduleFixture(url); if(result!==undefined) return result;
  }
  if (process.env.ASSISTANT_WORKER_LIVE_CASE_IDS?.includes('X')) {
    const extra = extraFixture(url, today);
    if (extra !== undefined) return extra;
  }
  const path = url.pathname.replace(/^\/api\/v1/, "");
  if (path === "/courses") return { success: true, data: [], courses: [], total: 0 };
  if (path === "/auth/branches") return { branches: [{ _id: branchId, id: branchId, name: "MẪU-QA", code: "QA" }], data: [{ _id: branchId, id: branchId, name: "MẪU-QA" }] };
  // WorkerController.list uses scope only; it does not implement search/paging.
  if (path === "/worker-management/workers") return { workers };
  const worker = workers.find(row => path === `/worker-management/workers/${row.id}`);
  if (worker) return { worker };
  if (path === "/worker-management/projects") return { success: true, data: filtered(projects, url), total: projects.length, page: 1, limit: 100 };
  const project = projects.find(row => path === `/worker-management/projects/${row.id}`);
  if (project) return { success: true, data: { ...project, workers: workers.filter(w => project.workerIds.includes(w.id)) } };
  if (path === "/worker-management/labor-contracts") return { success: true, data: filtered(contracts, url), total: filtered(contracts, url).length, page: 1, limit: 100 };
  const contract = contracts.find(row => path === `/worker-management/labor-contracts/${row.id}`);
  if (contract) return { success: true, data: contract };
  if (path === "/worker-management/reports/assistant") {
    const p = url.searchParams;
    return { success: true, data: buildWorkerReport(projects.filter(project => !p.get("projectId") || project.id === p.get("projectId")), workers, logs,
      { mode: (p.get("mode") || "all") as any, projectId: p.get("projectId") || undefined, date: p.get("date") || undefined, from: p.get("from") || undefined, to: p.get("to") || undefined, threshold: p.has("threshold") ? Number(p.get("threshold")) : undefined }, today) };
  }
  if (path === "/worker-management/attendance") return { success: true, data: logs.filter(row => !url.searchParams.get("projectId") || row.projectId === url.searchParams.get("projectId")) };
  if (path === "/worker-management/standard-fields") return { success: true, data: [] };
  if (path === "/kanban/projects") return { projects: [{ _id: id(901), id: id(901), name: "QA-LAB-03", title: "QA-LAB-03" }] };
  throw new Error(`FIXTURE_ROUTE_UNAVAILABLE:${path}`);
}
