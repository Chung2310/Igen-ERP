import { Types } from "mongoose";
import { WorkerLaborContractModel } from "../models/worker-labor-contract.model";
import { WorkerModel } from "../models/worker.model";
import { buildWorkerQuery } from "./worker.service";
import type { WorkerScope } from "../interfaces/worker-project.interface";
import {
  WORKER_CONTRACT_ALERT_DAYS,
  type WorkerContractAlertLevel,
  type WorkerLaborContractInput,
  type WorkerLaborContractStatus,
} from "../interfaces/worker-labor-contract.interface";

export const LOCKED_CONTRACT_FIELDS = ["code", "clientName", "startDate", "endDate"] as const;

export function buildWorkerLaborContractQuery(scope: WorkerScope) {
  return {
    companyCode: scope.companyCode,
    ...(scope.branchId ? { branchId: new Types.ObjectId(scope.branchId) } : {}),
    deletedAt: null,
  };
}

export function isValidIsoCalendarDate(value: string): boolean {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function daysUntil(endDate: string, today = new Date()): number | null {
  const parts = String(endDate || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!parts) return null;
  const end = Date.UTC(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]));
  const now = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((end - now) / 86_400_000);
}

export function contractBusinessDate(today = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(today);
}

export function resolveAlertLevel(
  endDate: string,
  status: WorkerLaborContractStatus,
  today = new Date(),
  alertDays = WORKER_CONTRACT_ALERT_DAYS,
): WorkerContractAlertLevel {
  if (status === "renewed" || status === "terminated") return "ok";
  const remaining = daysUntil(endDate, today);
  if (remaining === null) return "ok";
  if (remaining < 0) return "expired";
  if (remaining <= alertDays) return "expiring";
  return "ok";
}

export function normalizeWorkerLaborContractInput(input: WorkerLaborContractInput) {
  const code = String(input.code || "").trim().toUpperCase();
  if (!code) throw new Error("Mã hợp đồng là bắt buộc.");
  const clientName = String(input.clientName || "").trim();
  if (!clientName) throw new Error("Khách hàng / đơn vị sử dụng lao động là bắt buộc.");
  const startDate = String(input.startDate || "").trim();
  const endDate = String(input.endDate || "").trim();
  if (!startDate || !endDate) throw new Error("Ngày bắt đầu và ngày kết thúc là bắt buộc.");
  if (!isValidIsoCalendarDate(startDate) || !isValidIsoCalendarDate(endDate)) {
    throw new Error("Ngày hợp đồng phải là ngày hợp lệ theo định dạng YYYY-MM-DD.");
  }
  if (endDate <= startDate) throw new Error("Ngày kết thúc phải sau ngày bắt đầu.");
  return {
    code,
    clientName,
    startDate,
    endDate,
    status: (["draft", "active", "terminated"].includes(String(input.status))
      ? String(input.status)
      : "active") as WorkerLaborContractStatus,
    note: String(input.note || "").trim(),
  };
}

async function assertWorkerInScope(scope: WorkerScope, workerId: Types.ObjectId) {
  const worker = await WorkerModel.findOne({ _id: workerId, ...buildWorkerQuery(scope) });
  if (!worker) throw new Error("Không tìm thấy người lao động trong phạm vi của bạn.");
}

async function assertWorkerHasNoCurrentContract(
  scope: WorkerScope,
  workerId: Types.ObjectId,
  today: Date,
) {
  const existing = await WorkerLaborContractModel.findOne({
    ...buildWorkerLaborContractQuery(scope),
    workerId,
    status: { $in: ["draft", "active"] },
    endDate: { $gte: contractBusinessDate(today) },
  });
  if (existing) {
    throw new Error(
      "Người lao động đang có hợp đồng còn hiệu lực. Vui lòng gia hạn hoặc chấm dứt hợp đồng hiện tại trước khi tạo mới.",
    );
  }
}

