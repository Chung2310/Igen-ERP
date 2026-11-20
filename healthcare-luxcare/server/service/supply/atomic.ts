import { createHash } from "node:crypto";
import type { ClientSession } from "mongoose";
import { SupplyModel } from "../../model/supply.model";
import { SupplyOperationModel } from "../../model/supply-operation.model";
import { SupplyError } from "./errors";

export async function runSupplyAtomic<T>(work: (session: ClientSession) => Promise<T>): Promise<T> {
  const connection = SupplyModel.db;
  if (!connection.db) throw new SupplyError("SUPPLY_TRANSACTION_UNAVAILABLE", "Chưa kết nối cơ sở dữ liệu kho.", 503);
  let topology;
  try {
    topology = await connection.db.admin().command({ hello: 1 });
  } catch {
    throw new SupplyError(
      "SUPPLY_TRANSACTION_UNAVAILABLE",
      "Không xác minh được khả năng giao dịch của cơ sở dữ liệu kho.",
      503,
    );
  }
  if (!topology.setName && topology.msg !== "isdbgrid") {
    if (process.env.ALLOW_STANDALONE_MONGODB === "true") {
      return work(null as any);
    }
    throw new SupplyError(
      "SUPPLY_TRANSACTION_UNAVAILABLE",
      "Nhập/xuất kho cần MongoDB replica set để bảo đảm số tồn và lịch sử được lưu đồng thời.",
      503,
    );
  }
  const session = await connection.startSession();
  try {
    return (await session.withTransaction(() => work(session), {
      readConcern: { level: "snapshot" },
      writeConcern: { w: "majority" },
      maxCommitTimeMS: 15000,
    })) as T;
  } finally {
    await session.endSession();
  }
}

export function canonical(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, canonical(v)]),
    );
  return value;
}

export async function runSupplyOperation<T>(
  companyCode: string,
  key: string | undefined,
  payload: unknown,
  work: (session: ClientSession) => Promise<T>,
  session?: ClientSession,
): Promise<T> {
  if (session) return work(session); // Nested workflow shares the outer atomic operation and retry result.
  if (!companyCode) throw new SupplyError("SUPPLY_SCOPE_REQUIRED", "Thiếu phạm vi công ty.", 403);
  if (!key) return runSupplyAtomic(work); // Compatibility for older clients; new UI always supplies a key.
  if (!/^[a-zA-Z0-9:_-]{8,128}$/.test(key))
    throw new SupplyError("INVALID_IDEMPOTENCY_KEY", "Mã thao tác không hợp lệ.");
  try {
    const indexes = await SupplyOperationModel.collection.indexes();
    if (
      !indexes.some(
        (index) =>
          !index.partialFilterExpression &&
          !index.sparse &&
          index.unique &&
          index.key.companyCode === 1 &&
          index.key.key === 1 &&
          Object.keys(index.key).length === 2,
      )
    ) {
      throw new Error("Missing operation uniqueness");
    }
  } catch {
    throw new SupplyError(
      "SUPPLY_INDEX_NOT_READY",
      "Kho chưa có index chống ghi trùng. Vui lòng hoàn tất cấu hình trước khi nhập/xuất.",
      503,
    );
  }
  const fingerprint = createHash("sha256")
    .update(JSON.stringify(canonical(payload)))
    .digest("hex");
  const previous = async (session?: ClientSession) => {
    const operation = await SupplyOperationModel.findOne({ companyCode, key })
      .session(session || null)
      .lean();
    if (operation && operation.fingerprint !== fingerprint)
      throw new SupplyError(
        "IDEMPOTENCY_CONFLICT",
        "Mã thao tác đã dùng cho nội dung khác. Vui lòng mở phiếu mới.",
        409,
      );
    return operation;
  };
  const existing = await previous();
  if (existing) return existing.result as T;
  try {
    return await runSupplyAtomic(async (session) => {
      const replay = await previous(session);
      if (replay) return replay.result as T;
      const result = await work(session);
      await SupplyOperationModel.create([{ companyCode, key, fingerprint, result }], { session });
      return result;
    });
  } catch (error) {
    // A concurrent request may have committed while this transaction hit a unique index.
    if ((error as { code?: number }).code === 11000) {
      const replay = await previous();
      if (replay) return replay.result as T;
    }
    throw error;
  }
}
