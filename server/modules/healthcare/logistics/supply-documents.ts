import type { ClientSession, Db } from "mongodb";
import type { StockDocument } from "../../../../shared/healthcare-logistics";
import { atomic, base, collection, conflict, find, replace, type Actor } from "./store";
import { checkReferences } from "./references";
import { baseQuantity } from "./supply-units";
export type Draft = Pick<StockDocument, "type" | "warehouseId" | "supplierId" | "departmentId" | "reason" | "lines"> &
  Pick<StockDocument, "voucherCode" | "voucherDay">;
export async function checkLines(db: Db, actor: Actor, data: Draft, session?: ClientSession) {
  await checkReferences(db, actor, data);
  for (const line of data.lines) {
    const supply = await find(db, "supplies", actor, line.supplyId, session);
    if (!supply.active) conflict("Vật tư đã ngừng sử dụng.");
    baseQuantity(supply, line.quantity, line.unit);
    if (supply.trackingMode === "lot" && !line.lot) conflict(`Vật tư ${supply.name} cần số lô.`);
    if (supply.requiresExpiry && !line.expiryDay) conflict(`Vật tư ${supply.name} cần hạn dùng.`);
    if (
      data.type === "issue" &&
      (line.quality !== "available" ||
        (line.expiryDay && line.expiryDay < new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10)))
    )
      conflict("Không xuất vật tư hết hạn, cách ly hoặc hỏng.");
  }
}
export async function saveDocument(db: Db, actor: Actor, data: Draft, id?: string, revision?: number) {
  return atomic(async (session) => {
    await checkLines(db, actor, data, session);
    for (const supplyId of new Set(data.lines.map((line) => line.supplyId))) {
      const supply = await find(db, "supplies", actor, supplyId, session);
      await replace(db, "supplies", actor, supply, supply.revision, session);
    }
    if (id) {
      const old = await find(db, "supply_documents", actor, id, session);
      if (!["draft", "rejected"].includes(old.status)) conflict("Chỉ sửa phiếu nháp hoặc bị từ chối.");
      return replace(db, "supply_documents", actor, { ...old, ...data, status: "draft" }, revision!, session);
    }
    const row = { ...base(actor), ...data, status: "draft" as const };
    await collection(db, "supply_documents").insertOne(row, { session });
    return row;
  });
}
export async function transitionDocument(
  db: Db,
  actor: Actor,
  id: string,
  revision: number,
  action: string,
  reason: string,
) {
  return atomic(async (session) => {
    const row = await find(db, "supply_documents", actor, id, session);
    const transitions: Record<string, [string[], StockDocument["status"]]> = {
      submit: [["draft", "rejected"], "submitted"],
      approve: [["submitted"], "approved"],
      reject: [["submitted"], "rejected"],
      cancel: [["draft", "rejected", "submitted", "approved"], "cancelled"],
    };
    const target = transitions[action];
    if (!target || !target[0].includes(row.status)) conflict("Không thể chuyển trạng thái phiếu.");
    if (action === "submit") await checkLines(db, actor, row, session);
    return replace(
      db,
      "supply_documents",
      actor,
      { ...row, status: target[1], decisionReason: reason },
      revision,
      session,
    );
  });
}