async function assertCodeAvailable(
  scope: WorkerScope,
  code: string,
  excludeId?: string,
  session?: any,
) {
  const existing = await WorkerLaborContractModel.findOne({
    ...(excludeId ? { _id: { $ne: new Types.ObjectId(excludeId) } } : {}),
    companyCode: scope.companyCode,
    code,
    deletedAt: null,
  }, null, session ? { session } : undefined);
  if (existing) throw new Error("Mã hợp đồng đã tồn tại trong hệ thống.");
}

export function withAlertLevel<T extends { endDate: string; status: WorkerLaborContractStatus }>(
  contract: T,
  today = new Date(),
) {
  const alertLevel = resolveAlertLevel(contract.endDate, contract.status, today);
  return {
    ...contract,
    status: alertLevel === "expired" ? ("expired" as const) : contract.status,
    alertLevel,
  };
}

export const WorkerLaborContractService = {
  async list(scope: WorkerScope, queryFilters: any = {}, today = new Date()) {
    const { alert, status, page, limit, search, clientName, ...filters } = queryFilters || {};
    const query: any = {
      ...buildWorkerLaborContractQuery(scope),
      ...filters,
    };
    if (filters.workerId) query.workerId = new Types.ObjectId(String(filters.workerId));
    if (clientName && clientName !== "all") query.clientName = clientName;

    const todayStr = today.toISOString().slice(0, 10);
    const warningDate = new Date(today.getTime() + WORKER_CONTRACT_ALERT_DAYS * 86_400_000);
    const warningDateStr = warningDate.toISOString().slice(0, 10);

    // Filter by status
    if (status) {
      if (status === "expired") {
        query.status = { $nin: ["renewed", "terminated"] };
        query.endDate = { $lt: todayStr };
      } else if (status === "active") {
        query.status = "active";
        query.endDate = { $gte: todayStr };
      } else {
        query.status = status;
      }
    }

    // Filter by alert
    if (alert) {
      if (alert === "expired") {
        query.status = { $nin: ["renewed", "terminated"] };
        query.endDate = { $lt: todayStr };
      } else if (alert === "expiring") {
        query.status = { $nin: ["renewed", "terminated"] };
        query.endDate = { $gte: todayStr, $lte: warningDateStr };
      } else if (alert === "any") {
        query.status = { $nin: ["renewed", "terminated"] };
        query.endDate = { $lte: warningDateStr };
      }
    }

    // Search query
    if (search && search.trim()) {
      const cleanSearch = search.trim();
      const matchingWorkers = await WorkerModel.find({
        companyCode: scope.companyCode,
        fullName: { $regex: cleanSearch, $options: "i" },
      }).select("_id").lean();

      const workerIds = matchingWorkers.map((w) => w._id);

      query.$or = [
        { code: { $regex: cleanSearch, $options: "i" } },
        { clientName: { $regex: cleanSearch, $options: "i" } },
        { workerId: { $in: workerIds } },
      ];
    }

    const currentPage = Number(page) || 1;
    const currentLimit = Number(limit) || 10;
    const skip = (currentPage - 1) * currentLimit;

    const [items, total, uniqueClients] = await Promise.all([
      WorkerLaborContractModel.find(query)
        .sort({ endDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(currentLimit)
        .lean(),
      WorkerLaborContractModel.countDocuments(query),
      WorkerLaborContractModel.distinct("clientName", buildWorkerLaborContractQuery(scope)),
    ]);

    const decorated = items.map((item: any) => withAlertLevel(item, today));
    return {
      contracts: decorated,
      total,
      page: currentPage,
      limit: currentLimit,
      clients: uniqueClients.filter(Boolean),
    };
  },

  async getDetail(scope: WorkerScope, id: string) {
    const contract = await WorkerLaborContractModel.findOne({
      _id: new Types.ObjectId(id),
      ...buildWorkerLaborContractQuery(scope),
    }).lean();
    return contract ? withAlertLevel(contract as any) : null;
  },

  async history(scope: WorkerScope, rootContractId: string) {
    const items = await WorkerLaborContractModel.find({
      ...buildWorkerLaborContractQuery(scope),
      rootContractId: new Types.ObjectId(rootContractId),
    })
      .sort({ sequence: 1 })
      .lean();
    return items.map((item: any) => withAlertLevel(item));
  },

  async create(scope: WorkerScope, input: WorkerLaborContractInput, today = new Date()) {
    const normalized = normalizeWorkerLaborContractInput(input);
    const workerId = new Types.ObjectId(String(input.workerId || ""));
    await assertCodeAvailable(scope, normalized.code);
    await assertWorkerInScope(scope, workerId);
    await assertWorkerHasNoCurrentContract(scope, workerId, today);

    const contract = new WorkerLaborContractModel({
      ...normalized,
      workerId,
      sequence: 1,
      previousContractId: null,
      companyCode: scope.companyCode,
      ...(scope.branchId ? { branchId: new Types.ObjectId(scope.branchId) } : {}),
    });
    contract.rootContractId = contract._id as Types.ObjectId;
    return contract.save();
  },

  async update(scope: WorkerScope, id: string, input: WorkerLaborContractInput) {
    const baseQuery = buildWorkerLaborContractQuery(scope);
    const current = await WorkerLaborContractModel.findOne({
      _id: new Types.ObjectId(id),
      ...baseQuery,
    }).lean();
    if (!current) {
      throw new Error("Không tìm thấy hợp đồng hoặc bạn không có quyền chỉnh sửa.");
    }

    const changes: Record<string, unknown> = {};
    if (input.code !== undefined) changes.code = String(input.code).trim().toUpperCase();
    if (input.clientName !== undefined) changes.clientName = String(input.clientName).trim();
    if (input.startDate !== undefined) changes.startDate = String(input.startDate).trim();
    if (input.endDate !== undefined) changes.endDate = String(input.endDate).trim();
    if (input.note !== undefined) changes.note = String(input.note || "").trim();
    if (input.status !== undefined) {
      if (!["draft", "active", "terminated"].includes(String(input.status))) {
        throw new Error("Trạng thái không hợp lệ.");
      }
      changes.status = String(input.status);
    }

    if ((current as any).lockedAt) {
      const blocked = LOCKED_CONTRACT_FIELDS.filter(
        (field) => changes[field] !== undefined && changes[field] !== (current as any)[field],
      );
      if (blocked.length) {
        throw new Error(
          "Kỳ hợp đồng đã kết thúc nên không thể sửa ngày hoặc điều khoản. Hãy tạo kỳ gia hạn mới.",
        );
      }
      if (changes.status !== undefined && changes.status !== "terminated") {
        throw new Error("Kỳ hợp đồng đã kết thúc chỉ có thể chuyển sang trạng thái chấm dứt.");
      }
    }

    const startDate = String(changes.startDate ?? (current as any).startDate);
    const endDate = String(changes.endDate ?? (current as any).endDate);
    if (endDate <= startDate) throw new Error("Ngày kết thúc phải sau ngày bắt đầu.");
    if (changes.code) await assertCodeAvailable(scope, String(changes.code), id);

    const contract = await WorkerLaborContractModel.findOneAndUpdate(
      { _id: new Types.ObjectId(id), ...baseQuery },
      { $set: changes },
      { returnDocument: 'after' },
    );
    if (!contract) {
      throw new Error("Không tìm thấy hợp đồng hoặc bạn không có quyền chỉnh sửa.");
    }
    return contract;
  },

  async renew(
    scope: WorkerScope,
    id: string,
    input: WorkerLaborContractInput,
    actor?: string,
  ) {
    const session = await WorkerLaborContractModel.db.startSession();
    let result: { previous: any; current: any } | undefined;
    try {
      await session.withTransaction(async () => {
        const baseQuery = buildWorkerLaborContractQuery(scope);
        const current: any = await WorkerLaborContractModel.findOne(
          { _id: new Types.ObjectId(id), ...baseQuery },
          null,
          { session },
        ).lean();
        if (!current) {
          throw new Error("Không tìm thấy hợp đồng hoặc bạn không có quyền gia hạn.");
        }
        if (current.status === "renewed" || current.lockedAt) {
          throw new Error("Kỳ hợp đồng này đã được gia hạn. Hãy gia hạn từ kỳ mới nhất.");
        }
        if (current.status === "terminated") {
          throw new Error("Hợp đồng đã chấm dứt nên không thể gia hạn.");
        }

        const normalized = normalizeWorkerLaborContractInput({
          ...input,
          clientName: input.clientName ?? current.clientName,
          status: "active",
        });
        if (normalized.startDate <= current.endDate) {
          throw new Error("Ngày bắt đầu kỳ mới phải sau ngày kết thúc kỳ hiện tại.");
        }
        if (normalized.endDate <= current.endDate) {
          throw new Error("Ngày kết thúc kỳ mới phải sau ngày kết thúc kỳ hiện tại.");
        }
        await assertCodeAvailable(scope, normalized.code, undefined, session);

        const now = new Date();
        const closed = await WorkerLaborContractModel.findOneAndUpdate(
          { _id: current._id, ...baseQuery, status: current.status, lockedAt: null },
          {
            $set: {
              status: "renewed",
              lockedAt: now,
              renewedAt: now,
              ...(actor ? { renewedBy: actor } : {}),
            },
          },
          { returnDocument: 'after', session },
        );
        if (!closed) {
          throw new Error("Hợp đồng vừa được cập nhật ở nơi khác. Vui lòng tải lại và thử lại.");
        }

        const next = new WorkerLaborContractModel({
          ...normalized,
          workerId: current.workerId,
          rootContractId: current.rootContractId || current._id,
          previousContractId: current._id,
          previousEndDate: current.endDate,
          sequence: Number(current.sequence || 1) + 1,
          companyCode: scope.companyCode,
          ...(current.branchId ? { branchId: current.branchId } : {}),
        });
        const saved = await next.save({ session });
        result = { previous: closed, current: saved };
      });
      if (!result) throw new Error("Không thể hoàn tất gia hạn hợp đồng.");
      return result;
    } finally {
      await session.endSession();
    }
  },

  async delete(scope: WorkerScope, id: string) {
    const baseQuery = buildWorkerLaborContractQuery(scope);
    const contractId = new Types.ObjectId(id);
    const current: any = await WorkerLaborContractModel.findOne({
      _id: contractId,
      ...baseQuery,
    }).lean();
    if (!current) {
      throw new Error("Không tìm thấy hợp đồng hoặc bạn không có quyền xóa.");
    }
    if (current.lockedAt || current.status === "renewed") {
      throw new Error("Kỳ hợp đồng đã thuộc lịch sử gia hạn nên không thể xóa.");
    }
    const successor = await WorkerLaborContractModel.findOne({
      ...baseQuery,
      previousContractId: contractId,
    }).lean();
    if (successor) {
      throw new Error("Kỳ hợp đồng đã thuộc lịch sử gia hạn nên không thể xóa.");
    }
    const contract = await WorkerLaborContractModel.findOneAndUpdate(
      { _id: contractId, ...baseQuery, lockedAt: null },
      { $set: { deletedAt: new Date() } },
      { returnDocument: 'after' },
    );
    if (!contract) {
      throw new Error("Không tìm thấy hợp đồng hoặc bạn không có quyền xóa.");
    }
    return contract;
  },

  async expiringSummary(
    scope: WorkerScope,
    days = WORKER_CONTRACT_ALERT_DAYS,
    today = new Date(),
  ) {
    const items = await WorkerLaborContractModel.find({
      ...buildWorkerLaborContractQuery(scope),
      status: { $in: ["draft", "active"] },
    })
      .sort({ endDate: 1 })
      .lean();
    const expiring: any[] = [];
    const expired: any[] = [];
    for (const item of items as any[]) {
      const level = resolveAlertLevel(item.endDate, item.status, today, days);
      if (level === "expiring") expiring.push(item);
      else if (level === "expired") expired.push(item);
    }
    return {
      alertDays: days,
      expiringCount: expiring.length,
      expiredCount: expired.length,
      items: [...expired, ...expiring].slice(0, 10),
    };
  },
};
