import mongoose from "mongoose";
import { ObjectId, type Db, type Document } from "mongodb";
import { quotationContext } from "./context";

export const quotationCollections = ["companies", "catalogItems", "catalogOperations", "catalogImportMappings", "priceLists", "quoteTemplates", "requestFiles", "quoteRequests", "quotes", "budgetPlans", "contracts", "acceptanceRecords", "companyFiles", "generatedExportJobs", "counters", "auditLogs"] as const;
export function quotationCollectionName(name: string) {
  if (!(quotationCollections as readonly string[]).includes(name)) throw new Error(`Collection không thuộc phân hệ Báo giá: ${name}`);
  return `quotation_${name === "companies" ? "settings" : name}`;
}
const scopeKeys = new Set(["companyCode", "branchId", "companyId"]);
const versioned = new Set(["quotes", "budgetPlans", "contracts", "acceptanceRecords", "catalogItems"]);
function conflict() { return Object.assign(new Error("Dữ liệu đã được người khác cập nhật. Hãy tải lại chứng từ trước khi lưu."), { statusCode: 409, code: "QUOTATION_VERSION_CONFLICT" }); }
function unsafePipeline(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(([key, child]) => ["$lookup", "$unionWith", "$out", "$merge", "$graphLookup", "$documents"].includes(key) || unsafePipeline(child));
}
export function quotationFilter(filter: Document = {}, context = quotationContext()): Document {
  return { $and: [{ companyCode: context.companyCode, branchId: context.branchId }, filter] };
}
export function quotationInsert(value: Document, name: string, context = quotationContext()): Document {
  if (value.companyId !== undefined && value.companyId !== context.scopeId) throw Object.assign(new Error("Dữ liệu không thuộc phạm vi báo giá hiện tại."), { statusCode: 403 });
  return { ...value, ...(name === "companies" ? {} : { companyId: context.scopeId }), companyCode: context.companyCode, branchId: context.branchId };
}
export function quotationUpdate(value: Document, name: string, context = quotationContext()): Document {
  if (Array.isArray(value)) throw new Error("Không cho phép pipeline cập nhật phạm vi Báo giá.");
  for (const [operator, fields] of Object.entries(value)) {
    if (!operator.startsWith("$")) throw new Error("Cập nhật báo giá cần dùng toán tử tường minh.");
    if (fields && typeof fields === "object") for (const [key, v] of Object.entries(fields)) {
      if (operator === "$rename" && typeof v === "string" && scopeKeys.has(v.split(".")[0])) throw Object.assign(new Error("Không được đổi phạm vi dữ liệu Báo giá."), { statusCode: 403 });
      if (scopeKeys.has(key.split(".")[0])) {
        const expected = key === "companyCode" ? context.companyCode : key === "branchId" ? context.branchId : context.scopeId;
        if (operator !== "$setOnInsert" || v !== expected) throw Object.assign(new Error("Không được thay đổi phạm vi dữ liệu Báo giá."), { statusCode: 403 });
      }
    }
  }
  return { ...value, $setOnInsert: { ...value.$setOnInsert, companyCode: context.companyCode, branchId: context.branchId, ...(name === "companies" ? {} : { companyId: context.scopeId }) } };
}

