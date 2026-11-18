import { Types } from "mongoose";
import { WorkerProjectModel } from "../models/worker-project.model";
import { WorkerModel } from "../models/worker.model";
import { WorkerAttendanceLogModel } from "../models/worker-attendance-log.model";
import { buildWorkerProjectQuery } from "./worker-project.service";
import { vietnamWorkDate } from "./worker-attendance.service";

export interface WorkerReportInput { mode: "all" | "late" | "absent" | "absence-threshold" | "shortage"; projectId?: string; date?: string; from?: string; to?: string; threshold?: number }
export function buildWorkerReport(projects: any[], workers: any[], logs: any[], input: WorkerReportInput, today = vietnamWorkDate()) {
  const names = new Map(workers.map(w => [String(w._id), w.fullName]));
  const from = input.from || input.date || today, to = input.to || input.date || today;
  const dates: string[] = [];
  for (let d = new Date(`${from}T00:00:00Z`); d.toISOString().slice(0, 10) <= to && dates.length < 367; d.setUTCDate(d.getUTCDate() + 1)) dates.push(d.toISOString().slice(0, 10));
  if (from > to || dates.length > 366) throw new Error("Khoảng báo cáo cần từ 1 đến 366 ngày.");
  const rows: Record<string, unknown>[] = [];
  for (const p of projects) {
    const ids = [...new Set<string>((p.workerIds || []).map(String))].filter(id => names.has(id));
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
  const filter = { ...buildWorkerProjectQuery({ companyCode, branchId } as any), ...(input.projectId ? { _id: new Types.ObjectId(input.projectId) } : {}) };
  const projects = await WorkerProjectModel.find(filter).limit(101).lean();
  if (projects.length > 100) throw new Error("Có hơn 100 dự án; chọn một dự án để báo cáo đầy đủ.");
  const ids = projects.flatMap(p => p.workerIds || []);
  const workers = await WorkerModel.find({ _id: { $in: ids }, companyCode, ...(branchId ? { branchId } : {}), deletedAt: null }).select("_id fullName").lean();
  const today = vietnamWorkDate();
  const logs = input.mode === "shortage" ? [] : await WorkerAttendanceLogModel.find({ companyCode, projectId: { $in: projects.map(p => p._id) }, date: { $gte: input.from || input.date || today, $lte: input.to || input.date || today } }).limit(50001).lean();
  if (logs.length > 50000) throw new Error("Khoảng báo cáo quá lớn; chọn khoảng ngày ngắn hơn.");
  return buildWorkerReport(projects, workers, logs, input, today);
}
