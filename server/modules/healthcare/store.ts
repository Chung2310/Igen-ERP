import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import type { Collection, Db, Filter, OptionalUnlessRequiredId, UpdateFilter, WithId } from "mongodb";
import { ConflictError, InternalError, NotFoundError } from "../../errors/app-error";
import type {
  Appointment, CareTask, CatalogItem, HealthcareList, HealthcareRecord, Patient, PatientReference, RecordInput, Visit,
} from "../../../shared/healthcare";
import type { ListQuery } from "./validation";

export type HealthcareScope = { companyCode: string; branchId: string };
export type HealthcareActor = HealthcareScope & { actorId: string };
type AuditEntry = { actorId: string; at: string; action: "create" | "update" | "import" };
export type Stored<T> = T & HealthcareScope & { createdBy: string; updatedBy: string; audit: AuditEntry[] };
type RecordMap = { patients: Patient; visits: Visit; appointments: Appointment & { reservations: string[] }; care: CareTask; catalog: CatalogItem };
type RecordKind = keyof RecordMap;
export type StoredAppointment = RecordMap["appointments"];

const indexes = new WeakMap<Db, Promise<void>>();
const prefix = "healthcare_";
export const privateFields = { companyCode: 0, branchId: 0, createdBy: 0, updatedBy: 0, audit: 0, reservations: 0 };
const listPrivateFields = { ...privateFields, "report.fields": 0 };
const patientSearchFields = ["code", "name", "phone", "hospitalProfile.phoneText"];

export async function healthcareDb() {
  const connectionDb = mongoose.connection.db;
  if (!connectionDb) throw new InternalError();
  // Keep one driver type at the module boundary when Mongoose installs its own MongoDB copy.
  const db = connectionDb as unknown as Db;
  let ready = indexes.get(db);
  if (!ready) {
    const scope = { companyCode: 1, branchId: 1 } as const;
    ready = Promise.all([
      db.collection(prefix + "patients").createIndex({ ...scope, code: 1 }, { unique: true }),
      db.collection(prefix + "patients").createIndex({ ...scope, updatedAt: -1, _id: -1 }),
      db.collection(prefix + "patients").createIndex({ ...scope, createdAt: -1, _id: -1 }),
      db.collection(prefix + "patients").createIndex({ ...scope, "source.batchId": 1, "source.row": 1 }),
      db.collection(prefix + "visits").createIndex({ ...scope, code: 1 }, { unique: true }),
      db.collection(prefix + "visits").createIndex({ ...scope, visitedOn: -1, _id: -1 }),
      db.collection(prefix + "visits").createIndex({ ...scope, patientId: 1, visitedOn: -1 }),
      db.collection(prefix + "visits").createIndex({ ...scope, "source.batchId": 1, "source.sheet": 1, "source.row": 1 }),
      db.collection(prefix + "appointments").createIndex(
        { ...scope, reservations: 1 },
        { unique: true, partialFilterExpression: { "reservations.0": { $exists: true } } },
      ),
      db.collection(prefix + "appointments").createIndex({ ...scope, startsAt: 1, _id: 1 }),
      db.collection(prefix + "appointments").createIndex({ ...scope, patientId: 1, startsAt: -1 }),
      db.collection(prefix + "appointments").createIndex({ ...scope, scheduledOn: 1, _id: 1 }),
      db.collection(prefix + "appointments").createIndex({ ...scope, "source.batchId": 1, "source.sheet": 1, "source.row": 1 }, {
        unique: true, partialFilterExpression: { "source.batchId": { $exists: true }, "source.sheet": { $exists: true }, "source.row": { $exists: true } },
      }),
      db.collection(prefix + "care").createIndex({ ...scope, dueOn: 1, _id: 1 }),
      db.collection(prefix + "care").createIndex({ ...scope, patientId: 1, dueOn: -1 }),
      db.collection(prefix + "care").createIndex({ ...scope, "source.batchId": 1, "source.sheet": 1, "source.row": 1 }, {
        unique: true, partialFilterExpression: { "source.batchId": { $exists: true }, "source.sheet": { $exists: true }, "source.row": { $exists: true } },
      }),
      db.collection(prefix + "catalog").createIndex({ ...scope, kind: 1, code: 1 }, { unique: true }),
      db.collection(prefix + "imports").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      db.collection(prefix + "imports").createIndex({ ...scope, completedAt: -1 }),
      db.collection(prefix + "imports").createIndex({ ...scope, createdAt: -1 }),
      db.collection(prefix + "imports").createIndex({ status: 1, queuedAt: 1 }),
      db.collection(prefix + "imports").createIndex({ status: 1, leaseUntil: 1 }),
      db.collection(prefix + "imports").createIndex({ status: 1, previewUntil: 1 }),
      db.collection(prefix + "import_rows").createIndex({ batchId: 1, index: 1 }, { unique: true }),
      db.collection(prefix + "import_rows").createIndex({ batchId: 1, status: 1, index: 1 }),
    ]).then(() => undefined).catch(error => {
      indexes.delete(db);
      throw error;
    });
    indexes.set(db, ready);
  }
  await ready;
  return db;
}

