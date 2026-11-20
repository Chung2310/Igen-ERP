import mongoose from "mongoose";
import { EquipmentModel } from "../model/equipment.model";
import { EquipmentBorrowTransactionModel } from "../model/equipment-borrow-transaction.model";

export type EquipmentBorrowActor = {
  uid: string;
  name: string;
  companyCode: string;
  branchId?: string;
  canManage: boolean;
};

type Scope = { companyCode: string; branchId?: string };
type Decision = { decision: "approved" | "rejected"; rejectionReason?: string };

export class EquipmentBorrowError extends Error {
  constructor(public code: string, message: string, public status = 409) {
    super(message);
  }
}

const scopeOf = (actor: EquipmentBorrowActor): Scope => ({
  companyCode: actor.companyCode,
  ...(actor.branchId ? { branchId: actor.branchId } : {}),
});

const defaultDeps = {
  withTransaction: async (work: (session: mongoose.ClientSession) => Promise<any>) => {
    const session = await mongoose.startSession();
    try {
      let result: any;
      await session.withTransaction(async () => { result = await work(session); });
      return result;
    } finally {
      await session.endSession();
    }
  },
  findEquipment: (scope: Scope, id: string, session?: any) =>
    EquipmentModel.findOne({ _id: id, ...scope }).session(session || null).lean(),
  reserveEquipment: (scope: Scope, id: string, session?: any) =>
    EquipmentModel.findOneAndUpdate(
      { _id: id, ...scope, status: "available" },
      { $set: { status: "requested" } },
      { returnDocument: "after", session, runValidators: true },
    ).lean(),
  createRequest: async (data: any, session?: any) => (await EquipmentBorrowTransactionModel.create([data], { session }))[0].toObject(),
  findRequest: (scope: Scope, id: string, session?: any) =>
    EquipmentBorrowTransactionModel.findOne({ _id: id, ...scope }).session(session || null).lean(),
  updateRequest: (scope: Scope, id: string, expected: string, patch: any, session?: any) =>
    EquipmentBorrowTransactionModel.findOneAndUpdate(
      { _id: id, ...scope, status: expected } as any,
      { $set: patch },
      { returnDocument: "after", session, runValidators: true },
    ).lean(),
  updateEquipment: (scope: Scope, id: string, expected: string, patch: any, session?: any) => {
    const set = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined));
    const unset = Object.fromEntries(Object.entries(patch).filter(([, value]) => value === undefined).map(([key]) => [key, 1]));
    return EquipmentModel.findOneAndUpdate(
      { _id: id, ...scope, status: expected } as any,
      { ...(Object.keys(set).length ? { $set: set } : {}), ...(Object.keys(unset).length ? { $unset: unset } : {}) },
      { returnDocument: "after", session, runValidators: true },
    ).lean();
  },
  listRequests: async (filter: any, page: number, limit: number) => {
    const [data, total] = await Promise.all([
      EquipmentBorrowTransactionModel.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      EquipmentBorrowTransactionModel.countDocuments(filter),
    ]);
    return { data, total, page, limit };
  },
  listHistory: (filter: any) => EquipmentBorrowTransactionModel.find(filter).sort({ createdAt: -1 }).lean(),
};

