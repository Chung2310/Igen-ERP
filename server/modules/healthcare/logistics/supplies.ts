import type { Db } from "mongodb";
import type { Supply } from "../../../../shared/healthcare-logistics";
import { atomic, base, collection, conflict, find, replace, scope, type Actor } from "./store";
import { checkReferences } from "./references";
export async function saveSupply(
  db: Db,
  actor: Actor,
  data: Omit<Supply, "_id" | "revision" | "createdAt" | "updatedAt">,
  id?: string,
  revision?: number,
) {
  await checkReferences(db, actor, data);
  if (id) {
    return atomic(async (session) => {
      const old = await find(db, "supplies", actor, id, session);
      if (
        (data.unit !== old.unit || data.requiresExpiry !== old.requiresExpiry) &&
        (await collection(db, "supply_documents").findOne({ ...scope(actor), "lines.supplyId": id }, { session }))
      )
        conflict("Không đổi đơn vị hoặc quy tắc hạn dùng của vật tư đã có chứng từ.");
      if (
        !data.active &&
        (await collection(db, "supply_balances").findOne(
          { ...scope(actor), supplyId: id, quantity: { $gt: 0 } },
          { session },
        ))
      )
        conflict("Vật tư còn tồn kho, chưa thể ngừng sử dụng.");
      return replace(db, "supplies", actor, { ...old, ...data }, revision!, session);
    });
  }
  const row = { ...data, ...base(actor) };
  await collection(db, "supplies").insertOne(row);
  return row;
}
