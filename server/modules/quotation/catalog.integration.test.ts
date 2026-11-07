import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { ObjectId } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { quotationContexts, quotationScopeId, type QuotationContext } from "./context";
import { ensureQuotationIndexes, quotationCollectionName } from "./db";
import { applyCatalogBulk, createCatalogProduct, importCatalogProducts, listCatalog, previewCatalogBulk, updateCatalogProduct, type CatalogBulkInput } from "./catalog.service";
import type { CatalogItem } from "./types";

const branch = new ObjectId().toHexString();
function context(companyCode = "CATALOG_QA", branchId = branch, permissions = ["quotation-price-book:manage"]) : QuotationContext {
  const scopeId = quotationScopeId(companyCode, branchId);
  return { companyCode, branchId, scopeId, actorId: "catalog-qa", actorName: "QA", permissions: new Set(permissions), companyName: "QA", companyEmail: "qa@example.test", user: { id: "catalog-qa", name: "QA", email: "qa@example.test", role: "user", companyId: scopeId } };
}
const run = <T>(work: () => Promise<T>, scope = context()) => quotationContexts.run(scope, work);
const data = (sku: string = randomUUID()) => ({ sku, name: "Sản phẩm kiểm thử", description: "Quy cách", unit: "cái", price: 101, currency: "VND", active: true, attributes: { "Màu": "Xanh" } });
const create = (sku?: string) => run(() => createCatalogProduct(data(sku), randomUUID())).then(result => result.item);
const selected = (items: CatalogItem[]) => items.map(item => ({ id: String(item._id), updatedAt: new Date(item.updatedAt).toISOString() }));
const change = async (items: CatalogItem[], action: CatalogBulkInput["action"]) => run(async () => { const input = { action, selection: selected(items) }; const result = await previewCatalogBulk(input); return applyCatalogBulk({ ...input, previewHash: result.previewHash }, randomUUID()); });

