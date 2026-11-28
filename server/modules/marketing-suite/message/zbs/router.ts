import { Router, type Request, type Response } from "express";
import type { ZbsBatch } from "../../../../../shared/marketing-suite/zbs";
import type { AuthenticatedRequest } from "../../../../middleware/auth";
import { SocialIntegrationModel } from "../../shared/model/social-integration.model";
import { UserModel } from "../../../../model/user.model";
import { ZbsBatchModel, ZbsTemplateModel } from "./model";
import { confirmZbsBatch, createZbsDraft, getZbsBatch, publicBatch, publicTemplate, syncZbsTemplates, zbsAppId } from "./service";
import { assertZbsOa, zbsProviderRequest } from "./provider";
import { validateMapping, zbsError } from "./core";
import { applyZbsReceipts } from "./worker";

export const zbsRouter = Router();
// Mounted after suiteAccess: omni-inbox module + read/manage permissions apply to every route.
const route = (fn: (req: AuthenticatedRequest, res: Response, companyCode: string, userId: string) => Promise<unknown>) => (request: Request, res: Response) => {
  const req = request as AuthenticatedRequest;
  if (!req.user?.companyCode) return res.status(403).json({ message: "Không xác định được doanh nghiệp." });
  res.set("Cache-Control", "no-store");
  void fn(req, res, req.user.companyCode, req.user.id).catch(error => res.status(Number(error?.statusCode) || 500).json({ message: error?.statusCode ? error.message : "Không thể xử lý Zalo ZBS. Vui lòng thử lại." }));
};
zbsRouter.get("/accounts", route(async (_req, res, companyCode) => {
  const [accounts, users] = await Promise.all([
    SocialIntegrationModel.find({ companyCode, platform: "Zalo", isConnected: true, isMock: { $ne: true } }).select("username displayName").lean(),
    UserModel.find({ companyCode, disabledAt: null, "zaloIntegration.isConnected": true, "zaloIntegration.isMock": { $ne: true } }).select("zaloIntegration.oaId zaloIntegration.oaName").lean(),
  ]);
  const choices = new Map(accounts.map(a => [a.username, { oaId: a.username, name: a.displayName || a.username }]));
  for (const user of users) { const oa = user.zaloIntegration; if (oa?.oaId && !choices.has(oa.oaId)) choices.set(oa.oaId, { oaId: oa.oaId, name: oa.oaName || oa.oaId }); }
  res.json({ data: [...choices.values()] });
}));
zbsRouter.get("/templates", route(async (req, res, companyCode) => {
  const oaId = String(req.query.oaId || ""); await assertZbsOa(companyCode, oaId);
  res.json({ data: (await ZbsTemplateModel.find({ companyCode, oaId, appId: await zbsAppId(companyCode, oaId) }).sort({ name: 1 }).lean()).map(publicTemplate) });
}));
zbsRouter.post("/templates/sync", route(async (req, res, companyCode) => {
  if (req.body.force !== undefined && typeof req.body.force !== "boolean") throw zbsError("Tùy chọn đồng bộ không hợp lệ.");
  res.json({ data: (await syncZbsTemplates(companyCode, String(req.body.oaId || ""), req.body.force !== false)).map(publicTemplate) });
}));
zbsRouter.put("/templates/:templateId/mapping", route(async (req, res, companyCode) => {
  const oaId = String(req.body.oaId || ""); await assertZbsOa(companyCode, oaId);
  const query = { companyCode, oaId, appId: await zbsAppId(companyCode, oaId), templateId: String(req.params.templateId) };
  const template = await ZbsTemplateModel.findOne(query).lean(); if (!template) throw zbsError("Không tìm thấy mẫu.", 404);
  const mapping = validateMapping(req.body.mapping, template.params);
  await ZbsTemplateModel.updateOne(query, { $set: { mapping } }); res.json({ data: mapping });
}));
zbsRouter.post("/drafts", route(async (req, res, companyCode, userId) => res.status(201).json({ data: await createZbsDraft(companyCode, userId, req.body) })));
zbsRouter.get("/batches", route(async (req, res, companyCode) => {
  const page = Math.max(1, Math.min(10000, Math.floor(Number(req.query.page) || 1)));
  const query = { companyCode, ...(req.query.oaId ? { oaId: String(req.query.oaId) } : {}),
    ...(req.query.leadId ? { "rows.leadId": String(req.query.leadId) } : {}) };
  const batches = await ZbsBatchModel.aggregate([
    { $match: query }, { $sort: { createdAt: -1 } }, { $skip: (page - 1) * 25 }, { $limit: 25 },
    { $project: { name: 1, templateName: 1, method: 1, status: 1, createdAt: 1, test: 1,
      total: { $size: "$rows" }, delivered: { $size: { $filter: { input: "$rows", as: "row", cond: { $in: ["$$row.status", ["delivered", "read"]] } } } } } },
  ]);
  res.json({ data: batches.map(b => ({ id: String(b._id), name: b.name, templateName: b.templateName, method: b.method, status: b.status, createdAt: b.createdAt.toISOString(), test: b.test, total: b.total, delivered: b.delivered })), page, hasMore: await ZbsBatchModel.countDocuments(query) > page * 25 });
}));
zbsRouter.get("/batches/:id", route(async (req, res, companyCode) => {
  const batch = await getZbsBatch(companyCode, String(req.params.id)); await applyZbsReceipts(String(batch._id));
  res.json({ data: publicBatch(await getZbsBatch(companyCode, String(req.params.id))) });
}));
zbsRouter.post("/batches/:id/confirm", route(async (req, res, companyCode, userId) => {
  if (req.body.confirmed !== true) throw zbsError("Cần xác nhận nội dung và danh sách người nhận.");
  res.json({ data: await confirmZbsBatch(companyCode, userId, String(req.params.id)) });
}));
zbsRouter.post("/batches/:id/control", route(async (req, res, companyCode) => {
  const batch = await getZbsBatch(companyCode, String(req.params.id));
  const action = req.body.action;
  const allowed: ZbsBatch["status"][] = action === "pause" ? ["queued", "running"] : action === "resume" ? ["paused"] : action === "cancel" ? ["draft", "queued", "running", "paused"] : [];
  if (!allowed.includes(batch.status)) throw zbsError("Không thể thực hiện thao tác với trạng thái hiện tại.", 409);
  const status: ZbsBatch["status"] = action === "pause" ? "paused" : action === "resume" ? "queued" : "cancelled";
  const result = await ZbsBatchModel.findOneAndUpdate({ _id: batch._id, companyCode, status: { $in: allowed } }, {
    $set: { status, ...(action === "cancel" ? { "rows.$[row].status": "cancelled", "rows.$[row].reason": "Đã hủy trước khi gửi" } : {}) },
  }, { returnDocument: "after", ...(action === "cancel" ? { arrayFilters: [{ "row.status": "pending" }] } : {}) }).lean();
  if (!result) throw zbsError("Trạng thái đã thay đổi. Hãy tải lại.", 409);
  res.json({ data: publicBatch(result) });
}));
zbsRouter.post("/batches/:id/reconcile", route(async (req, res, companyCode) => {
  const batch = await getZbsBatch(companyCode, String(req.params.id));
  await assertZbsOa(companyCode, batch.oaId);
  for (const row of batch.rows.filter(r => r.method === "phone" && r.messageId && ["accepted", "unknown"].includes(r.status)).slice(0, 50)) {
    const response = await zbsProviderRequest(companyCode, batch.oaId, `/message/status?${new URLSearchParams({ message_id: row.messageId!, phone: row.recipient })}`, undefined, false, batch.appId);
    const deliveredAt = new Date(Number(response.data?.delivery_time));
    if (response.data?.status === 1 && Number.isFinite(+deliveredAt)) await ZbsBatchModel.updateOne({ _id: batch._id, rows: { $elemMatch: { id: row.id, status: { $in: ["accepted", "unknown"] } } } }, {
      $set: { "rows.$.status": "delivered", "rows.$.deliveredAt": deliveredAt.toISOString(), "rows.$.reason": "" },
    });
  }
  await applyZbsReceipts(String(batch._id));
  res.json({ data: publicBatch(await getZbsBatch(companyCode, String(req.params.id))) });
}));
