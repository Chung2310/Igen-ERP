import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import type { ClientSession, Db, Filter } from "mongodb";
import { ConflictError, NotFoundError } from "../../../errors/app-error";
import type { HealthcareActor } from "../store";
import type {
  Balance,
  Equipment,
  EquipmentRequest,
  Inspection,
  Ledger,
  LogisticsRecord,
  StockDocument,
  Supply,
} from "../../../../shared/healthcare-logistics";

export type Actor = HealthcareActor;
export type Stored<T> = T & { companyCode: string; branchId: string; createdBy: string; updatedBy: string };
type Operation = LogisticsRecord & { key: string; fingerprint: string; result: unknown };
type Records = {
  equipment: Equipment;
  equipment_requests: EquipmentRequest;
  equipment_inspections: Inspection;
  supplies: Supply;
  supply_documents: StockDocument;
  supply_balances: Balance;
  supply_ledger: Ledger;
  logistics_operations: Operation;
};
export type Kind = keyof Records;
export const scope = (actor: Actor) => ({ companyCode: actor.companyCode, branchId: actor.branchId });
export const collection = <K extends Kind>(db: Db, kind: K) => db.collection<Stored<Records[K]>>(`healthcare_${kind}`);
const ready = new WeakMap<Db, Promise<void>>();
export async function ensureIndexes(db: Db) {
  let pending = ready.get(db);
  if (!pending) {
    const scoped = { companyCode: 1, branchId: 1 } as const;
    pending = Promise.all([
      ...(["equipment", "supplies"] as const).map((kind) =>
        collection(db, kind).createIndex({ ...scoped, code: 1 }, { unique: true }),
      ),
      collection(db, "equipment_requests").createIndex(
        { ...scoped, equipmentId: 1, type: 1 },
        { unique: true, partialFilterExpression: { status: "pending" } },
      ),
      collection(db, "equipment_inspections").createIndex({ ...scoped, equipmentId: 1, day: -1 }),
      collection(db, "supply_documents").createIndex({ ...scoped, status: 1, createdAt: -1 }),
      collection(db, "supply_balances").createIndex(
        { ...scoped, warehouseId: 1, supplyId: 1, lot: 1, expiryDay: 1, quality: 1 },
        { unique: true },
      ),
      collection(db, "supply_ledger").createIndex({ ...scoped, documentId: 1 }),
      collection(db, "logistics_operations").createIndex({ ...scoped, createdBy: 1, key: 1 }, { unique: true }),
    ])
      .then(() => undefined)
      .catch((error) => {
        ready.delete(db);
        throw error;
      });
    ready.set(db, pending);
  }
  await pending;
}
export function base(actor: Actor) {
  const at = new Date().toISOString();
  return {
    _id: randomUUID(),
    ...scope(actor),
    revision: 1,
    createdAt: at,
    updatedAt: at,
    createdBy: actor.actorId,
    updatedBy: actor.actorId,
  };
}
export function conflict(message = "Dữ liệu đã thay đổi. Vui lòng tải lại."): never {
  throw new ConflictError("CONFLICT", message);
}
export async function find<K extends Kind>(db: Db, kind: K, actor: Actor, id: string, session?: ClientSession) {
  const row = await collection(db, kind).findOne({ ...scope(actor), _id: id } as Filter<Stored<Records[K]>>, {
    session,
  });
  if (!row) throw new NotFoundError("RESOURCE_NOT_FOUND", "Không tìm thấy bản ghi trong chi nhánh.");
  return row as Stored<Records[K]>;
}
export async function replace<K extends Kind>(
  db: Db,
  kind: K,
  actor: Actor,
  row: Stored<Records[K]>,
  expected: number,
  session?: ClientSession,
) {
  const next = { ...row, revision: expected + 1, updatedBy: actor.actorId, updatedAt: new Date().toISOString() };
  const result = await collection(db, kind).replaceOne(
    { ...scope(actor), _id: row._id, revision: expected } as Filter<Stored<Records[K]>>,
    next,
    { session },
  );
  if (!result.matchedCount) conflict();
  return next;
}
export function publicRecord<T extends object>(row: T) {
  const { companyCode, branchId, createdBy, updatedBy, ...value } = row as T & Stored<LogisticsRecord>;
  return value;
}
export async function atomic<T>(work: (session: ClientSession) => Promise<T>): Promise<T> {
  const session = await mongoose.connection.startSession();
  try {
    return (await session.withTransaction(() => work(session as unknown as ClientSession))) as T;
  } finally {
    await session.endSession();
  }
}
