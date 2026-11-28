import { Types } from "mongoose";
import { WorkerProjectModel } from "../models/worker-project.model";
import { WorkerModel } from "../models/worker.model";
import { WorkerAttendanceLogModel } from "../models/worker-attendance-log.model";
import { WorkerLaborContractModel } from "../models/worker-labor-contract.model";
import { LaborPartnerSettlementModel } from "../labor-partners/models/settlement.model";
import { buildWorkerProjectQuery } from "./worker-project.service";
import { vietnamWorkDate } from "./worker-attendance.service";

export interface WorkerReportInput { mode: "all" | "late" | "absent" | "absence-threshold" | "shortage" | "filled" | "gps-enabled" | "labor-types"; projectId?: string; date?: string; from?: string; to?: string; threshold?: number }
export interface WorkerOverviewReportInput { from: string; to: string }
export function buildLaborTypeCounts(workers: Array<{ laborType?: string }>) {
  return ["official", "seasonal", "foreign"].map((laborType) => ({
    laborType,
    workerCount: workers.filter((worker) => (worker.laborType || "official") === laborType).length,
  }));
}
export function buildWorkerReport(projects: any[], workers: any[], logs: any[], input: WorkerReportInput, today = vietnamWorkDate()) {
  const names = new Map(workers.map(w => [String(w._id), w.fullName]));
  const from = input.from || input.date || today, to = input.to || input.date || today;
  const dates: string[] = [];
  for (let d = new Date(`${from}T00:00:00Z`); d.toISOString().slice(0, 10) <= to && dates.length < 367; d.setUTCDate(d.getUTCDate() + 1)) dates.push(d.toISOString().slice(0, 10));
  if (from > to || dates.length > 366) throw new Error("Khoảng báo cáo cần từ 1 đến 366 ngày.");
  const rows: Record<string, unknown>[] = [];
  for (const p of projects) {
    const ids = [...new Set<string>((p.workerIds || []).map(String))].filter(id => names.has(id));
    if (input.mode === "gps-enabled") {
      const geo = p.geoLocation;
      if (geo?.latitude != null && geo?.longitude != null) rows.push({ projectName: p.name, gpsAttendanceEnabled: true });
      continue;
    }
    if (input.mode === "filled") {
      const quota = Number(p.quota || 0);
      if (quota > 0 && ids.length >= quota) rows.push({ projectName: p.name, quota, allocated: ids.length, gap: 0 });
      continue;
    }
    if (input.mode === "shortage") {
      const gap = Math.max(0, Number(p.quota || 0) - ids.length);
      if (gap) rows.push({ projectName: p.name, quota: p.quota, allocated: ids.length, gap });
      continue;
    }
    for (const id of ids) {
      let absent = 0;
      for (const date of dates) {
        if (date > today || p.startDate && date < p.startDate || p.endDate && date > p.endDate) continue;
        const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
        if (p.daysOfWeek?.length && !p.daysOfWeek.includes(weekday)) continue;
        const log = logs.find(l => String(l.projectId) === String(p._id) && String(l.workerId) === id && l.date === date);
        const missing = !log?.checkIn?.time;
        if (missing) absent++;
        if (input.mode === "absence-threshold" || input.mode === "late" && !String(log?.status).includes("late") || input.mode === "absent" && !missing) continue;
        rows.push({ projectName: p.name, workerName: names.get(id), date, attendanceStatus: missing ? "Chưa chấm công (chưa xác nhận vắng)" : log.status, checkIn: log?.checkIn?.time?.toISOString?.(), checkOut: log?.checkOut?.time?.toISOString?.() });
      }
      if (input.mode === "absence-threshold" && absent > (input.threshold ?? 3)) rows.push({ projectName: p.name, workerName: names.get(id), from, to, absentDays: absent, note: "Số ngày có lịch làm nhưng chưa có giờ vào; cần đối chiếu trước khi xác nhận vắng." });
    }
  }
  if (rows.length > 50000) throw new Error("Báo cáo có quá nhiều dòng; chọn khoảng ngày hoặc dự án cụ thể.");
  return rows;
}

export async function workerReport(companyCode: string, branchId: string | undefined, input: WorkerReportInput) {
  if (input.mode === "labor-types") {
    const workers = await WorkerModel.find({ companyCode, ...(branchId ? { branchId } : {}), deletedAt: null }).select("laborType").lean();
    return buildLaborTypeCounts(workers);
  }
  const filter = { ...buildWorkerProjectQuery({ companyCode, branchId } as any), ...(input.projectId ? { _id: new Types.ObjectId(input.projectId) } : {}) };
  const projects = await WorkerProjectModel.find(filter).limit(101).lean();
  if (projects.length > 100) throw new Error("Có hơn 100 dự án; chọn một dự án để báo cáo đầy đủ.");
  const ids = projects.flatMap(p => p.workerIds || []);
  const workers = await WorkerModel.find({ _id: { $in: ids }, companyCode, ...(branchId ? { branchId } : {}), deletedAt: null }).select("_id fullName").lean();
  const today = vietnamWorkDate();
  const logs = ["shortage", "filled", "gps-enabled"].includes(input.mode) ? [] : await WorkerAttendanceLogModel.find({ companyCode, projectId: { $in: projects.map(p => p._id) }, date: { $gte: input.from || input.date || today, $lte: input.to || input.date || today } }).limit(50001).lean();
  if (logs.length > 50000) throw new Error("Khoảng báo cáo quá lớn; chọn khoảng ngày ngắn hơn.");
  return buildWorkerReport(projects, workers, logs, input, today);
}

