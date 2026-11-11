import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
vi.mock("bullmq", () => ({ Queue: class { on() {} async getJob() { return null; } async add() { return {}; } }, Worker: class {} }));
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { ObjectId } from "mongodb";
import { quotationContexts, quotationScopeId, type QuotationContext } from "./context";
import { connectDatabase, ensureQuotationIndexes, quotationCollectionName } from "./db";
import { quotationRoutePermissions } from "./permissions";
import { quotationDocumentHash, queueQuotationExport, processQuotationJob } from "./jobs";

const branchA = new ObjectId().toHexString(), branchB = new ObjectId().toHexString();
function scope(companyCode = "QUOTE_A", branchId = branchA): QuotationContext {
  const scopeId = quotationScopeId(companyCode, branchId);
  return { companyCode, branchId, scopeId, actorId: new ObjectId().toHexString(), actorName: "QA", companyName: "QA", companyEmail: "qa@example.test", permissions: new Set(["*"]), user: { id: "qa", name: "QA", email: "qa@example.test", role: "user", companyId: scopeId }, readVersions: new Map() };
}
describe("quotation ERP data boundaries", () => {
  let mongo: MongoMemoryServer;
  beforeAll(async () => {
    mongo = await MongoMemoryServer.create({ instance: { dbName: "quotation_integration" } });
    await mongoose.connect(mongo.getUri());
    await ensureQuotationIndexes();
  }, 120_000);
  afterAll(async () => { await mongoose.disconnect(); await mongo?.stop(); });
  it("isolates reads, updates, deletes and aggregations across company and branch", async () => {
    const id = new ObjectId();
    await quotationContexts.run(scope(), async () => {
      const db = await connectDatabase();
      await db.collection("quotes").insertOne({ _id: id, quoteNumber: "BG-QA", customerName: "Private A", updatedAt: new Date() });
    });
    for (const ctx of [scope("QUOTE_B"), scope("QUOTE_A", branchB)]) await quotationContexts.run(ctx, async () => {
      const rows = (await connectDatabase()).collection("quotes");
      expect(await rows.findOne({ _id: id })).toBeNull();
      expect((await rows.updateOne({ _id: id }, { $set: { customerName: "Intruder" } })).matchedCount).toBe(0);
      expect((await rows.deleteOne({ _id: id })).deletedCount).toBe(0);
      expect(await rows.aggregate([{ $match: { _id: id } }]).toArray()).toEqual([]);
    });
    const stored = await mongoose.connection.db!.collection(quotationCollectionName("quotes")).findOne({ _id: id });
    expect(stored?.customerName).toBe("Private A");
  });
  it("rejects scope mutation, nested cross-collection aggregation and unregistered collections", async () => {
    await quotationContexts.run(scope(), async () => {
      const db = await connectDatabase(), rows = db.collection("quotes");
      await expect(rows.updateOne({}, { $rename: { customerName: "companyCode" } })).rejects.toMatchObject({ statusCode: 403 });
      await expect(rows.updateOne({}, { $set: { branchId: branchB } })).rejects.toMatchObject({ statusCode: 403 });
      expect(() => rows.aggregate([{ $facet: { stolen: [{ $lookup: { from: "users", as: "data", pipeline: [] } }] } }])).toThrow();
      expect(() => db.collection("users")).toThrow();
    });
  });
  it("rejects concurrent edits after the document changes between read and write", async () => {
    const id = new ObjectId();
    await quotationContexts.run(scope(), async () => {
      const rows = (await connectDatabase()).collection("quotes");
      await rows.insertOne({ _id: id, quoteNumber: "BG-CAS", updatedAt: new Date(1), total: 100 });
      await rows.findOne({ _id: id });
      await mongoose.connection.db!.collection(quotationCollectionName("quotes")).updateOne({ _id: id }, { $set: { total: 200, updatedAt: new Date(2) } });
      await expect(rows.updateOne({ _id: id }, { $set: { total: 300 } })).rejects.toMatchObject({ statusCode: 409 });
    });
  });
  it("keeps quotation catalog and prices independent from ERP inventory and POS", async () => {
    const erp = mongoose.connection.db!.collection("productprices");
    const original = { _id: new ObjectId(), companyCode: "QUOTE_A", branchId: branchA, sku: "SAME-SKU", sellingPrice: 500 };
    await erp.insertOne(original);
    await quotationContexts.run(scope(), async () => {
      const catalog = (await connectDatabase()).collection("catalogItems");
      await catalog.insertOne({ sku: "SAME-SKU", name: "Riêng cho báo giá", price: 100, updatedAt: new Date(1) });
      await catalog.updateOne({ sku: "SAME-SKU" }, { $set: { price: 200 } });
      expect((await catalog.findOne({ sku: "SAME-SKU" }))?.price).toBe(200);
    });
    expect(await erp.findOne({ _id: original._id })).toEqual(original);
  });
  it("rejects a stale approval after an edit wins the race", async () => {
    const id = new ObjectId();
    await quotationContexts.run(scope(), async () => {
      const quotes = (await connectDatabase()).collection("quotes");
      await quotes.insertOne({ _id: id, quoteNumber: "BG-APPROVAL", status: "draft", updatedAt: new Date(1) });
      await quotes.findOne({ _id: id });
      await mongoose.connection.db!.collection(quotationCollectionName("quotes")).updateOne({ _id: id }, { $set: { total: 500, updatedAt: new Date(2) } });
      await expect(quotes.findOneAndUpdate({ _id: id, status: "draft" }, { $set: { status: "approved" } }, { returnDocument: "after" })).rejects.toMatchObject({ statusCode: 409 });
    });
  });
  it("does not lose a concurrent update when writes happen in the same millisecond", async () => {
    const id = new ObjectId(), first = scope(), second = scope(), stamp = new Date(1000);
    await quotationContexts.run(first, async () => {
      const rows = (await connectDatabase()).collection("quotes");
      await rows.insertOne({ _id: id, quoteNumber: "BG-SAME-MS", total: 100, updatedAt: stamp });
      await rows.findOne({ _id: id });
    });
    await quotationContexts.run(second, async () => {
      const rows = (await connectDatabase()).collection("quotes");
      await rows.findOne({ _id: id });
      await rows.updateOne({ _id: id }, { $set: { total: 200, updatedAt: stamp } });
    });
    await quotationContexts.run(first, async () => {
      await expect((await connectDatabase()).collection("quotes").updateOne({ _id: id }, { $set: { total: 300, updatedAt: stamp } })).rejects.toMatchObject({ statusCode: 409 });
    });
  });
  it("deduplicates queued exports and preserves drafts when the job actor loses access", async () => {
    const id = new ObjectId(), ctx = scope();
    ctx.command = { path: `/quotes/${id}/export`, query: { background: "1", draft: "1" } };
    let jobId = "";
    await quotationContexts.run(ctx, async () => {
      const db = await connectDatabase();
      await db.collection("quotes").insertOne({ _id: id, quoteNumber: "BG-JOB", total: 100, fileCreationPending: true, updatedAt: new Date(1) });
      const first = await queueQuotationExport("estimate_draft", String(id)), second = await queueQuotationExport("estimate_draft", String(id));
      expect(second.jobId).toBe(first.jobId); jobId = first.jobId;
      expect(await db.collection("generatedExportJobs").countDocuments({ sourceId: String(id) })).toBe(1);
    });
    await processQuotationJob(jobId);
    expect((await mongoose.connection.db!.collection(quotationCollectionName("generatedExportJobs")).findOne({ _id: new ObjectId(jobId) }))?.status).toBe("failed");
    expect(await mongoose.connection.db!.collection(quotationCollectionName("quotes")).findOne({ _id: id })).not.toBeNull();
  });
  it("uses separate approval, commercial document and price-book permissions", () => {
    expect(quotationRoutePermissions("POST", "/quotes/a/approve")).toContain("quotation-approval:manage");
    expect(quotationRoutePermissions("GET", "/contracts/a")).toContain("quotation-contract:read");
    expect(quotationRoutePermissions("POST", "/price-list")).toContain("quotation-price-book:manage");
  });
  it("queues the upstream settlement file route through the scoped ERP worker", async () => {
    const id = new ObjectId();
    await quotationContexts.run({ ...scope(), command: { path: `/acceptance-records/${id}/settlement/file`, query: { background: "1" } } }, async () => {
      const db = await connectDatabase();
      await db.collection("acceptanceRecords").insertOne({ _id: id, status: "completed", updatedAt: new Date() });
      const queued = await queueQuotationExport("settlement", String(id));
      const job = await db.collection("generatedExportJobs").findOne({ _id: new ObjectId(queued.jobId) });
      expect(job).toMatchObject({ kind: "settlement", sourceId: String(id), command: { path: `/acceptance-records/${id}/settlement/file`, query: {} } });
    });
  });
  it("invalidates an export when a price changes but not when a fill-plan cache is written", () => {
    const source = { total: 100, updatedAt: new Date(1) };
    expect(quotationDocumentHash(source)).toBe(quotationDocumentHash({ ...source, templateFillPlan: { edits: [] } }));
    expect(quotationDocumentHash(source)).not.toBe(quotationDocumentHash({ ...source, total: 200 }));
  });
});
