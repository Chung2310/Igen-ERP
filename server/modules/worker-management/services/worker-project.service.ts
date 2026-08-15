import { WorkerProjectModel } from "../models/worker-project.model";
import { WorkerScope, WorkerProjectInput } from "../interfaces/worker-project.interface";
import { Types } from "mongoose";
import { WorkerModel } from "../models/worker.model";
import { buildWorkerQuery } from "./worker.service";

export function buildWorkerProjectQuery(scope: WorkerScope) {
  return {
    companyCode: scope.companyCode,
    ...(scope.branchId ? { branchId: new Types.ObjectId(scope.branchId) } : {}),
    deletedAt: null,
  };
}

export function normalizeWorkerProjectInput(input: WorkerProjectInput) {
  const name = String(input.name || "").trim();
  if (!name) throw new Error("Project name is required");
  return {
    name,
    code: String(input.code || "").trim().toUpperCase(),
    quota: input.quota === undefined || input.quota === "" ? 0 : Number(input.quota),
    workerIds: Array.isArray(input.workerIds) ? input.workerIds.map((id) => new Types.ObjectId(id)) : [],
    daysOfWeek: Array.isArray(input.daysOfWeek) ? input.daysOfWeek.map(Number) : [],
    startTime: String(input.startTime || "08:00"),
    endTime: String(input.endTime || "17:00"),
    location: String(input.location || "").trim(),
    startDate: String(input.startDate || ""),
    endDate: String(input.endDate || ""),
    status: ["planned", "active", "completed"].includes(String(input.status))
      ? (String(input.status) as "planned" | "active" | "completed")
      : "planned",
    note: String(input.note || "").trim(),
    geoLocation: input.geoLocation
      ? {
          latitude: Number(input.geoLocation.latitude),
          longitude: Number(input.geoLocation.longitude),
          radiusMeters: Number(input.geoLocation.radiusMeters),
        }
      : null,
  };
}

async function assertWorkersInScope(
  scope: WorkerScope,
  workerIds: Types.ObjectId[],
) {
  for (const workerId of workerIds) {
    const worker = await WorkerModel.findOne({
      _id: workerId,
      ...buildWorkerQuery(scope),
    });
    if (!worker) throw new Error("Worker not found.");
  }
}

async function assertWorkersInScopeBulk(
  scope: WorkerScope,
  workerIds: Types.ObjectId[],
) {
  const count = await WorkerModel.countDocuments({
    _id: { $in: workerIds },
    ...buildWorkerQuery(scope),
  });
  if (count !== workerIds.length) throw new Error("Worker not found.");
}
export const WorkerProjectService = {
  async list(scope: WorkerScope, queryFilters: any = {}) {
    const baseQuery = buildWorkerProjectQuery(scope);
    const query = { ...baseQuery, ...queryFilters };
    return WorkerProjectModel.find(query).sort({ createdAt: -1 }).lean();
  },

  async getDetail(scope: WorkerScope, id: string) {
    const baseQuery = buildWorkerProjectQuery(scope);
    return WorkerProjectModel.findOne({ _id: new Types.ObjectId(id), ...baseQuery }).lean();
  },

  async create(scope: WorkerScope, input: WorkerProjectInput) {
    const normalized = normalizeWorkerProjectInput(input);
    
    // Check code uniqueness per company
    const existing = await WorkerProjectModel.findOne({
      companyCode: scope.companyCode,
      code: normalized.code,
      deletedAt: null,
    });
    if (existing) {
      throw new Error("Mã dự án đã tồn tại trong hệ thống.");
    }

    await assertWorkersInScope(scope, normalized.workerIds);

    const project = new WorkerProjectModel({
      ...normalized,
      companyCode: scope.companyCode,
      ...(scope.branchId ? { branchId: new Types.ObjectId(scope.branchId) } : {}),
    });
    return project.save();
  },

  async update(scope: WorkerScope, id: string, input: WorkerProjectInput) {
    const normalized = normalizeWorkerProjectInput(input);
    const baseQuery = buildWorkerProjectQuery(scope);
    
    // Check code uniqueness per company if changed
    const existing = await WorkerProjectModel.findOne({
      _id: { $ne: new Types.ObjectId(id) },
      companyCode: scope.companyCode,
      code: normalized.code,
      deletedAt: null,
    });
    if (existing) {
      throw new Error("Mã dự án đã tồn tại trong hệ thống.");
    }

    await assertWorkersInScope(scope, normalized.workerIds);

    const project = await WorkerProjectModel.findOneAndUpdate(
      { _id: new Types.ObjectId(id), ...baseQuery },
      { $set: normalized },
      { new: true }
    );
    if (!project) {
      throw new Error("Không tìm thấy dự án hoặc bạn không có quyền chỉnh sửa.");
    }
    return project;
  },

  async delete(scope: WorkerScope, id: string) {
    const baseQuery = buildWorkerProjectQuery(scope);
    const project = await WorkerProjectModel.findOneAndUpdate(
      { _id: new Types.ObjectId(id), ...baseQuery },
      { $set: { deletedAt: new Date() } },
      { new: true }
    );
    if (!project) {
      throw new Error("Không tìm thấy dự án hoặc bạn không có quyền xóa.");
    }
    return project;
  },

  async addWorker(scope: WorkerScope, id: string, workerId: string) {
    const worker = await WorkerModel.findOne({
      _id: new Types.ObjectId(workerId),
      ...buildWorkerQuery(scope),
    });
    if (!worker) throw new Error("Worker not found.");

    const baseQuery = buildWorkerProjectQuery(scope);
    const project = await WorkerProjectModel.findOneAndUpdate(
      { _id: new Types.ObjectId(id), ...baseQuery },
      { $addToSet: { workerIds: new Types.ObjectId(workerId) } },
      { new: true }
    );
    if (!project) {
      throw new Error("Không tìm thấy dự án hoặc bạn không có quyền cập nhật.");
    }
    return project;
  },

  async addWorkers(scope: WorkerScope, id: string, workerIds: string[]) {
    const ids = [...new Set(workerIds.map((workerId) => String(workerId)))].map((workerId) => new Types.ObjectId(workerId));
    await assertWorkersInScopeBulk(scope, ids);
    const baseQuery = buildWorkerProjectQuery(scope);
    const project = await WorkerProjectModel.findOneAndUpdate(
      { _id: new Types.ObjectId(id), ...baseQuery },
      { $addToSet: { workerIds: { $each: ids } } },
      { new: true },
    );
    if (!project) {
      throw new Error("Không tìm thấy dự án hoặc bạn không có quyền cập nhật.");
    }
    return project;
  },

  async removeWorker(scope: WorkerScope, id: string, workerId: string) {
    const baseQuery = buildWorkerProjectQuery(scope);
    const project = await WorkerProjectModel.findOneAndUpdate(
      { _id: new Types.ObjectId(id), ...baseQuery },
      { $pull: { workerIds: new Types.ObjectId(workerId) } },
      { new: true }
    );
    if (!project) {
      throw new Error("Không tìm thấy dự án hoặc bạn không có quyền cập nhật.");
    }
    return project;
  },
};
