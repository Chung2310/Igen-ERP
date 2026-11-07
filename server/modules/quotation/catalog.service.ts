import { createHash } from "node:crypto";
import mongoose, { type ClientSession } from "mongoose";
import { ObjectId, type Document, type AnyBulkWriteOperation } from "mongodb";
import { assertQuotationPermission, quotationContext } from "./context";
import { quotationCollectionName } from "./db";
import { mapCatalogRow } from "./catalog-validation";
import type { CatalogItem } from "./types";

const error = (statusCode: number, message: string) => Object.assign(new Error(message), { statusCode });
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const scope = () => { const ctx = quotationContext(); return { companyCode: ctx.companyCode, branchId: ctx.branchId }; };
const catalog = () => mongoose.connection.db!.collection<CatalogItem>(quotationCollectionName("catalogItems"));
const operations = () => mongoose.connection.db!.collection(quotationCollectionName("catalogOperations"));
const idOf = (id: string) => { if (!/^[a-f\d]{24}$/i.test(id)) throw error(400, "Mã sản phẩm không hợp lệ."); return new ObjectId(id); };
const revision = (row: CatalogItem) => row.updatedAt || row.createdAt;
const nextRevision = (row: CatalogItem) => new Date(Math.max(Date.now(), new Date(revision(row)).getTime() + 1));
const revisionFilter = (row: CatalogItem) => row.updatedAt ? { updatedAt: row.updatedAt } : { updatedAt: null, createdAt: row.createdAt };
function assertRevision(row: CatalogItem, expected: unknown) {
  if (typeof expected !== "string" || !Number.isFinite(Date.parse(expected))) throw error(428, "Thiếu phiên bản sản phẩm. Hãy tải lại danh sách trước khi lưu.");
  if (new Date(revision(row)).toISOString() !== expected) throw error(409, `Sản phẩm ${row.sku} đã thay đổi. Hãy tải lại trước khi thực hiện.`);
}
function values(input: unknown) {
  const mapped = mapCatalogRow(input, 1, "VND");
  if (mapped.ok === false) throw error(422, mapped.error.replace(/^Dòng 1: /, ""));
  const body = input as Record<string, unknown>;
  if (body.active !== undefined && typeof body.active !== "boolean") throw error(422, "Trạng thái sản phẩm không hợp lệ.");
  return { ...mapped.value, attributes: mapped.value.attributes || {}, active: body.active === undefined ? true : body.active as boolean };
}
async function audit(action: string, before: unknown, after: unknown, session: ClientSession) {
  const ctx = quotationContext();
  await mongoose.connection.db!.collection(quotationCollectionName("auditLogs")).insertOne({ ...scope(), companyId: ctx.scopeId, actorId: ctx.actorId, action, before, after, createdAt: new Date() }, { session });
}
async function transaction<T>(work: (session: ClientSession) => Promise<T>): Promise<T> {
  const session = await mongoose.startSession();
  try { return (await session.withTransaction(() => work(session))) as T; }
  finally { await session.endSession(); }
}
async function command<T>(key: unknown, payload: unknown, work: (session: ClientSession) => Promise<T>): Promise<T> {
  assertQuotationPermission("quotation-price-book:manage");
  if (typeof key !== "string" || !/^[a-z\d_-]{8,100}$/i.test(key)) throw error(400, "Mã yêu cầu không hợp lệ. Hãy mở lại biểu mẫu.");
  const requestHash = hash({ actorId: quotationContext().actorId, payload }), filter = { ...scope(), key };
  try {
    return await transaction(async session => {
      const previous = await operations().findOne(filter, { session });
      if (previous) {
        if (previous.requestHash !== requestHash) throw error(409, "Mã yêu cầu đã được dùng cho nội dung khác.");
        return previous.result as T;
      }
      const result = await work(session);
      await operations().insertOne({ ...filter, actorId: quotationContext().actorId, requestHash, result, createdAt: new Date() }, { session });
      return result;
    });
  } catch (cause) {
    if ((cause as { code?: number }).code === 11000) {
      const previous = await operations().findOne(filter);
      if (previous?.requestHash === requestHash) return previous.result as T;
      throw error(409, "SKU hoặc mã yêu cầu đã tồn tại. Nếu sản phẩm đã xóa, hãy khôi phục thay vì tạo lại.");
    }
    throw cause;
  }
}

