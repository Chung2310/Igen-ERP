import { createHash } from "node:crypto";
import type { Db } from "mongodb";
import { atomic, base, collection, conflict, scope, type Actor } from "./store";
import { checkLines, type Draft } from "./supply-documents";
import { postDocument } from "./supply-posting";
export async function batchStock(db: Db, actor: Actor, data: Draft, key: string) {
  const fingerprint = createHash("sha256").update(JSON.stringify(data)).digest("hex");
  return atomic(async (session) => {
    const prior = await collection(db, "logistics_operations").findOne(
      { ...scope(actor), createdBy: actor.actorId, key: `batch:${key}` },
      { session },
    );
    if (prior) {
      if (prior.fingerprint !== fingerprint) conflict("Nội dung không khớp với lượt nhập/xuất trước đó.");
      return prior.result;
    }
    await checkLines(db, actor, data, session);
    const document = { ...base(actor), ...data, status: "approved" as const };
    await collection(db, "supply_documents").insertOne(document, { session });
    const result = await postDocument(db, actor, document._id, 1, `batch-post:${key}`, session);
    await collection(db, "logistics_operations").insertOne(
      { ...base(actor), key: `batch:${key}`, fingerprint, result },
      { session },
    );
    return result;
  });
}