export function scopeFilter(actor: HealthcareScope): HealthcareScope {
  return { companyCode: actor.companyCode, branchId: actor.branchId };
}

export function records<K extends RecordKind>(db: Db, kind: K) {
  return db.collection<Stored<RecordMap[K]>>(prefix + kind);
}

export async function patientReferences(db: Db, actor: HealthcareScope, rows: readonly { patientId: string }[]) {
  if (!rows.length) return [];
  const ids = [...new Set(rows.map(row => row.patientId))];
  return records(db, "patients").find({ ...scopeFilter(actor), _id: { $in: ids } })
    .project<PatientReference>({ _id: 1, code: 1, name: 1, phone: 1 }).toArray();
}

export function visible<T extends HealthcareRecord>(row: Stored<T> | WithId<Stored<T>>): Omit<T, "reservations"> {
  const { companyCode, branchId, createdBy, updatedBy, audit, reservations, ...publicRow } =
    row as Stored<T> & { reservations?: string[] };
  return publicRow as Omit<T, "reservations">;
}

export function newRecord<T extends HealthcareRecord>(
  actor: HealthcareActor, input: RecordInput<T>, source?: HealthcareRecord["source"],
): Stored<T> {
  const now = new Date().toISOString();
  return {
    ...input, ...scopeFilter(actor), _id: randomUUID(), revision: 1, createdAt: now, updatedAt: now,
    createdBy: actor.actorId, updatedBy: actor.actorId,
    audit: [{ actorId: actor.actorId, at: now, action: source ? "import" : "create" }],
    ...(source ? { source } : {}),
  } as Stored<T>;
}

export function isDuplicate(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}

export async function findRecord<T extends HealthcareRecord>(collection: Collection<Stored<T>>, actor: HealthcareScope, id: string) {
  const result = await collection.findOne({ ...scopeFilter(actor), _id: id } as Filter<Stored<T>>);
  if (!result) throw new NotFoundError("RESOURCE_NOT_FOUND", "Không tìm thấy bản ghi trong chi nhánh hiện tại.");
  return result;
}

export async function createRecord<T extends HealthcareRecord>(
  collection: Collection<Stored<T>>, actor: HealthcareActor, input: RecordInput<T>, conflictMessage: string,
) {
  const row = newRecord<T>(actor, input);
  try {
    await collection.insertOne(row as OptionalUnlessRequiredId<Stored<T>>);
  } catch (error) {
    if (isDuplicate(error)) throw new ConflictError("DATABASE_CONFLICT", conflictMessage);
    throw error;
  }
  return visible(row);
}

type PatientCodeCounter = { _id: string; value: number };

async function nextGeneratedPatientCode(db: Db, actor: HealthcareActor) {
  const counterId = `patient-code:${actor.companyCode}:${actor.branchId}`;
  const counters = db.collection<PatientCodeCounter>("healthcare_counters");
  if (!await counters.findOne({ _id: counterId }, { projection: { _id: 1 } })) {
    const [latest] = await records(db, "patients").aggregate<{ value: number }>([
      { $match: { ...scopeFilter(actor), code: { $regex: "^BN[0-9]+$" } } },
      { $project: { value: { $convert: { input: { $substr: ["$code", 2, 48] }, to: "long", onError: 0, onNull: 0 } } } },
      { $group: { _id: null, value: { $max: "$value" } } },
    ]).toArray();
    try {
      await counters.updateOne({ _id: counterId }, { $setOnInsert: { value: Number(latest?.value || 0) } }, { upsert: true });
    } catch (error) {
      if (!isDuplicate(error)) throw error;
    }
  }
  const counter = await counters.findOneAndUpdate({ _id: counterId }, { $inc: { value: 1 } }, { returnDocument: "after" });
  if (!counter) throw new InternalError();
  return `BN${String(counter.value).padStart(6, "0")}`;
}