export function createEquipmentBorrowService(deps: any = defaultDeps) {
  const requireEquipment = async (actor: EquipmentBorrowActor, id: string, session?: any) => {
    const equipment = await deps.findEquipment(scopeOf(actor), id, session);
    if (!equipment) throw new EquipmentBorrowError("EQUIPMENT_NOT_FOUND", "Không tìm thấy thiết bị.", 404);
    return equipment;
  };

  return {
    async createBorrowRequest(actor: EquipmentBorrowActor, equipmentId: string, input: { reason: string; expectedReturnAt?: string }) {
      return deps.withTransaction(async (session: any) => {
        const equipment = await requireEquipment(actor, equipmentId, session);
        if (equipment.status !== "available") {
          throw new EquipmentBorrowError("EQUIPMENT_NOT_AVAILABLE", "Thiết bị không còn sẵn sàng để mượn.");
        }
        const reserved = await deps.reserveEquipment(scopeOf(actor), equipmentId, session);
        if (!reserved) throw new EquipmentBorrowError("EQUIPMENT_NOT_AVAILABLE", "Thiết bị đã có người tạo đơn mượn.");
        return deps.createRequest({
          ...scopeOf(actor), equipmentId: String(equipment._id), equipmentCode: equipment.code,
          equipmentName: equipment.name, employeeId: actor.uid, employeeName: actor.name,
          requestType: "borrow", status: "pending", reason: input.reason,
          expectedReturnAt: input.expectedReturnAt ? new Date(input.expectedReturnAt) : undefined,
        }, session);
      });
    },

    async createReturnRequest(actor: EquipmentBorrowActor, equipmentId: string, input: { note?: string }) {
      return deps.withTransaction(async (session: any) => {
        const equipment = await requireEquipment(actor, equipmentId, session);
        if (equipment.status !== "in-use" || String(equipment.currentBorrowerId) !== actor.uid) {
          throw new EquipmentBorrowError("EQUIPMENT_NOT_CURRENT_BORROWER", "Chỉ người đang mượn thiết bị mới được gửi yêu cầu trả.", 403);
        }
        try {
          return await deps.createRequest({
            ...scopeOf(actor), equipmentId: String(equipment._id), equipmentCode: equipment.code,
            equipmentName: equipment.name, employeeId: actor.uid, employeeName: actor.name,
            requestType: "return", status: "pending", note: input.note,
            borrowTransactionId: equipment.activeBorrowTransactionId,
          }, session);
        } catch (error: any) {
          if (error?.code === 11000) throw new EquipmentBorrowError("RETURN_REQUEST_EXISTS", "Thiết bị đã có yêu cầu trả đang chờ duyệt.");
          throw error;
        }
      });
    },

    async cancelRequest(actor: EquipmentBorrowActor, requestId: string) {
      return deps.withTransaction(async (session: any) => {
        const request = await deps.findRequest(scopeOf(actor), requestId, session);
        if (!request) throw new EquipmentBorrowError("EQUIPMENT_REQUEST_NOT_FOUND", "Không tìm thấy yêu cầu.", 404);
        if (request.employeeId !== actor.uid || request.status !== "pending") {
          throw new EquipmentBorrowError("EQUIPMENT_REQUEST_CANNOT_CANCEL", "Bạn không thể hủy yêu cầu này.", 403);
        }
        const updated = await deps.updateRequest(scopeOf(actor), requestId, "pending", { status: "cancelled", cancelledAt: new Date() }, session);
        if (!updated) throw new EquipmentBorrowError("EQUIPMENT_REQUEST_ALREADY_PROCESSED", "Yêu cầu đã được xử lý.");
        if (request.requestType === "borrow") {
          const equipment = await deps.updateEquipment(scopeOf(actor), request.equipmentId, "requested", { status: "available" }, session);
          if (!equipment) throw new EquipmentBorrowError("EQUIPMENT_STATE_CONFLICT", "Trạng thái thiết bị đã thay đổi.");
        }
        return updated;
      });
    },

    async decideRequest(actor: EquipmentBorrowActor, requestId: string, input: Decision) {
      if (!actor.canManage) throw new EquipmentBorrowError("EQUIPMENT_PERMISSION_DENIED", "Bạn không có quyền duyệt yêu cầu thiết bị.", 403);
      return deps.withTransaction(async (session: any) => {
        const request = await deps.findRequest(scopeOf(actor), requestId, session);
        if (!request) throw new EquipmentBorrowError("EQUIPMENT_REQUEST_NOT_FOUND", "Không tìm thấy yêu cầu.", 404);
        if (request.status !== "pending") throw new EquipmentBorrowError("EQUIPMENT_REQUEST_ALREADY_PROCESSED", "Yêu cầu đã được xử lý.");
        const patch = { status: input.decision, rejectionReason: input.rejectionReason, decidedBy: actor.uid, decidedByName: actor.name, decidedAt: new Date() };
        const updated = await deps.updateRequest(scopeOf(actor), requestId, "pending", patch, session);
        if (!updated) throw new EquipmentBorrowError("EQUIPMENT_REQUEST_ALREADY_PROCESSED", "Yêu cầu đã được xử lý.");

        if (request.requestType === "borrow") {
          const equipmentPatch = input.decision === "approved"
            ? { status: "in-use", currentBorrowerId: request.employeeId, currentBorrowerName: request.employeeName, borrowedAt: new Date(), expectedReturnAt: request.expectedReturnAt, activeBorrowTransactionId: String(request._id) }
            : { status: "available" };
          if (!await deps.updateEquipment(scopeOf(actor), request.equipmentId, "requested", equipmentPatch, session))
            throw new EquipmentBorrowError("EQUIPMENT_STATE_CONFLICT", "Trạng thái thiết bị đã thay đổi.");
        } else if (input.decision === "approved") {
          if (!await deps.updateEquipment(scopeOf(actor), request.equipmentId, "in-use", {
            status: "available", currentBorrowerId: undefined, currentBorrowerName: undefined,
            borrowedAt: undefined, expectedReturnAt: undefined, activeBorrowTransactionId: undefined,
          }, session)) throw new EquipmentBorrowError("EQUIPMENT_STATE_CONFLICT", "Trạng thái thiết bị đã thay đổi.");
        }
        return updated;
      });
    },

    async listRequests(actor: EquipmentBorrowActor, filters: any = {}) {
      const filter: any = { ...scopeOf(actor) };
      if (!actor.canManage) filter.employeeId = actor.uid;
      if (filters.status) filter.status = filters.status;
      if (filters.requestType) filter.requestType = filters.requestType;
      return deps.listRequests(filter, Number(filters.page) || 1, Number(filters.limit) || 20);
    },

    async getHistory(actor: EquipmentBorrowActor, equipmentId: string) {
      await requireEquipment(actor, equipmentId);
      return deps.listHistory({ ...scopeOf(actor), equipmentId });
    },
  };
}

export const equipmentBorrowService = createEquipmentBorrowService();