export function buildWorkerOverviewReport(
  projects: any[], workers: any[], logs: any[], contracts: any[], settlements: any[],
  from: string, to: string, today = vietnamWorkDate(),
) {
  const workerIds = new Set(workers.map((worker) => String(worker._id)));
  const attendanceByShift = new Set(logs.filter((log) => log.checkIn?.time).map((log) => `${String(log.projectId)}:${String(log.workerId)}:${log.date}`));
  let scheduledWorkCount = 0;
  let attendedWorkCount = 0;
  const periodEnd = to < today ? to : today;
  for (const project of projects) {
    const assignedIds = [...new Set<string>((project.workerIds || []).map(String))].filter((id) => workerIds.has(id));
    if (!assignedIds.length) continue;
    const projectFrom = project.startDate && project.startDate > from ? project.startDate : from;
    const projectTo = project.endDate && project.endDate < periodEnd ? project.endDate : periodEnd;
    for (let cursor = new Date(`${projectFrom}T00:00:00.000Z`); cursor.toISOString().slice(0, 10) <= projectTo; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
      const date = cursor.toISOString().slice(0, 10);
      const weekday = new Date(`${date}T00:00:00.000Z`).getUTCDay();
      if (project.daysOfWeek?.length && !project.daysOfWeek.includes(weekday)) continue;
      for (const workerId of assignedIds) {
        scheduledWorkCount++;
        if (attendanceByShift.has(`${String(project._id)}:${workerId}:${date}`)) attendedWorkCount++;
      }
    }
  }

  const unpaidSettlements = settlements.filter((settlement) => settlement.status !== "void" && Number(settlement.balanceAmount) > 0);
  const expiringContracts = contracts.map((contract) => ({
    code: String(contract.code || ""),
    workerName: String(contract.workerName || ""),
    clientName: String(contract.clientName || ""),
    endDate: String(contract.endDate || ""),
  }));
  const unpaidCommissionSettlements = unpaidSettlements.map((settlement) => ({
    partnerName: String(settlement.partnerId?.name || ""),
    periodStart: String(settlement.periodStart || ""),
    periodEnd: String(settlement.periodEnd || ""),
    balanceAmount: Math.max(0, Number(settlement.balanceAmount) || 0),
  }));
  return {
    from,
    to,
    projectCount: projects.length,
    workerCount: workers.length,
    attendanceRate: scheduledWorkCount ? Math.round(attendedWorkCount * 10000 / scheduledWorkCount) / 100 : null,
    attendedWorkCount,
    scheduledWorkCount,
    expiringContractCount: expiringContracts.length,
    expiringContracts,
    unpaidCommissionAmount: unpaidCommissionSettlements.reduce((sum, settlement) => sum + settlement.balanceAmount, 0),
    unpaidCommissionSettlementCount: unpaidCommissionSettlements.length,
    unpaidCommissionSettlements,
  };
}

export async function workerOverviewReport(companyCode: string, branchId: string | undefined, input: WorkerOverviewReportInput) {
  const validDate = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  };
  if (!validDate(input.from) || !validDate(input.to) || input.from > input.to) throw new Error("Khoáº£ng ngÃ y bÃ¡o cÃ¡o khÃ´ng há»£p lá»‡.");
  const projectScope = buildWorkerProjectQuery({ companyCode, branchId } as any);
  const workerScope = { companyCode, ...(branchId ? { branchId } : {}), deletedAt: null };
  const [projects, workers, contracts, settlements] = await Promise.all([
    WorkerProjectModel.find(projectScope).select("_id workerIds daysOfWeek startDate endDate").lean(),
    WorkerModel.find(workerScope).select("_id").lean(),
    WorkerLaborContractModel.find({ companyCode, ...(branchId ? { branchId: new Types.ObjectId(branchId) } : {}), deletedAt: null, status: "active", endDate: { $gte: input.from, $lte: input.to } }).select("code workerId clientName endDate").lean(),
    (LaborPartnerSettlementModel as any).find({ companyCode, ...(branchId ? { branchId } : {}), periodStart: { $lte: input.to }, periodEnd: { $gte: input.from }, balanceAmount: { $gt: 0 }, status: { $ne: "void" } }).populate("partnerId", "name").select("partnerId periodStart periodEnd balanceAmount status").lean(),
  ]);
  const projectIds = projects.map((project) => project._id);
  const [logs, contractWorkers] = await Promise.all([
    projectIds.length ? WorkerAttendanceLogModel.find({ companyCode, ...(branchId ? { branchId: new Types.ObjectId(branchId) } : {}), projectId: { $in: projectIds }, date: { $gte: input.from, $lte: input.to } }).select("projectId workerId date checkIn.time").lean() : [],
    contracts.length ? WorkerModel.find({ _id: { $in: contracts.map((contract) => contract.workerId) }, ...workerScope }).select("_id fullName").lean() : [],
  ]);
  const workerNames = new Map(contractWorkers.map((worker): [string, string] => [String(worker._id), String(worker.fullName || "")]));
  const enrichedContracts = contracts.map((contract) => ({ ...contract, workerName: workerNames.get(String(contract.workerId)) || "" }));
  return buildWorkerOverviewReport(projects, workers, logs, enrichedContracts, settlements, input.from, input.to);
}
