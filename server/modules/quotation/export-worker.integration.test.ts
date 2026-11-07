import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
vi.mock("bullmq", () => ({ Queue: class { on() {} async getJob() { return null; } async add() { return {}; } }, Worker: class {} }));
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { ObjectId } from "mongodb";
import * as XLSX from "xlsx";
import "./router";
import { CompanyModel } from "../../model/company.model";
import { BranchModel } from "../../model/branch.model";
import { UserModel } from "../../model/user.model";
import { AiSubscriptionPeriodModel } from "../marketing-suite/shared/model/ai-subscription.model";
import { quotationContexts, quotationScopeId } from "./context";
import { resolveQuotationJobContext } from "./access";
import { ensureQuotationIndexes, ensureQuotationSettings, connectDatabase, quotationCollectionName } from "./db";
import { processQuotationJob, queueQuotationExport } from "./jobs";

describe("quotation export worker with isolated provider responses", () => {
  let mongo: MongoMemoryReplSet;
  const companyCode = "QUOTATION_EXPORT_QA", branchId = new ObjectId().toHexString(), actorId = new ObjectId().toHexString();
  const scope = { companyCode, branchId, companyId: quotationScopeId(companyCode, branchId) };
  let uploaded: Buffer, providerCalls = 0, uploads = 0;
  let directCalls = 0, cleanupCalls = 0;
  let directInput: Buffer;
  let failCleanup = false;
  beforeAll(async () => {
    mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, dbName: "quotation_export_test" } });
    await mongoose.connect(mongo.getUri());
    await ensureQuotationIndexes();
    await CompanyModel.collection.insertOne({ code: companyCode, name: "QA", ownerEmail: "qa@example.test", lifecycleStatus: "active", enabledModules: ["quotation"] });
    await BranchModel.collection.insertOne({ _id: new mongoose.Types.ObjectId(branchId), companyCode, code: "MAIN", name: "QA", isActive: true });
    await UserModel.collection.insertOne({ _id: new mongoose.Types.ObjectId(actorId), email: "export.qa@example.test", role: "admin", companyCode, branchId, isActive: true });
    await AiSubscriptionPeriodModel.create({ companyCode, planId: new mongoose.Types.ObjectId(), planName: "Isolated test", aiLimit: 10, startsAt: new Date(Date.now() - 60_000), expiresAt: new Date(Date.now() + 3_600_000), createdBy: actorId });
    for (const [key, value] of Object.entries({ OPENROUTER_API_KEY: "test-key", QUOTATION_DOCUMENT_EDIT_MODE: "mapping", CLOUDINARY_CLOUD_NAME: "test-cloud", CLOUDINARY_API_KEY: "test-key", CLOUDINARY_API_SECRET: "test-secret" })) vi.stubEnv(key, value);
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url === "https://openrouter.ai/api/v1/files" && init?.method === "POST") {
        directInput = Buffer.from(await ((init.body as FormData).get("file") as Blob).arrayBuffer());
        return Response.json({ id: "qa-uploaded-file" });
      }
      if (url === "https://openrouter.ai/api/v1/files/qa-uploaded-file" && init?.method === "DELETE") return Response.json({ deleted: true });
      if (url === "https://openrouter.ai/api/v1/responses") {
        const body = JSON.parse(String(init?.body));
        if (body.input.startsWith("Use the shell tool once to delete")) { cleanupCalls++; return failCleanup ? Response.json({ error: "Cleanup unavailable" }, { status: 503 }) : Response.json({ status: "completed", output: [] }); }
        directCalls++;
        return Response.json({ status: "completed", output: [{ type: "openrouter:shell", container_id: "qa-container", files: [{ file_id: "qa-output", filename: "ai_output/qa-edited.xlsx" }] }] });
      }
      if (url === "https://openrouter.ai/api/v1/containers/qa-container/files/qa-output/content") {
        return new Response(Uint8Array.from(directInput));
      }
      if (url === "https://openrouter.ai/api/v1/chat/completions") {
        providerCalls++;
        const body = JSON.parse(String(init?.body));
        const parts = (body.messages as Array<{ content: string | Array<{ type: string; text: string }> }>).flatMap(message => Array.isArray(message.content) ? message.content : []);
        const request = parts.filter(part => part.type === "text").map(part => { try { return JSON.parse(part.text) as { machineSuggestedMap?: unknown }; } catch { return {}; } }).find(part => part.machineSuggestedMap);
        if (!request) throw new Error("The renderer did not include its semantic workbook map.");
        return Response.json({ choices: [{ message: { content: JSON.stringify(request.machineSuggestedMap) } }] });
      }
      if (url === "https://api.cloudinary.com/v1_1/test-cloud/raw/upload") {
        const form = init?.body as FormData;
        expect(form.get("type")).toBe("authenticated");
        uploaded = Buffer.from(await (form.get("file") as Blob).arrayBuffer()); uploads++;
        return Response.json({ public_id: "qa-private-file", asset_id: "qa-private-asset" });
      }
      throw new Error(`Unexpected external request: ${url}`);
    }));
  }, 120_000);
  afterAll(async () => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); await mongoose.disconnect(); await mongo?.stop(); });

  async function queueDraft(number: string) {
    const id = new ObjectId();
    const context = await resolveQuotationJobContext({ actorId, companyCode, branchId });
    return quotationContexts.run({ ...context, command: { path: `/quotes/${id}/export`, query: { background: "1", draft: "1", templateId: "none" } } }, async () => {
      await ensureQuotationSettings();
      await (await connectDatabase()).collection("quotes").insertOne({ _id: id, kind: "estimate", quoteNumber: number, customerName: "Khách kiểm thử", customerEmail: "", lines: [{ catalogItemId: new ObjectId().toHexString(), name: "Dịch vụ kiểm thử", sku: "QA", quantity: 1.5, unit: "giờ", unitPrice: 100, lineTotal: 150, currency: "VND", attributes: {} }], informationNeeded: [], additionalInformation: {}, informationConfirmed: true, taxRate: 0, taxAmount: 0, taxRateConfirmed: true, shippingFee: 0, shippingFeeConfirmed: true, subtotal: 150, total: 150, currency: "VND", status: "draft", createdBy: actorId, createdAt: new Date(1000), updatedAt: new Date(1000), fileCreationPending: true });
      return { id, ...await queueQuotationExport("estimate_draft", String(id)) };
    });
  }
  it("renders and stores the actual spreadsheet, completes the job and settles its AI usage", async () => {
    const job = await queueDraft("BG-EXPORT-QA");
    await processQuotationJob(job.jobId);
    const db = mongoose.connection.db!;
    const stored = await db.collection(quotationCollectionName("generatedExportJobs")).findOne({ _id: new ObjectId(job.jobId) });
    expect(stored?.error).toBeUndefined(); expect(stored?.status).toBe("completed");
    const file = await db.collection(quotationCollectionName("companyFiles")).findOne({ _id: new ObjectId(stored!.fileId) });
    expect(file).toMatchObject({ ...scope, kind: "estimate_draft", sourceId: String(job.id), originalFilename: "BG-EXPORT-QA-nhap.xlsx" });
    expect(file?.bytes).toBe(uploaded.length); expect(uploads).toBe(1); expect(providerCalls).toBe(1);
    const workbook = XLSX.read(uploaded, { type: "buffer" });
    const rows = workbook.SheetNames.flatMap(name => XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[name], { header: 1 }));
    expect(rows.some(row => row.includes("Dịch vụ kiểm thử") && row.includes(1.5) && row.includes(100) && row.includes(150))).toBe(true);
    expect((await db.collection(quotationCollectionName("quotes")).findOne({ _id: job.id }))?.fileCreationPending).toBeUndefined();
    expect(await AiSubscriptionPeriodModel.findOne({ companyCode }).lean()).toMatchObject({ used: 1, reserved: 0 });
  }, 60_000);
  it("rejects an obsolete queued revision before any provider or upload call", async () => {
    const job = await queueDraft("BG-EXPORT-STALE"), callsBefore = providerCalls, uploadsBefore = uploads;
    const db = mongoose.connection.db!;
    await db.collection(quotationCollectionName("quotes")).updateOne({ _id: job.id }, { $set: { customerName: "Đã sửa", updatedAt: new Date(2000) } });
    await processQuotationJob(job.jobId);
    expect(await db.collection(quotationCollectionName("generatedExportJobs")).findOne({ _id: new ObjectId(job.jobId) })).toMatchObject({ status: "failed", error: expect.stringContaining("đã thay đổi") });
    expect(providerCalls).toBe(callsBefore); expect(uploads).toBe(uploadsBefore);
    expect(await db.collection(quotationCollectionName("quotes")).findOne({ _id: job.id })).toMatchObject({ fileCreationPending: true, customerName: "Đã sửa" });
  });
  it("completes direct editing with the last AI unit and audits cleanup without consuming another user unit", async () => {
    vi.stubEnv("QUOTATION_DOCUMENT_EDIT_MODE", "direct");
    const before = await AiSubscriptionPeriodModel.findOne({ companyCode }).lean();
    await AiSubscriptionPeriodModel.updateOne({ companyCode }, { $set: { aiLimit: before!.used + 1 } });
    const job = await queueDraft("BG-DIRECT-QA");
    await processQuotationJob(job.jobId);
    const db = mongoose.connection.db!;
    const stored = await db.collection(quotationCollectionName("generatedExportJobs")).findOne({ _id: new ObjectId(job.jobId) });
    expect(stored?.error).toBeUndefined();
    expect(stored).toMatchObject({ status: "completed", filename: "BG-DIRECT-QA-nhap.xlsx" });
    expect(directCalls).toBe(1); expect(cleanupCalls).toBe(1);
    expect(await AiSubscriptionPeriodModel.findOne({ companyCode }).lean()).toMatchObject({ used: before!.used + 1, reserved: 0 });
    expect(await db.collection(quotationCollectionName("auditLogs")).findOne({ action: "ai_sandbox_cleanup" })).toMatchObject({ companyCode, branchId, succeeded: true });
    expect(XLSX.read(uploaded, { type: "buffer" }).SheetNames).toEqual(XLSX.read(directInput, { type: "buffer" }).SheetNames);
  }, 60_000);
  it("keeps a completed artifact when sandbox cleanup fails and records the maintenance failure", async () => {
    const before = await AiSubscriptionPeriodModel.findOne({ companyCode }).lean();
    await AiSubscriptionPeriodModel.updateOne({ companyCode }, { $set: { aiLimit: before!.used + 1 } });
    failCleanup = true;
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      const job = await queueDraft("BG-CLEANUP-FAIL");
      await processQuotationJob(job.jobId);
      const db = mongoose.connection.db!;
      expect(await db.collection(quotationCollectionName("generatedExportJobs")).findOne({ _id: new ObjectId(job.jobId) })).toMatchObject({ status: "completed", fileId: expect.any(String) });
      expect(await db.collection(quotationCollectionName("auditLogs")).findOne({ action: "ai_sandbox_cleanup", succeeded: false })).toMatchObject({ companyCode, branchId });
      expect(await AiSubscriptionPeriodModel.findOne({ companyCode }).lean()).toMatchObject({ used: before!.used + 1, reserved: 0 });
    } finally { failCleanup = false; warning.mockRestore(); }
  }, 60_000);
});
