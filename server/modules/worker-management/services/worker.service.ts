import { Types } from "mongoose";
import { WorkerModel } from "../models/worker.model";
import { WorkerProjectModel } from "../models/worker-project.model";
import type { WorkerStatus } from "../interfaces/worker.interface";
import type { WorkerScope } from "../contracts";

export type { WorkerScope } from "../contracts";

export type WorkerInput = {
  fullName?: unknown;
  phone?: unknown;
  email?: unknown;
  status?: unknown;
  note?: unknown;
  branchId?: unknown;
  address?: unknown;
  birthday?: unknown;
  idCard?: unknown;
  registrationDate?: unknown;
  customFields?: unknown;
  projectId?: unknown;
};

export function buildWorkerQuery(scope: WorkerScope) {
  return { companyCode: scope.companyCode, ...(scope.branchId ? { branchId: scope.branchId } : {}), deletedAt: null };
}

function normalizeCustomFields(value: unknown) {
  if (!value || Array.isArray(value) || typeof value !== "object") return undefined;
  return value as Record<string, unknown>;
}

export function normalizeWorkerInput(input: WorkerInput) {
  const fullName = String(input.fullName || "").trim();
  if (!fullName) throw new Error("Worker full name is required");
  const status: WorkerStatus = ["active", "inactive", "placed"].includes(String(input.status))
    ? String(input.status) as WorkerStatus
    : "active";
  const customFields = normalizeCustomFields(input.customFields);
  return {
    fullName,
    ...(input.phone !== undefined ? { phone: String(input.phone || "").trim() } : {}),
    ...(input.email !== undefined ? { email: String(input.email || "").trim().toLowerCase() } : {}),
    status,
    ...(input.note !== undefined ? { note: String(input.note || "").trim() } : {}),
    ...(input.address !== undefined ? { address: String(input.address || "").trim() } : {}),
    ...(input.birthday !== undefined ? { birthday: String(input.birthday || "").trim() } : {}),
    ...(input.idCard !== undefined ? { idCard: String(input.idCard || "").trim() } : {}),
    ...(input.registrationDate !== undefined ? { registrationDate: String(input.registrationDate || "").trim() } : {}),
    ...(customFields !== undefined ? { customFields } : {}),
    ...(input.branchId !== undefined ? { branchId: String(input.branchId || "").trim() } : {}),
  };
}

export class WorkerService {
  static list(scope: WorkerScope) { return WorkerModel.find(buildWorkerQuery(scope)).sort({ createdAt: -1 }).lean(); }
  static async create(scope: WorkerScope, input: WorkerInput) {
    const data = normalizeWorkerInput(input);
    const worker = await WorkerModel.create({ ...data, companyCode: scope.companyCode, branchId: scope.branchId || data.branchId, deletedAt: null });
    const projectId = typeof input.projectId === "string" ? input.projectId.trim() : "";
    if (projectId && Types.ObjectId.isValid(projectId)) {
      await WorkerProjectModel.findOneAndUpdate(
        {
          _id: new Types.ObjectId(projectId),
          companyCode: scope.companyCode,
          ...(scope.branchId ? { branchId: scope.branchId } : {}),
          deletedAt: null,
        },
        { $addToSet: { workerIds: worker._id } },
      );
    }
    return worker;
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