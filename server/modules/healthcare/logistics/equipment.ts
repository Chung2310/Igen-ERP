import { ObjectId, type Db } from "mongodb";
import type { Equipment, EquipmentRequest, Inspection } from "../../../../shared/healthcare-logistics";
import { ForbiddenError } from "../../../errors/app-error";
import { atomic, base, collection, conflict, find, replace, scope, type Actor } from "./store";
import { checkReferences } from "./references";

export async function saveEquipment(
  db: Db,
  actor: Actor,
  data: Omit<Equipment, "_id" | "revision" | "createdAt" | "updatedAt">,
  id?: string,
  revision?: number,
) {
  await checkReferences(db, actor, data);
  if (id) {
    const old = await find(db, "equipment", actor, id);
    if (["requested", "in-use"].includes(old.status)) conflict("Không sửa thiết bị đang chờ mượn hoặc đang sử dụng.");
    return replace(db, "equipment", actor, { ...old, ...data }, revision!);
  }
  const row = { ...data, ...base(actor) };
  await collection(db, "equipment").insertOne(row);
  return row;
}
export async function requestEquipment(
  db: Db,
  actor: Actor,
  equipmentId: string,
  data: Pick<EquipmentRequest, "type" | "reason" | "expectedReturnDay">,
  canManage = false,
) {
  return atomic(async (session) => {
    const equipment = await find(db, "equipment", actor, equipmentId, session);
    const employeeId = data.type === "return" ? equipment.currentBorrowerId || actor.actorId : actor.actorId;
    const user = ObjectId.isValid(employeeId)
      ? await db
          .collection("users")
          .findOne(
            { _id: new ObjectId(employeeId), companyCode: actor.companyCode },
            { projection: { displayName: 1 }, session },
          )
      : null;
    if (data.type === "borrow") {
      if (equipment.status !== "available") conflict("Thiết bị không còn sẵn sàng để mượn.");
      await replace(db, "equipment", actor, { ...equipment, status: "requested" }, equipment.revision, session);
    } else if (equipment.status !== "in-use" || (!canManage && equipment.currentBorrowerId !== actor.actorId)) {
      throw new ForbiddenError("FORBIDDEN", "Chỉ người đang mượn thiết bị được yêu cầu trả.");
    }
    const row = {
      ...base(actor),
      ...data,
      equipmentId,
      equipmentName: equipment.name,
      employeeId,
      employeeName: String(user?.displayName || ""),
      status: "pending" as const,
    };
    await collection(db, "equipment_requests").insertOne(row, { session });
    return row;
  });
}
export async function decideEquipment(
  db: Db,
  actor: Actor,
  id: string,
  revision: number,
  action: string,
  reason: string,
) {
  return atomic(async (session) => {
    const request = await find(db, "equipment_requests", actor, id, session);
    if (request.status !== "pending" || request.revision !== revision) conflict();
    if (action === "cancel" && request.employeeId !== actor.actorId)
      throw new ForbiddenError("FORBIDDEN", "Chỉ người tạo yêu cầu được hủy.");
    if (!["approve", "reject", "cancel"].includes(action)) conflict("Thao tác không hợp lệ.");
    const equipment = await find(db, "equipment", actor, request.equipmentId, session);
    if (request.type === "borrow") {
      if (equipment.status !== "requested") conflict();
      await replace(
        db,
        "equipment",
        actor,
        {
          ...equipment,
          status: action === "approve" ? "in-use" : "available",
          ...(action === "approve" ? { currentBorrowerId: request.employeeId } : {}),
        },
        equipment.revision,
        session,
      );
    } else if (action === "approve") {
      if (equipment.status !== "in-use" || equipment.currentBorrowerId !== request.employeeId) conflict();
      const next = { ...equipment, status: "available" as const };
      delete next.currentBorrowerId;
      await replace(db, "equipment", actor, next, equipment.revision, session);
    }
    return replace(
      db,
      "equipment_requests",
      actor,
      {
        ...request,
        status: action === "approve" ? "approved" : action === "reject" ? "rejected" : "cancelled",
        decisionReason: reason,
      },
      revision,
      session,
    );
  });
}
export async function inspectEquipment(
  db: Db,
  actor: Actor,
  equipmentId: string,
  data: Omit<Inspection, "_id" | "revision" | "createdAt" | "updatedAt" | "equipmentId">,
) {
  return atomic(async (session) => {
    const equipment = await find(db, "equipment", actor, equipmentId, session);
    if (["requested", "in-use", "retired"].includes(equipment.status))
      conflict("Thiết bị phải sẵn sàng hoặc đang bảo dưỡng để ghi kiểm định.");
    const row = { ...base(actor), ...data, equipmentId };
    await collection(db, "equipment_inspections").insertOne(row, { session });
    const latest = await collection(db, "equipment_inspections")
      .find({ ...scope(actor), equipmentId }, { session })
      .sort({ day: -1, createdAt: -1 })
      .limit(1)
      .next();
    await replace(
      db,
      "equipment",
      actor,
      {
        ...equipment,
        nextInspectionDay: latest?.nextDay || "",
        lastInspectionDay: latest?.day || "",
        lastInspectionResult: latest?.result || "",
        lastInspectionProvider: latest?.provider || "",
        lastInspectionReportUrl: latest?.reportUrl || "",
        status: data.result === "fail" ? "maintenance" : equipment.status,
      },
      equipment.revision,
      session,
    );
    return row;
  });
}
