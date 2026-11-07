import { createHash } from "node:crypto";
import mongoose from "mongoose";
import { ObjectId } from "mongodb";
import { Queue, Worker } from "bullmq";
import { quotationContext, quotationContexts } from "./context";
import { resolveQuotationJobContext } from "./access";
import { quotationRoutePermissions } from "./permissions";
import { assertQuotationPermission } from "./context";
import { connectDatabase, quotationCollectionName } from "./db";

const queueName = "quotation-documents";
const options = () => ({ prefix: process.env.QUOTATION_QUEUE_PREFIX || `igen-${process.env.NODE_ENV || "development"}-quotation`, connection: {
  host: process.platform === "win32" && (!process.env.REDIS_HOST || process.env.REDIS_HOST === "redis") ? "127.0.0.1" : process.env.REDIS_HOST || "redis",
  port: Number(process.env.REDIS_PORT || 6379), ...(process.env.REDIS_PASSWORD ? { password: process.env.REDIS_PASSWORD } : {}),
} });
let queue: Queue | undefined;
export function getQuotationQueue() {
  if (!queue) {
    queue = new Queue(queueName, { ...options(), defaultJobOptions: { attempts: 1, removeOnComplete: 100, removeOnFail: 100 } });
    queue.on("error", error => console.error("[quotation-queue]", error.message));
  }
  return queue;
}

export interface QuotationJob {
  _id?: ObjectId; companyId: string; companyCode: string; branchId: string; actorId: string; createdBy: string;
  kind: string; sourceId: string; inputHash: string; sourceHash: string; command: { path: string; query: Record<string, string> };
  status: "queued" | "running" | "completed" | "failed"; createdAt: Date; updatedAt: Date; startedAt?: Date; fileId?: string; filename?: string; error?: string;
}
const sourceCollection = (kind: string) => kind === "budget" ? "budgetPlans" : kind === "contract" ? "contracts" : kind === "acceptance" || kind === "settlement" ? "acceptanceRecords" : "quotes";
export function quotationDocumentHash(value: any): string {
  const { templateFillPlan, xlsxTemplateFillPlan, fileCreationPending, ...content } = value || {};
  return createHash("sha256").update(JSON.stringify(content)).digest("hex");
}
export async function quotationSourceHash(kind: string, id: string): Promise<string> {
  const source = await (await connectDatabase()).collection(sourceCollection(kind)).findOne({ _id: new ObjectId(id) });
  if (!source) throw Object.assign(new Error("Chứng từ nguồn không còn tồn tại."), { statusCode: 404 });
  return quotationDocumentHash(source);
}
const allowedExport = /^\/(?:quotes\/[a-f\d]{24}\/export|budget-plans\/[a-f\d]{24}\/export|contracts\/[a-f\d]{24}\/(?:file|docx)|acceptance-records\/[a-f\d]{24}\/(?:file|docx|settlement\.xlsx))$/i;

export async function queueQuotationExport(kind: string, sourceId: string) {
  const context = quotationContext();
  assertQuotationPermission("quotation-ai:manage");
  const command = kind === "customer_quote" ? { path: `/quotes/${sourceId}/export`, query: {} } : context.command;
  if (!command || !allowedExport.test(command.path)) throw new Error("Tác vụ xuất không thuộc lệnh Báo giá đã đăng ký.");
  const query = { ...command.query }; delete query.background;
  const sourceHash = await quotationSourceHash(kind, sourceId);
  const inputHash = createHash("sha256").update(JSON.stringify([context.scopeId, context.actorId, kind, sourceId, sourceHash, command.path, Object.entries(query).sort()])).digest("hex");
  const jobs = (await connectDatabase()).collection<QuotationJob>("generatedExportJobs");
  const now = new Date();
  let job = await jobs.findOne({ inputHash });
  if (!job) {
    try {
      const record: QuotationJob = { companyId: context.scopeId, companyCode: context.companyCode, branchId: context.branchId, actorId: context.actorId, createdBy: context.actorId, kind, sourceId, inputHash, sourceHash, command: { path: command.path, query }, status: "queued", createdAt: now, updatedAt: now };
      const result = await jobs.insertOne(record); job = { ...record, _id: result.insertedId };
    } catch (error: any) { if (error.code !== 11000) throw error; job = await jobs.findOne({ inputHash }); }
  }
  if (!job?._id) throw new Error("Không lưu được tác vụ xuất tài liệu.");
  if (job.status === "failed") {
    await jobs.updateOne({ _id: job._id, status: "failed" }, { $set: { status: "queued", updatedAt: now, actorId: context.actorId }, $unset: { error: "", startedAt: "" } });
    job.status = "queued";
  }
  if (job.status === "queued") void enqueueQuotationJob(String(job._id)).catch(() => undefined); // Mongo intent is recovered by the worker if Redis is temporarily unavailable.
  return { jobId: String(job._id), status: job.status };
}

export async function enqueueQuotationJob(id: string) {
  const existing = await getQuotationQueue().getJob(id);
  if (existing) { const state = await existing.getState(); if (state === "failed" || state === "completed") await existing.remove(); else return; }
  await getQuotationQueue().add("export", { jobId: id }, { jobId: id });
}

type ExportHandler = (request: any, response: any, next: (error?: unknown) => void) => unknown;
const handlers = new Map<string, ExportHandler>();
export function registerQuotationExportHandler(path: string, handler: ExportHandler) { handlers.set(path, handler); }

