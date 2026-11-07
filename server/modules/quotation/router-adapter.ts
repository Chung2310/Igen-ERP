import { listErpCustomers } from "./erp-sources";
import express, { Router, type RequestHandler } from "express";
import { ObjectId } from "mongodb";
import { quotationScopeMiddleware } from "./access";
import { assertQuotationPermission, quotationContext } from "./context";
import { connectDatabase } from "./db";
import { quotationSourceHash, registerQuotationExportHandler } from "./jobs";

export function quotationKindPermission(kind: string) {
  return kind === "contract" ? "quotation-contract:read" : kind === "acceptance" || kind === "settlement" ? "quotation-acceptance:read" : "quotation:read";
}
async function authorizeFileOrJob(request: any) {
  const jobMatch = request.path.match(/^\/export-jobs\/([a-f\d]{24})$/i);
  const fileMatch = request.path.match(/^\/files\/([a-f\d]{24})\/(?:download|preview)$/i);
  if (jobMatch || fileMatch) {
    const row = await (await connectDatabase()).collection(jobMatch ? "generatedExportJobs" : "companyFiles").findOne({ _id: new ObjectId((jobMatch || fileMatch)![1]) });
    if (row) assertQuotationPermission(quotationKindPermission(String(row.kind || "")));
  }
  if (request.path === "/generated-export-files/latest") assertQuotationPermission(quotationKindPermission(String(request.query.kind || "")));
}

async function latestFile(request: any, response: any) {
  const sourceId = String(request.query.sourceId || ""), kind = String(request.query.kind || "");
  if (!/^[a-f\d]{24}$/i.test(sourceId) || !["budget", "contract", "acceptance", "settlement", "customer_quote", "estimate", "estimate_draft"].includes(kind)) return response.status(400).json({ error: "Loại hoặc mã chứng từ không hợp lệ." });
  const db = await connectDatabase();
  let sourceHash: string;
  try { sourceHash = await quotationSourceHash(kind, sourceId); } catch { return response.status(404).json({ error: "Không tìm thấy chứng từ nguồn." }); }
  const job = await db.collection("generatedExportJobs").findOne({ sourceId, kind, sourceHash }, { sort: { createdAt: -1 } });
  const file = job?.status === "completed" && ObjectId.isValid(String(job.fileId)) ? await db.collection("companyFiles").findOne({ _id: new ObjectId(String(job.fileId)) }) : null;
  return response.json({ file: file ? { id: String(file._id), filename: file.originalFilename, mimeType: file.mimeType, createdAt: file.createdAt } : null,
    job: job ? { id: String(job._id), status: job.status, filename: job.filename, error: job.error, createdAt: job.createdAt, updatedAt: job.updatedAt } : null });
}

/** Adapt Express 5 source handlers to ERP Express 4, catching every async rejection. */
export function createQuotationRouter(): Router {
  const router = Router();
  router.use(quotationScopeMiddleware);
  for (const method of ["get", "post", "put", "patch", "delete"] as const) {
    const register = (router[method] as Function).bind(router);
    (router as any)[method] = (paths: string | string[], ...handlers: RequestHandler[]) => {
      const actualPaths = Array.isArray(paths) ? paths : [paths];
      const original = handlers[handlers.length - 1];
      for (const path of actualPaths) if (method === "get" && /\/(?:export|file|docx|settlement\.xlsx)$/.test(path)) registerQuotationExportHandler(path, original as any);
      const wrapped: RequestHandler = (request, response, next) => {
        void (async () => {
          await authorizeFileOrJob(request);
          // Catalog commands validate revisions inside their transaction, after replay detection.
          const versionTarget = request.path.match(/^\/(quotes|budget-plans|contracts|acceptance-records)\/([a-f\d]{24})(?:\/|$)/i);
          if (!["GET", "HEAD"].includes(request.method) && versionTarget && quotationContext().expectedVersion) {
            const collections = { quotes: "quotes", "budget-plans": "budgetPlans", contracts: "contracts", "acceptance-records": "acceptanceRecords", catalog: "catalogItems" };
            await (await connectDatabase()).collection(collections[versionTarget[1]]).findOne({ _id: new ObjectId(versionTarget[2]) });
          }
          if (request.path === "/generated-export-files/latest") return latestFile(request, response);
          return original(request, response, next);
        })().catch(next);
      };
      return register(paths, ...handlers.slice(0, -1), wrapped);
    };
  }
  router.get("/erp/customers", async (req, res) => { res.json({ customers: await listErpCustomers(String(req.query.q || "")) }); });
  router.get("/auth/me", (_request, response) => { const ctx = quotationContext(); response.json({ user: { ...ctx.user, capabilities: [...ctx.permissions] } }); });
  router.get("/settings", async (_request, response, next) => {
    try { const ctx = quotationContext(); const settings = await (await connectDatabase()).collection("companies").findOne({ _id: new ObjectId(ctx.scopeId) }, { projection: { quoteTemplateId: 0 } }); response.json({ settings }); } catch (error) { next(error); }
  });
  router.put("/settings", express.json({ limit: "64kb" }), async (request, response, next) => {
    try {
      const input = request.body || {}, values: Record<string, string> = {};
      for (const field of ["name", "taxId", "address", "phone", "businessEmail", "representativeName"]) {
        if (typeof input[field] !== "string" || input[field].length > (field === "address" ? 500 : 250)) return response.status(400).json({ error: "Thông tin bên bán không hợp lệ." });
        values[field] = input[field].trim();
      }
      if (!values.name || (values.businessEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.businessEmail))) return response.status(400).json({ error: "Vui lòng nhập tên và email hợp lệ." });
      const ctx = quotationContext(); await (await connectDatabase()).collection("companies").updateOne({ _id: new ObjectId(ctx.scopeId) }, { $set: { ...values, updatedAt: new Date() } });
      return response.json({ settings: values });
    } catch (error) { next(error); }
  });
  return router;
}
