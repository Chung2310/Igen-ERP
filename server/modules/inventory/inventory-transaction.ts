import mongoose, { type ClientSession } from "mongoose";

/** Inventory writes must never silently fall back to non-transactional writes. */
export async function inInventoryTransaction<T>(work: (session: ClientSession) => Promise<T>, existing?: ClientSession, options?: mongoose.mongo.TransactionOptions): Promise<T> {
  if (existing) {
    if (!existing.inTransaction()) throw Object.assign(new Error("Thao tác kho yêu cầu transaction đang hoạt động."), { status: 503, statusCode: 503, code: "INVENTORY_TRANSACTION_REQUIRED" });
    return work(existing);
  }
  if (process.env.DISABLE_TRANSACTIONS === "true" || process.env.MONGODB_REPLICA_SET === "false") {
    throw Object.assign(new Error("Ghi kho yêu cầu MongoDB hỗ trợ transaction. Vui lòng kiểm tra cấu hình hệ thống."), { status: 503, statusCode: 503, code: "INVENTORY_TRANSACTION_REQUIRED" });
  }
  const topology = await mongoose.connection.db?.admin().command({ hello: 1 });
  if (!topology?.setName && topology?.msg !== "isdbgrid") {
    throw Object.assign(new Error("Ghi kho yêu cầu MongoDB replica set hoặc sharded cluster."), { status: 503, statusCode: 503, code: "INVENTORY_TRANSACTION_REQUIRED" });
  }
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(() => work(session), options);
  } finally {
    await session.endSession();
  }
}