let ready: Promise<void> | undefined;
export async function ensureQuotationIndexes() {
  if (!mongoose.connection.db) throw new Error("ERP chưa kết nối cơ sở dữ liệu.");
  if (!ready) ready = (async () => {
    const db = mongoose.connection.db!;
    const scoped = { companyCode: 1, branchId: 1 } as const;
    for (const name of quotationCollections) await db.collection(quotationCollectionName(name)).createIndex({ ...scoped, createdAt: -1 });
    for (const name of ["quotes", "quoteRequests"]) await db.collection(quotationCollectionName(name)).createIndex({ ...scoped, idempotencyKey: 1 }, { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string" } } });
    await db.collection(quotationCollectionName("catalogItems")).createIndex({ ...scoped, sku: 1 }, { unique: true });
    await db.collection(quotationCollectionName("catalogOperations")).createIndex({ ...scoped, key: 1 }, { unique: true });
    await db.collection(quotationCollectionName("catalogImportMappings")).createIndex(scoped, { unique: true });
    await db.collection(quotationCollectionName("quotes")).createIndex({ ...scoped, quoteNumber: 1 }, { unique: true });
    await db.collection(quotationCollectionName("contracts")).createIndex({ ...scoped, quoteId: 1 }, { unique: true });
    await db.collection(quotationCollectionName("acceptanceRecords")).createIndex({ ...scoped, contractId: 1 }, { unique: true });
    await db.collection(quotationCollectionName("generatedExportJobs")).createIndex({ ...scoped, inputHash: 1 }, { unique: true, partialFilterExpression: { inputHash: { $type: "string" } } });
  })().catch(error => { ready = undefined; throw error; });
  return ready;
}

/** Compatibility repository over ERP's existing Mongo connection. Every operation is tenant/branch constrained. */
export async function connectDatabase(): Promise<Db> {
  const context = quotationContext();
  const db = mongoose.connection.db;
  if (!db) throw new Error("ERP chưa kết nối cơ sở dữ liệu.");
  const collection = (name: string) => {
    const target = db.collection(quotationCollectionName(name));
    return new Proxy(target, { get(object, property) {
      if (property === "findOne") return async (filter: Document = {}, ...args: Document[]) => {
        const row = await Reflect.apply(object.findOne, object, [quotationFilter(filter, context), ...args]);
        if (row && filter._id && versioned.has(name)) {
          const field = row.updatedAt ? "updatedAt" : "createdAt";
          const revision = row[field] ? new Date(row[field]) : null;
          const key = `${name}:${row._id}`;
          const segment = { quotes: "quotes", budgetPlans: "budget-plans", contracts: "contracts", acceptanceRecords: "acceptance-records", catalogItems: "catalog" }[name];
          const isTarget = context.command?.path.startsWith(`/${segment}/${row._id}`);
          if (isTarget && context.expectedVersion && !context.checkedVersions?.has(key)) {
            if (revision?.toISOString() !== context.expectedVersion) throw conflict();
            context.checkedVersions ||= new Set();
            context.checkedVersions.add(key);
          }
          context.readVersions ||= new Map();
          if (!context.readVersions.has(key)) {
            context.readVersions.set(key, revision);
            context.readVersionFields ||= new Map();
            context.readVersionFields.set(key, field);
          }
        }
        return row;
      };
      if (property === "updateOne" || property === "deleteOne" || property === "findOneAndUpdate") return async (filter: Document, ...args: Document[]) => {
        const key = `${name}:${filter._id}`;
        const versions = context.readVersions;
        const check = versioned.has(name) && filter._id && versions?.has(key);
        const field = context.readVersionFields?.get(key) || "updatedAt";
        const guarded = check ? { $and: [filter, { ...(field === "createdAt" ? { updatedAt: null } : {}), [field]: versions!.get(key) }] } : filter;
        const actual = property !== "deleteOne" ? [quotationUpdate(args[0], name, context), ...args.slice(1)] : args;
        const previous = check ? versions!.get(key) : null;
        if (previous && property !== "deleteOne" && actual[0].$set?.updatedAt) {
          const proposed = new Date(actual[0].$set.updatedAt).getTime();
          // Date-based revisions must advance even when two writes share a clock tick.
          actual[0].$set = { ...actual[0].$set, updatedAt: new Date(Math.max(proposed, previous.getTime() + 1)) };
        }
        const result = await Reflect.apply(object[property], object, [quotationFilter(guarded, context), ...actual]);
        if (check && !(property === "updateOne" ? result.matchedCount : property === "deleteOne" ? result.deletedCount : result)) throw conflict();
        if (check) { versions!.delete(key); context.readVersionFields?.delete(key); }
        return result;
      };
      if (property === "find" || property === "findOne" || property === "countDocuments" || property === "deleteOne" || property === "deleteMany") return (filter = {}, ...args: Document[]) => Reflect.apply(object[property], object, [quotationFilter(filter, context), ...args]);
      if (property === "aggregate") return (pipeline: Document[] = [], ...args: Document[]) => {
        if (unsafePipeline(pipeline)) throw new Error("Truy vấn liên collection Báo giá cần adapter có phạm vi.");
        return object.aggregate([{ $match: quotationFilter({}, context) }, ...pipeline], ...args);
      };
      if (property === "insertOne") return (value: Document, ...args: Document[]) => object.insertOne(quotationInsert(value, name, context), ...args);
      if (property === "insertMany") return (values: Document[], ...args: Document[]) => object.insertMany(values.map(value => quotationInsert(value, name, context)), ...args);
      if (property === "updateOne" || property === "updateMany" || property === "findOneAndUpdate") return (filter: Document, update: Document, ...args: Document[]) => Reflect.apply(object[property], object, [quotationFilter(filter, context), quotationUpdate(update, name, context), ...args]);
      if (property === "bulkWrite") return (operations: Document[], ...args: Document[]) => object.bulkWrite(operations.map(operation => {
        if (!operation.updateOne) throw new Error("Kiểu ghi hàng loạt Báo giá chưa được hỗ trợ.");
        return { updateOne: { ...operation.updateOne, filter: quotationFilter(operation.updateOne.filter, context), update: quotationUpdate(operation.updateOne.update, name, context) } };
      }), ...args);
      throw new Error(`Phép truy cập collection Báo giá chưa được cấp: ${String(property)}`);
    } });
  };
  return { collection } as unknown as Db;
}

export async function ensureQuotationSettings() {
  const context = quotationContext();
  const db = await connectDatabase();
  await db.collection("companies").updateOne({ _id: new ObjectId(context.scopeId) }, { $setOnInsert: { name: context.companyName, businessEmail: context.companyEmail, createdAt: new Date(), updatedAt: new Date() } }, { upsert: true });
}