export async function listCatalog(query: Record<string, unknown>) {
  assertQuotationPermission("quotation-price-book:read");
  const today = new Date().toISOString().slice(0, 10);
  const filter: Document = { ...scope(), ...(query.includeDeleted === "all" ? {} : { deletedAt: null }) };
  if (query.status === "deleted") filter.deletedAt = { $ne: null };
  else if (query.status && query.status !== "all") {
    filter.deletedAt = null;
    if (query.status === "inactive") filter.active = false;
    else {
      filter.active = true;
      if (query.status === "upcoming") filter.effectiveFrom = { $gt: today };
      else if (query.status === "expired") { filter.$and = [{ $or: [{ effectiveFrom: null }, { effectiveFrom: { $lte: today } }] }]; filter.effectiveTo = { $lt: today }; }
      else if (query.status === "active") filter.$and = [{ $or: [{ effectiveFrom: null }, { effectiveFrom: { $lte: today } }] }, { $or: [{ effectiveTo: null }, { effectiveTo: { $gte: today } }] }];
      else throw error(400, "Bộ lọc trạng thái không hợp lệ.");
    }
  }
  if (typeof query.q === "string" && query.q.trim()) {
    const pattern = new RegExp(query.q.trim().slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ sku: pattern }, { name: pattern }, { description: pattern }];
  }
  const paged = query.page !== undefined;
  const page = Number(query.page || 1), pageSize = Number(query.pageSize || 100);
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000 || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 1000) throw error(400, "Phân trang không hợp lệ.");
  const sorts: Record<string, Record<string, 1 | -1>> = { name_asc: { name: 1, _id: 1 }, name_desc: { name: -1, _id: 1 }, price_asc: { price: 1, _id: 1 }, price_desc: { price: -1, _id: 1 } };
  const [items, total] = await Promise.all([catalog().find(filter).sort(sorts[String(query.sort)] || { sku: 1, _id: 1 }).skip(paged ? (page - 1) * pageSize : 0).limit(paged ? pageSize : 5000).toArray(), catalog().countDocuments(filter)]);
  return { items: items.map(row => ({ ...row, updatedAt: revision(row) })), total, page, pageSize: paged ? pageSize : 5000, nextPage: paged && page * pageSize < total ? page + 1 : null, truncated: !paged && total > 5000, currency: "VND" };
}

export async function createCatalogProduct(input: unknown, key: unknown, sourceId?: string, sourceVersion?: unknown) {
  const data = values(input);
  if (sourceId && (input as Record<string, unknown>).active === undefined) data.active = false;
  return command(key, { action: sourceId ? "duplicate" : "create", data, sourceId, sourceVersion }, async session => {
    if (sourceId) {
      const source = await catalog().findOne({ ...scope(), _id: idOf(sourceId), deletedAt: null }, { session });
      if (!source) throw error(404, "Không tìm thấy sản phẩm nguồn.");
      assertRevision(source, sourceVersion);
      if (source.sku === data.sku) throw error(409, "Bản sao phải có mã SKU mới.");
    }
    const now = new Date();
    const item: CatalogItem & Record<string, unknown> = { ...data, ...scope(), _id: new ObjectId(), companyId: quotationContext().scopeId, ...(sourceId ? { copiedFromId: sourceId } : {}), createdAt: now, updatedAt: now };
    await catalog().insertOne(item, { session });
    await audit(sourceId ? "catalog_item_duplicated" : "catalog_item_created", null, item, session);
    return { item };
  });
}

export async function updateCatalogProduct(id: string, input: unknown, expected: unknown) {
  assertQuotationPermission("quotation-price-book:manage");
  const data = values(input);
  try {
    return await transaction(async session => {
      const item = await catalog().findOne({ ...scope(), _id: idOf(id), deletedAt: null }, { session });
      if (!item) throw error(404, "Không tìm thấy sản phẩm đang quản lý.");
      assertRevision(item, expected);
      const { effectiveFrom, effectiveTo, ...fields } = data;
      const updated = await catalog().findOneAndUpdate({ ...scope(), _id: item._id, ...revisionFilter(item) }, { $set: { ...fields, ...(effectiveFrom ? { effectiveFrom } : {}), ...(effectiveTo ? { effectiveTo } : {}), updatedAt: nextRevision(item) }, $unset: { ...(!effectiveFrom ? { effectiveFrom: "" } : {}), ...(!effectiveTo ? { effectiveTo: "" } : {}) } }, { session, returnDocument: "after" });
      if (!updated) throw error(409, "Sản phẩm đã thay đổi. Hãy tải lại.");
      await audit("catalog_item_updated", item, updated, session);
      return { item: updated };
    });
  } catch (cause) { if ((cause as { code?: number }).code === 11000) throw error(409, "SKU đã tồn tại, kể cả trong danh sách đã xóa."); throw cause; }
}