async function invokeExport(job: QuotationJob) {
  if (job.kind === "customer_quote") {
    const source = await import("./router");
    const db = await connectDatabase();
    const quote = await db.collection<any>("quotes").findOne({ _id: new ObjectId(job.sourceId), companyId: quotationContext().scopeId });
    const file = await source.renderCustomerQuoteExport(db, quotationContext().user, quote);
    await source.storeGeneratedExport(db, quotationContext().user, file.filename, file.mimeType, file.bytes);
    return;
  }
  const route = [...handlers].find(([pattern]) => new RegExp(`^${pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(":id", "([a-f\\d]{24})")}$`, "i").test(job.command.path));
  if (!route) throw new Error("Không tìm thấy handler xuất tài liệu.");
  const headers: Record<string, string> = {};
  let status = 200;
  await new Promise<void>((resolve, reject) => {
    const response: any = { locals: {}, setHeader(name: string, value: string) { headers[name] = value; return this; }, type(value: string) { headers["Content-Type"] = value; return this; }, status(value: number) { status = value; return this; }, json(value: any) { status >= 400 ? reject(new Error(value.error || "Không xuất được tài liệu.")) : resolve(); return this; }, send() { status >= 400 ? reject(new Error("Không xuất được tài liệu.")) : resolve(); return this; } };
    const request: any = { params: { id: job.sourceId }, query: { ...job.command.query, background: "0" }, body: {}, headers: {}, method: "GET", path: job.command.path, originalUrl: job.command.path, get: () => undefined, header: () => undefined };
    try { Promise.resolve(route[1](request, response, error => error ? reject(error) : resolve())).catch(reject); } catch (error) { reject(error); }
  });
}

export async function processQuotationJob(id: string) {
  const native = mongoose.connection.db!.collection<QuotationJob>(quotationCollectionName("generatedExportJobs"));
  const job = await native.findOneAndUpdate({ _id: new ObjectId(id), status: "queued" }, { $set: { status: "running", startedAt: new Date(), updatedAt: new Date() } }, { returnDocument: "after" });
  if (!job) return;
  try {
    const context = await resolveQuotationJobContext(job);
    await quotationContexts.run({ ...context, jobId: id, command: job.command, exportKind: job.kind, exportSourceId: job.sourceId }, async () => {
      for (const permission of quotationRoutePermissions("GET", job.command.path)) assertQuotationPermission(permission);
      assertQuotationPermission("quotation-ai:manage");
      if (await quotationSourceHash(job.kind, job.sourceId) !== job.sourceHash) throw new Error("Chứng từ đã thay đổi. Hãy tạo lại file cho phiên bản hiện tại.");
      await invokeExport(job);
      const current = quotationContext();
      if (!current.artifactId) throw new Error("Tác vụ chưa lưu được file đầu ra hợp lệ.");
      if (await quotationSourceHash(job.kind, job.sourceId) !== job.sourceHash) throw new Error("Chứng từ đã thay đổi trong khi tạo file. Hãy tạo lại file cho phiên bản hiện tại.");
      const db = await connectDatabase();
      const file = await db.collection("companyFiles").findOne({ _id: new ObjectId(current.artifactId) });
      await native.updateOne({ _id: job._id, status: "running" }, { $set: { status: "completed", fileId: current.artifactId, filename: file?.originalFilename, updatedAt: new Date() }, $unset: { error: "" } });
      if (job.kind === "estimate_draft") await db.collection("quotes").updateOne({ _id: new ObjectId(job.sourceId) }, { $unset: { fileCreationPending: "" } });
    });
  } catch (error) {
    await native.updateOne({ _id: job._id }, { $set: { status: "failed", error: error instanceof Error ? error.message.slice(0, 1000) : "Không tạo được tài liệu.", updatedAt: new Date() } });
  }
}

export async function startQuotationWorker() {
  await import("./router");
  if (!process.env.QUOTATION_QUEUE_PREFIX) throw new Error("QUOTATION_QUEUE_PREFIX phải riêng cho từng môi trường.");
  const worker = new Worker(queueName, job => processQuotationJob(job.data.jobId), { ...options(), concurrency: Math.max(1, Math.min(4, Number(process.env.QUOTATION_WORKER_CONCURRENCY || 1))) });
  worker.on("error", error => console.error("[quotation-worker]", error.message));
  const recover = async () => {
    const jobs = mongoose.connection.db!.collection<QuotationJob>(quotationCollectionName("generatedExportJobs"));
    // An interrupted provider operation may have succeeded: never replay it automatically.
    await jobs.updateMany({ status: "running", startedAt: { $lt: new Date(Date.now() - 30 * 60_000) } }, { $set: { status: "failed", error: "Tác vụ bị gián đoạn; cần kiểm tra kết quả và thử lại nếu phù hợp.", updatedAt: new Date() } });
    for (const job of await jobs.find({ status: "queued" }).limit(100).toArray()) await enqueueQuotationJob(String(job._id));
  };
  await recover();
  const timer = setInterval(() => { void recover().catch(error => console.error("[quotation-worker]", error.message)); }, 15_000); timer.unref();
  return { close: async () => { clearInterval(timer); await worker.close(); if (queue) await queue.close(); } };
}