export async function createGeneratedPatient(
  db: Db, actor: HealthcareActor, input: Omit<RecordInput<Patient>, "code">,
) {
  const collection = records(db, "patients");
  for (let attempt = 0; attempt < 100; attempt++) {
    const row = newRecord<Patient>(actor, { ...input, code: await nextGeneratedPatientCode(db, actor) });
    try {
      await collection.insertOne(row as OptionalUnlessRequiredId<Stored<Patient>>);
      return visible(row);
    } catch (error) {
      if (isDuplicate(error)) continue;
      throw error;
    }
  }
  throw new ConflictError("DATABASE_CONFLICT", "Không thể tự tạo mã bệnh nhân lúc này. Vui lòng thử lại.");
}

export async function updateRecord<T extends HealthcareRecord>(
  collection: Collection<Stored<T>>, actor: HealthcareActor, id: string, revision: number,
  input: RecordInput<T>, conflictMessage: string,
) {
  const now = new Date().toISOString();
  try {
    const updated = await collection.findOneAndUpdate(
      { ...scopeFilter(actor), _id: id, revision } as Filter<Stored<T>>,
      {
        $set: { ...input, updatedAt: now, updatedBy: actor.actorId },
        $inc: { revision: 1 },
        $push: { audit: { actorId: actor.actorId, at: now, action: "update" } },
      } as unknown as UpdateFilter<Stored<T>>,
      { returnDocument: "after" },
    );
    if (updated) return visible(updated);
  } catch (error) {
    if (isDuplicate(error)) throw new ConflictError("DATABASE_CONFLICT", conflictMessage);
    throw error;
  }
  await findRecord(collection, actor, id);
  throw new ConflictError("DATABASE_CONFLICT", "Bản ghi đã thay đổi. Vui lòng tải lại trước khi lưu.");
}

export async function listRecords<T extends HealthcareRecord>(
  collection: Collection<Stored<T>>, actor: HealthcareScope,
  filter: Filter<T>, sort: Record<string, 1 | -1>, page: number, pageSize: number,
): Promise<HealthcareList<Omit<T, "reservations">>> {
  const scoped = { $and: [scopeFilter(actor), filter] } as Filter<Stored<T>>;
  const [items, total] = await Promise.all([
    collection.find(scoped, { projection: listPrivateFields }).sort(sort).skip((page - 1) * pageSize).limit(pageSize).toArray(),
    collection.countDocuments(scoped),
  ]);
  return { items: items.map(visible<T>), total, page, pageSize };
}

export function textMatches(q: string, fields: string[]) {
  const search = q.normalize("NFC").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return fields.map(field => ({ [field]: { $regex: search, $options: "i" } }));
}

export function patientSearchFilter(q: string, selectionOnly = false) {
  if (!q) return {};
  if (!selectionOnly) return { $or: textMatches(q, patientSearchFields) };
  const phoneFields = ["phone", "hospitalProfile.phoneText"];
  const matches = textMatches(q, ["name", ...phoneFields]);
  const digits = q.replace(/\D/g, "");
  if (digits.length >= 3) {
    const formattedPhonePattern = digits.split("").join("[\\s().+/-]*");
    matches.push(...phoneFields.map(field => ({ [field]: { $regex: formattedPhonePattern, $options: "i" } })));
  }
  return { $or: matches };
}

export async function listClinicalRecords<T extends HealthcareRecord & { patientId: string }>(
  collection: Collection<Stored<T>>, actor: HealthcareScope, filter: Filter<T>, sort: Record<string, 1 | -1>,
  { page, pageSize, q }: ListQuery, searchFields: string[], extraMatches: Filter<T>[] = [],
): Promise<HealthcareList<Omit<T, "reservations">>> {
  if (!q) return listRecords(collection, actor, filter, sort, page, pageSize);
  const scope = scopeFilter(actor);
  type Item = Omit<T, "reservations">;
  const [result] = await collection.aggregate<{ items: Item[]; count: { total: number }[] }>([
    { $match: { ...scope, ...filter } },
    { $lookup: {
      from: prefix + "patients", localField: "patientId", foreignField: "_id",
      pipeline: [{ $match: scope }, { $project: { code: 1, name: 1, phone: 1, "hospitalProfile.phoneText": 1 } }],
      as: "searchPatient",
    } },
    { $match: { $or: [...textMatches(q, [...searchFields, ...patientSearchFields.map(field => `searchPatient.${field}`)]), ...extraMatches] } },
    { $project: { ...listPrivateFields, searchPatient: 0 } },
    { $sort: sort },
    { $facet: { items: [{ $skip: (page - 1) * pageSize }, { $limit: pageSize }], count: [{ $count: "total" }] } },
  ], { allowDiskUse: true }).toArray();
  return { items: result?.items || [], total: result?.count[0]?.total || 0, page, pageSize };
}
