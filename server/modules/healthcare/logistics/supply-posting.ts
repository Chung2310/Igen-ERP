import { createHash } from "node:crypto";
import type { Db, ClientSession } from "mongodb";
import { atomic, base, collection, conflict, find, replace, scope, type Actor } from "./store";
import { checkLines } from "./supply-documents";
import { baseQuantity } from "./supply-units";
export async function postDocument(
  db: Db,
  actor: Actor,
  id: string,
  revision: number,
  key: string,
  existingSession?: ClientSession,
) {
  const fingerprint = createHash("sha256").update(JSON.stringify({ id, revision })).digest("hex");
  const work = async (session: ClientSession) => {
    const prior = await collection(db, "logistics_operations").findOne(
      { ...scope(actor), createdBy: actor.actorId, key },
      { session },
    );
    if (prior) {
      if (prior.fingerprint !== fingerprint) conflict("Khóa thao tác đã được sử dụng cho phiếu khác.");
      return prior.result;
    }
    const doc = await find(db, "supply_documents", actor, id, session);
    if (doc.status !== "approved" || doc.revision !== revision)
      conflict("Phiếu chưa được duyệt, đã thay đổi hoặc đã ghi sổ.");
    await checkLines(db, actor, doc, session);
    for (const line of doc.lines) {
      // Writing the catalog record serializes posting with catalog changes.
      const supply = await find(db, "supplies", actor, line.supplyId, session);
      await replace(db, "supplies", actor, supply, supply.revision, session);
      const match = {
        ...scope(actor),
        warehouseId: doc.warehouseId,
        supplyId: line.supplyId,
        lot: line.lot,
        expiryDay: line.expiryDay,
        quality: line.quality,
      };
      const old = await collection(db, "supply_balances").findOne(match, { session });
      const factor = 10 ** (supply.precision ?? 3);
      const converted = baseQuantity(supply, line.quantity, line.unit);
      const before = Math.round((old?.quantity || 0) * factor);
      const units = Math.round(converted * factor);
      const sign = doc.type === "issue" ? -1 : 1;
      if (sign < 0 && before < units) conflict("Số lượng xuất vượt tồn kho của lô.");
      const value =
        sign > 0 ? line.value : before === units ? old?.value || 0 : Math.round(((old?.value || 0) * units) / before);
      const quantity = (before + sign * units) / factor;
      const nextValue = (old?.value || 0) + sign * value;
      if (!Number.isSafeInteger(Math.round(quantity * factor)) || !Number.isSafeInteger(nextValue))
        conflict("Giá trị tồn kho vượt giới hạn.");
      if (old)
        await replace(db, "supply_balances", actor, { ...old, quantity, value: nextValue }, old.revision, session);
      else
        await collection(db, "supply_balances").insertOne(
          { ...base(actor), ...match, quantity, value: nextValue },
          { session },
        );
      await collection(db, "supply_ledger").insertOne(
        { ...base(actor), ...match, documentId: id, quantity: sign * converted, value: sign * value },
        { session },
      );
    }
    const result = await replace(db, "supply_documents", actor, { ...doc, status: "posted" }, revision, session);
    await collection(db, "logistics_operations").insertOne({ ...base(actor), key, fingerprint, result }, { session });
    return result;
  };
  return existingSession ? work(existingSession) : atomic(work);
}