describe("quotation product management", () => {
  let mongo: MongoMemoryReplSet;
  beforeAll(async () => { mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, dbName: "quotation_catalog" } }); await mongoose.connect(mongo.getUri()); await ensureQuotationIndexes(); }, 120_000);
  afterAll(async () => { await mongoose.disconnect(); await mongo?.stop(); });
  it("creates a normalized product once when a request is retried", async () => {
    const key = randomUUID(), input = data(" manual-sku ");
    const first = await run(() => createCatalogProduct(input, key)), second = await run(() => createCatalogProduct(input, key));
    expect(first.item.sku).toBe("MANUAL-SKU"); expect(String(second.item._id)).toBe(String(first.item._id));
    await expect(run(() => createCatalogProduct({ ...input, price: 200 }, key))).rejects.toMatchObject({ statusCode: 409 });
    await expect(run(() => createCatalogProduct(data("MANUAL-SKU"), randomUUID()))).rejects.toMatchObject({ statusCode: 409 });
  });
  it("uses company and branch boundaries for SKU uniqueness and all mutations", async () => {
    const item = await create("SCOPED-SKU");
    const other = context("OTHER_COMPANY");
    expect((await run(() => createCatalogProduct(data("SCOPED-SKU"), randomUUID()), other)).item.sku).toBe(item.sku);
    await expect(run(() => updateCatalogProduct(String(item._id), data("STOLEN"), item.updatedAt.toISOString()), other)).rejects.toMatchObject({ statusCode: 404 });
    await expect(run(() => previewCatalogBulk({ action: "delete", selection: selected([item]) }), context("CATALOG_QA", new ObjectId().toHexString()))).rejects.toMatchObject({ statusCode: 404 });
  });
  it("rejects writes for readers and invalid input before any product is created", async () => {
    await expect(run(() => createCatalogProduct(data(), randomUUID()), context("CATALOG_QA", branch, ["quotation-price-book:read"]))).rejects.toMatchObject({ statusCode: 403 });
    for (const values of [{ price: "" }, { price: -1 }, { effectiveFrom: "2026-02-31" }, { effectiveFrom: "2026-11-08", effectiveTo: "2026-11-01" }, { attributes: { A: "1", " a ": "2" } }]) await expect(run(() => createCatalogProduct({ ...data(), ...values }, randomUUID()))).rejects.toMatchObject({ statusCode: 422 });
  });
  it("requires a new SKU and the source revision when duplicating", async () => {
    const source = await create("DUPLICATE-SOURCE");
    await expect(run(() => createCatalogProduct(data(source.sku), randomUUID(), String(source._id), source.updatedAt.toISOString()))).rejects.toMatchObject({ statusCode: 409 });
    const { item: copied } = await run(() => createCatalogProduct({ ...data("DUPLICATE-NEW"), active: undefined }, randomUUID(), String(source._id), source.updatedAt.toISOString()));
    expect(copied).toMatchObject({ sku: "DUPLICATE-NEW", active: false, copiedFromId: String(source._id), attributes: { "Màu": "Xanh" } });
    expect(String(copied._id)).not.toBe(String(source._id));
    await expect(run(() => createCatalogProduct(data("DUPLICATE-STALE"), randomUUID(), String(source._id), new Date(0).toISOString()))).rejects.toMatchObject({ statusCode: 409 });
  });
  it("rejects a stale edit and a missing revision", async () => {
    const item = await create();
    const updated = await run(() => updateCatalogProduct(String(item._id), { ...item, price: 202 }, item.updatedAt.toISOString()));
    expect(updated.item!.price).toBe(202);
    await expect(run(() => updateCatalogProduct(String(item._id), { ...item, price: 303 }, item.updatedAt.toISOString()))).rejects.toMatchObject({ statusCode: 409 });
    await expect(run(() => updateCatalogProduct(String(item._id), item, undefined))).rejects.toMatchObject({ statusCode: 428 });
  });
  it("soft-deletes, reserves its SKU, and restores a product as inactive", async () => {
    const item = await create("RESERVED-SKU");
    const deleted = await change([item], "delete");
    expect(deleted.items[0]).toMatchObject({ deletedAt: expect.any(Date), deletedBy: "catalog-qa" });
    expect((await run(() => listCatalog({ q: "RESERVED-SKU" }))).total).toBe(0);
    expect((await run(() => listCatalog({ status: "deleted", q: "RESERVED-SKU" }))).total).toBe(1);
    await expect(run(() => createCatalogProduct(data("RESERVED-SKU"), randomUUID()))).rejects.toMatchObject({ statusCode: 409 });
    const restored = await change(deleted.items, "restore");
    expect(restored.items[0].deletedAt).toBeUndefined(); expect(restored.items[0].active).toBe(false);
    expect((await change(restored.items, "activate")).items[0].active).toBe(true);
  });
  it("previews rounded prices and applies a repeated batch only once", async () => {
    const item = await create();
    await run(async () => {
      const input: CatalogBulkInput = { action: "price", selection: selected([item]), adjustment: { mode: "percent", value: 10 } };
      const preview = await previewCatalogBulk(input), key = randomUUID();
      expect(preview.rows[0].after.price).toBe(111);
      const command = { ...input, previewHash: preview.previewHash };
      const first = await applyCatalogBulk(command, key), retry = await applyCatalogBulk(command, key);
      expect(first.items[0].price).toBe(111); expect(retry.items[0].price).toBe(111);
      const actual = await mongoose.connection.db!.collection(quotationCollectionName("catalogItems")).findOne({ _id: item._id });
      expect(actual?.price).toBe(111);
    });
  });
  it("rejects edited previews, negative results and mixed-currency amount changes", async () => {
    const item = await create(), usd = (await run(() => createCatalogProduct({ ...data(), currency: "USD" }, randomUUID()))).item;
    await run(async () => {
      const input: CatalogBulkInput = { action: "price", selection: selected([item]), adjustment: { mode: "amount", value: 10 } };
      const preview = await previewCatalogBulk(input);
      await expect(applyCatalogBulk({ ...input, adjustment: { mode: "amount", value: 20 }, previewHash: preview.previewHash }, randomUUID())).rejects.toMatchObject({ statusCode: 409 });
      await expect(previewCatalogBulk({ ...input, adjustment: { mode: "percent", value: -101 } })).rejects.toMatchObject({ statusCode: 422 });
      await expect(previewCatalogBulk({ ...input, selection: selected([item, usd]) })).rejects.toMatchObject({ statusCode: 422 });
      await expect(previewCatalogBulk({ action: "delete", selection: Array.from({ length: 201 }, () => selected([item])[0]) })).rejects.toMatchObject({ statusCode: 422 });
    });
  });
  it("does not partially change a batch after another tab edits one selected product", async () => {
    const first = await create(), second = await create();
    const input: CatalogBulkInput = { action: "price", selection: selected([first, second]), adjustment: { mode: "amount", value: 10 } };
    const preview = await run(() => previewCatalogBulk(input));
    await run(() => updateCatalogProduct(String(second._id), { ...second, price: 222 }, second.updatedAt.toISOString()));
    await expect(run(() => applyCatalogBulk({ ...input, previewHash: preview.previewHash }, randomUUID()))).rejects.toMatchObject({ statusCode: 409 });
    expect((await mongoose.connection.db!.collection(quotationCollectionName("catalogItems")).findOne({ _id: first._id }))?.price).toBe(101);
  });
  it("rolls back the first write and its audit when the second write fails", async () => {
    const first = await create(), second = await create();
    const input: CatalogBulkInput = { action: "deactivate", selection: selected([first, second]) };
    const preview = await run(() => previewCatalogBulk(input));
    const prototype = Object.getPrototypeOf(mongoose.connection.db!.collection(quotationCollectionName("catalogItems"))), original = prototype.findOneAndUpdate;
    const fail = vi.spyOn(prototype, "findOneAndUpdate").mockImplementation(function (this: { collectionName: string }, ...args: unknown[]) {
      if (this.collectionName === quotationCollectionName("catalogItems") && String((args[0] as { _id?: ObjectId })._id) === String(second._id)) throw new Error("Injected write failure");
      return Reflect.apply(original, this, args);
    });
    try { await expect(run(() => applyCatalogBulk({ ...input, previewHash: preview.previewHash }, randomUUID()))).rejects.toThrow("Injected write failure"); }
    finally { fail.mockRestore(); }
    expect(await mongoose.connection.db!.collection(quotationCollectionName("catalogItems")).countDocuments({ _id: { $in: [first._id, second._id] }, active: true })).toBe(2);
    expect(await mongoose.connection.db!.collection(quotationCollectionName("auditLogs")).countDocuments({ action: "catalog_item_deactivate", "after._id": { $in: [first._id, second._id] } })).toBe(0);
  });
  it("rejects an import containing a deleted SKU without inserting the other rows", async () => {
    const item = await create("IMPORT-DELETED"); await change([item], "delete");
    await expect(run(() => importCatalogProducts([data("IMPORT-SHOULD-ROLLBACK"), data("IMPORT-DELETED")], "QA.xlsx"))).rejects.toMatchObject({ statusCode: 409 });
    expect(await mongoose.connection.db!.collection(quotationCollectionName("catalogItems")).countDocuments({ sku: "IMPORT-SHOULD-ROLLBACK" })).toBe(0);
  });
  it("imports new rows and updates prices without reactivating or removing manual metadata", async () => {
    const source = await create("IMPORT-PRESERVE");
    await run(() => updateCatalogProduct(String(source._id), { ...source, active: false, effectiveFrom: "2026-01-01", attributes: { "Ghi chú riêng": "Giữ lại" } }, source.updatedAt.toISOString()));
    const imported = await run(() => importCatalogProducts([{ sku: source.sku, name: source.name, unit: source.unit, price: 303, currency: "VND", attributes: { "Màu": "Đỏ" } }, data("IMPORTED-NEW")], "prices.csv"));
    expect(imported).toMatchObject({ upsertedCount: 1, matchedCount: 1 });
    expect(await mongoose.connection.db!.collection(quotationCollectionName("catalogItems")).findOne({ _id: source._id })).toMatchObject({ price: 303, active: false, effectiveFrom: "2026-01-01", attributes: { "Ghi chú riêng": "Giữ lại", "Màu": "Đỏ" } });
  });
  it("preserves saved quote prices and ERP inventory while catalog prices change", async () => {
    const item = await create(); const db = mongoose.connection.db!;
    const quote = { _id: new ObjectId(), quoteNumber: "SNAPSHOT-QA", lines: [{ catalogItemId: String(item._id), name: item.name, unitPrice: 101, quantity: 2, lineTotal: 202 }], total: 202 };
    const inventory = { _id: new ObjectId(), sku: item.sku, sellingPrice: 999 };
    await db.collection(quotationCollectionName("quotes")).insertOne(quote); await db.collection("productprices").insertOne(inventory);
    const changed = (await run(() => updateCatalogProduct(String(item._id), { ...item, price: 500 }, item.updatedAt.toISOString()))).item!; await change([changed], "delete");
    expect(await db.collection(quotationCollectionName("quotes")).findOne({ _id: quote._id })).toEqual(quote);
    expect(await db.collection("productprices").findOne({ _id: inventory._id })).toEqual(inventory);
  });
  it("rejects conflicting imported effective dates and rolls back the whole file", async () => {
    const item = await run(() => createCatalogProduct({ ...data("IMPORT-DATES"), effectiveTo: "2026-10-01" }, randomUUID()));
    await expect(run(() => importCatalogProducts([data("DATE-ROLLBACK"), { ...data(item.item.sku), effectiveFrom: "2026-11-01" }], "QA.csv"))).rejects.toMatchObject({ statusCode: 422 });
    expect(await mongoose.connection.db!.collection(quotationCollectionName("catalogItems")).countDocuments({ sku: "DATE-ROLLBACK" })).toBe(0);
    expect((await mongoose.connection.db!.collection(quotationCollectionName("catalogItems")).findOne({ _id: item.item._id }))?.effectiveFrom).toBeFalsy();
  });
  it("rejects object values in product text fields instead of storing coerced text", async () => {
    await expect(run(() => createCatalogProduct({ ...data(), name: { value: "sai" } }, randomUUID()))).rejects.toMatchObject({ statusCode: 422 });
  });
  it("merges imported attributes by normalized name and enforces the combined limit", async () => {
    const source = await create("IMPORT-ATTRIBUTES");
    await run(() => importCatalogProducts([{ ...data(source.sku), attributes: { "màu": "Đỏ" } }], "QA.csv"));
    expect((await mongoose.connection.db!.collection(quotationCollectionName("catalogItems")).findOne({ _id: source._id }))?.attributes).toEqual({ "màu": "Đỏ" });
    const attributes = Object.fromEntries(Array.from({ length: 50 }, (_, index) => [`Thông số ${index}`, "Giá trị"]));
    await expect(run(() => importCatalogProducts([{ ...data(source.sku), attributes }], "QA.csv"))).rejects.toMatchObject({ statusCode: 422 });
  });
  it("supports search, sorting and pages without returning tombstones by default", async () => {
    const response = await run(() => listCatalog({ page: "1", pageSize: "2", sort: "price_desc" }));
    expect(response.items).toHaveLength(2); expect(response.total).toBeGreaterThan(2); expect(response.nextPage).toBe(2);
    expect(response.items.some(item => item.deletedAt)).toBe(false);
  });
});