export type CatalogAction = "activate" | "deactivate" | "delete" | "restore" | "price";
type Selection = { id: string; updatedAt: string };
export type CatalogBulkInput = { action: CatalogAction; selection: Selection[]; adjustment?: { mode: "amount" | "percent"; value: number }; previewHash?: string };
async function preview(input: CatalogBulkInput, session?: ClientSession) {
  assertQuotationPermission("quotation-price-book:manage");
  if (!input || !["activate", "deactivate", "delete", "restore", "price"].includes(input.action) || !Array.isArray(input.selection) || !input.selection.length || input.selection.length > 200) throw error(422, "Chọn từ 1 đến 200 sản phẩm và thao tác hợp lệ.");
  const ids = input.selection.map(entry => idOf(String(entry?.id)));
  if (new Set(ids.map(String)).size !== ids.length) throw error(422, "Danh sách sản phẩm bị trùng.");
  const items = await catalog().find({ ...scope(), _id: { $in: ids } }, { session }).toArray();
  if (items.length !== ids.length) throw error(404, "Có sản phẩm không còn tồn tại trong phạm vi đang làm việc.");
  if (input.action === "price" && input.adjustment?.mode === "amount" && new Set(items.map(item => item.currency)).size > 1) throw error(422, "Điều chỉnh theo số tiền cần chọn các sản phẩm cùng tiền tệ. Có thể dùng phần trăm cho nhiều tiền tệ.");
  const rows = input.selection.map(entry => {
    const item = items.find(row => String(row._id) === String(idOf(entry.id)))!;
    assertRevision(item, entry.updatedAt);
    if (input.action === "restore" ? !item.deletedAt : Boolean(item.deletedAt)) throw error(409, `Trạng thái sản phẩm ${item.sku} đã thay đổi. Hãy tải lại.`);
    let price = item.price;
    if (input.action === "price") {
      const adjustment = input.adjustment;
      if (!adjustment || !["amount", "percent"].includes(adjustment.mode) || typeof adjustment.value !== "number" || !Number.isFinite(adjustment.value) || Math.abs(adjustment.value) > 1e12) throw error(422, "Mức điều chỉnh giá không hợp lệ.");
      price = item.price + (adjustment.mode === "percent" ? item.price * adjustment.value / 100 : adjustment.value);
      const factor = item.currency === "VND" ? 1 : 100;
      price = Math.round((price + Number.EPSILON) * factor) / factor;
      if (!Number.isFinite(price) || price < 0 || price > 1e12) throw error(422, `Giá mới của ${item.sku} phải từ 0 đến 1.000.000.000.000.`);
    }
    return { id: String(item._id), sku: item.sku, name: item.name, currency: item.currency, updatedAt: new Date(revision(item)).toISOString(), before: { price: item.price, active: item.active, deleted: Boolean(item.deletedAt) }, after: { price, active: input.action === "activate" ? true : input.action === "deactivate" || input.action === "restore" ? false : item.active, deleted: input.action === "delete" } };
  });
  return { rows, previewHash: hash({ scope: scope(), action: input.action, adjustment: input.adjustment, rows }), items };
}
export async function previewCatalogBulk(input: CatalogBulkInput) { const result = await preview(input); return { rows: result.rows, previewHash: result.previewHash }; }
export async function applyCatalogBulk(input: CatalogBulkInput, key: unknown) {
  if (!input || typeof input !== "object") throw error(422, "Nội dung thao tác không hợp lệ.");
  return command(key, { action: input.action, selection: input.selection, adjustment: input.adjustment, previewHash: input.previewHash }, async session => {
    const result = await preview(input, session);
    if (!input.previewHash || input.previewHash !== result.previewHash) throw error(409, "Nội dung xem trước đã thay đổi. Hãy xem trước lại trước khi áp dụng.");
    return writePreview(input, result, session);
  });
}

