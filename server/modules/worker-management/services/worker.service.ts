import { WorkerModel } from "../models/worker.model";
import type { WorkerStatus } from "../interfaces/worker.interface";

export type WorkerScope = { companyCode: string; branchId?: string };
export type WorkerInput = { fullName?: unknown; phone?: unknown; email?: unknown; status?: unknown; note?: unknown; branchId?: unknown };

export function buildWorkerQuery(scope: WorkerScope) {
  return { companyCode: scope.companyCode, ...(scope.branchId ? { branchId: scope.branchId } : {}), deletedAt: null };
}

export function normalizeWorkerInput(input: WorkerInput) {
  const fullName = String(input.fullName || "").trim();
  if (!fullName) throw new Error("Worker full name is required");
  const status: WorkerStatus = ["active", "inactive", "placed"].includes(String(input.status))
    ? String(input.status) as WorkerStatus
    : "active";
  return {
    fullName,
    ...(input.phone !== undefined ? { phone: String(input.phone || "").trim() } : {}),
    ...(input.email !== undefined ? { email: String(input.email || "").trim().toLowerCase() } : {}),
    status,
    ...(input.note !== undefined ? { note: String(input.note || "").trim() } : {}),
    ...(input.branchId !== undefined ? { branchId: String(input.branchId || "").trim() } : {}),
  };
}

export class WorkerService {
  static list(scope: WorkerScope) { return WorkerModel.find(buildWorkerQuery(scope)).sort({ createdAt: -1 }).lean(); }
  static create(scope: WorkerScope, input: WorkerInput) {
    const data = normalizeWorkerInput(input);
    return WorkerModel.create({ ...data, companyCode: scope.companyCode, branchId: scope.branchId || data.branchId, deletedAt: null });
  }
  static update(scope: WorkerScope, id: string, input: WorkerInput) {
    const data = normalizeWorkerInput(input);
    return WorkerModel.findOneAndUpdate(
      { _id: id, ...buildWorkerQuery(scope) },
      { $set: { ...data, ...(scope.branchId ? { branchId: scope.branchId } : {}) } },
      { new: true },
    ).lean();
  }
  static delete(scope: WorkerScope, id: string) {
    return WorkerModel.findOneAndUpdate({ _id: id, ...buildWorkerQuery(scope) }, { $set: { deletedAt: new Date() } }, { new: true }).lean();
  }
}