async function writePreview(input: CatalogBulkInput, result: Awaited<ReturnType<typeof preview>>, session: ClientSession) {
  const updatedItems: CatalogItem[] = [];
  for (const [index, item] of result.items.entries()) {
    const change = result.rows.find(row => row.id === String(item._id))!;
    const update = { $set: { price: change.after.price, active: change.after.active, updatedAt: nextRevision(item), ...(input.action === "delete" ? { deletedAt: new Date(), deletedBy: quotationContext().actorId } : {}) }, ...(input.action === "restore" ? { $unset: { deletedAt: "" as const, deletedBy: "" as const } } : {}) };
    const updated = await catalog().findOneAndUpdate({ ...scope(), _id: item._id, ...revisionFilter(item) }, update, { session, returnDocument: "after" });
    if (!updated) throw error(409, `Sản phẩm thứ ${index + 1} đã thay đổi. Chưa áp dụng thao tác.`);
    updatedItems.push(updated);
    await audit(`catalog_item_${input.action}`, item, updated, session);
  }
  return { items: updatedItems, count: updatedItems.length };
}

export async function changeCatalogState(id: string, action: "delete" | "restore", expected: unknown, key: unknown) {
  return command(key, { id, action, expected }, async session => {
    const input = { action, selection: [{ id, updatedAt: String(expected || "") }] };
    const result = await preview(input, session);
    return writePreview(input, result, session);
  });
}

/** Imports reserve deleted SKUs and commit every row together. */
export async function importCatalogProducts(rows: unknown[], source: string) {
  assertQuotationPermission("quotation-price-book:manage");
  const products = rows.map(row => values(row));
  if (!products.length || products.length > 10000 || new Set(products.map(row => row.sku)).size !== products.length) throw error(422, "Bảng giá rỗng, quá lớn hoặc có SKU trùng.");
  try {
    return await transaction(async session => {
      const existing = await catalog().find({ ...scope(), sku: { $in: products.map(row => row.sku) } }, { session }).toArray();
      const deleted = existing.find(row => row.deletedAt);
      if (deleted) throw error(409, `SKU ${deleted.sku} đã xóa. Hãy khôi phục sản phẩm trước khi nhập lại bảng giá.`);
      const bySku = new Map(existing.map(row => [row.sku, row]));
      const mutations = products.map((data, index): AnyBulkWriteOperation<CatalogItem> => {
        const previous = bySku.get(data.sku);
        if (previous) {
          const { effectiveFrom, effectiveTo, ...fields } = data;
          const from = effectiveFrom || previous.effectiveFrom, to = effectiveTo || previous.effectiveTo;
          if (from && to && from > to) throw error(422, `SKU ${data.sku}: ngày hiệu lực mới mâu thuẫn với khoảng ngày đã lưu.`);
          const attributes = { ...previous.attributes };
          for (const [key, value] of Object.entries(data.attributes)) {
            const oldKey = Object.keys(attributes).find(existing => existing.normalize("NFC").toLocaleLowerCase("vi") === key.normalize("NFC").toLocaleLowerCase("vi"));
            if (oldKey && oldKey !== key) delete attributes[oldKey];
            attributes[key] = value;
          }
          const merged = mapCatalogRow({ ...data, effectiveFrom: from, effectiveTo: to, attributes }, index + 1, data.currency);
          if (merged.ok === false) throw error(422, merged.error);
          const active = (rows[index] as Record<string, unknown>).active === undefined ? previous.active : data.active;
          return { updateOne: { filter: { ...scope(), _id: previous._id, deletedAt: null, ...revisionFilter(previous) }, update: { $set: { ...fields, active, attributes, ...(effectiveFrom ? { effectiveFrom } : {}), ...(effectiveTo ? { effectiveTo } : {}), updatedAt: nextRevision(previous) } } } };
        }
        const now = new Date();
        return { insertOne: { document: { ...scope(), ...data, companyId: quotationContext().scopeId, createdAt: now, updatedAt: now } } };
      });
      const result = await catalog().bulkWrite(mutations, { session, ordered: true });
      if (result.matchedCount !== existing.length) throw error(409, "Bảng giá vừa thay đổi. Hãy nhập lại.");
      await audit("catalog_imported", existing.map(({ _id, sku, price, currency }) => ({ _id, sku, price, currency })), { source, products: products.map(({ sku, price, currency }) => ({ sku, price, currency })) }, session);
      return { upsertedCount: result.insertedCount, matchedCount: result.matchedCount, modifiedCount: result.modifiedCount };
    });
  } catch (cause) { if ((cause as { code?: number }).code === 11000) throw error(409, "SKU vừa được tạo hoặc khôi phục. Hãy xem lại bảng giá trước khi nhập."); throw cause; }
}
