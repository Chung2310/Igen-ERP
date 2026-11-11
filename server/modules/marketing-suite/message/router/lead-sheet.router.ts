import { Router, type RequestHandler, type Response } from "express";
import Joi from "joi";
import { requireAuth, requirePermission, type AuthenticatedRequest } from "../../../../middleware/auth";
import { validateRequest } from "../../../../middleware/validation";
import { SocialIntegrationModel } from "../../shared/model/social-integration.model";
import { LeadSheetSyncModel } from "../model/lead-sheet-sync.model";
import { googleOrderSheetService, parseGoogleSpreadsheetId, safeSheetName } from "../service/google-order-sheet.service";
import { googleCustomerSheetService } from "../service/google-customer-sheet.service";

export const leadSheetRouter = Router({ mergeParams: true });
const body = { body: Joi.object({ enabled: Joi.boolean().required(),
  spreadsheetUrl: Joi.string().max(2000).allow("").required(), sheetName: Joi.string().trim().max(80).required() }) };
const run = (handler: (req: AuthenticatedRequest, res: Response) => Promise<unknown>): RequestHandler =>
  (req, res, next) => { void handler(req as AuthenticatedRequest, res).catch(next); };
leadSheetRouter.use(requireAuth as RequestHandler, requirePermission("social-integration:manage") as RequestHandler,
  validateRequest({ params: Joi.object({ integrationId: Joi.string().hex().length(24).required() }) }));
const owned = (req: AuthenticatedRequest) => SocialIntegrationModel.findOne({
  _id: req.params.integrationId, companyCode: req.user!.companyCode, platform: { $in: ["Facebook", "Zalo", "TikTok"] },
});
function settings(input: { enabled: boolean; spreadsheetUrl: string; sheetName: string }) {
  const spreadsheetUrl = input.spreadsheetUrl.trim();
  if (input.enabled && !spreadsheetUrl) throw Object.assign(new Error("Cần nhập link Google Sheet trước khi bật xuất Lead."), { statusCode: 400 });
  if (spreadsheetUrl) {
    let url: URL;
    try { url = new URL(spreadsheetUrl); } catch { throw Object.assign(new Error("Link Google Sheet không hợp lệ."), { statusCode: 400 }); }
    if (url.protocol !== "https:" || url.hostname !== "docs.google.com" || !/^\/spreadsheets\/d\/[a-zA-Z0-9_-]+/.test(url.pathname)) {
      throw Object.assign(new Error("Hãy dùng link Google Sheet bắt đầu bằng https://docs.google.com/spreadsheets/d/."), { statusCode: 400 });
    }
  }
  try {
    return { enabled: input.enabled, spreadsheetUrl, spreadsheetId: spreadsheetUrl ? parseGoogleSpreadsheetId(spreadsheetUrl) : "",
      sheetName: safeSheetName(input.sheetName, "Leads"), updatedAt: new Date() };
  } catch (error) { throw Object.assign(error instanceof Error ? error : new Error(String(error)), { statusCode: 400 }); }
}

leadSheetRouter.get("/", run(async (req, res) => {
  const integration = await owned(req);
  if (!integration) return res.status(404).json({ status: "error", message: "Không tìm thấy tài khoản của doanh nghiệp." });
  const scope = { companyCode: req.user!.companyCode, integrationId: String(integration._id) };
  const [pending, failed, synced, latest] = await Promise.all([
    LeadSheetSyncModel.countDocuments({ ...scope, status: { $in: ["pending", "syncing"] } }),
    LeadSheetSyncModel.countDocuments({ ...scope, status: "failed" }),
    LeadSheetSyncModel.countDocuments({ ...scope, status: "synced" }),
    LeadSheetSyncModel.findOne({ ...scope, status: "failed" }).select("lastError").sort({ updatedAt: -1 }).lean(),
  ]);
  let serviceAccountEmail = "";
  try { serviceAccountEmail = googleOrderSheetService.serviceAccountEmail(); } catch { /* Configuration remains editable without server credentials. */ }
  return res.json({ status: "success", data: { config: integration.crmLeadSheetConfig || {
    enabled: false, spreadsheetUrl: "", spreadsheetId: "", sheetName: "Leads",
  }, serviceAccountEmail, pending, failed, synced, lastError: latest?.lastError || "" } });
}));
leadSheetRouter.put("/", validateRequest(body), run(async (req, res) => {
  const integration = await owned(req);
  if (!integration) return res.status(404).json({ status: "error", message: "Không tìm thấy tài khoản của doanh nghiệp." });
  const config = settings(req.body);
  if (config.enabled) await googleCustomerSheetService.prepareLead(config.spreadsheetId, config.sheetName);
  integration.crmLeadSheetConfig = config;
  await integration.save();
  return res.json({ status: "success", data: config });
}));
leadSheetRouter.post("/test", validateRequest(body), run(async (req, res) => {
  if (!await owned(req)) return res.status(404).json({ status: "error", message: "Không tìm thấy tài khoản của doanh nghiệp." });
  const config = settings({ ...req.body, enabled: true });
  const data = await googleOrderSheetService.test(config.spreadsheetId);
  return res.json({ status: "success", data });
}));
leadSheetRouter.post("/retry", run(async (req, res) => {
  const integration = await owned(req);
  if (!integration) return res.status(404).json({ status: "error", message: "Không tìm thấy tài khoản của doanh nghiệp." });
  if (!integration.crmLeadSheetConfig?.enabled) return res.status(400).json({ status: "error", message: "Hãy bật đích xuất Lead sang Sheet trước khi thử lại." });
  const result = await LeadSheetSyncModel.updateMany({ companyCode: req.user!.companyCode, integrationId: String(integration._id),
    $or: [{ status: "failed" }, { status: "syncing", leaseUntil: { $lte: new Date() } }] }, {
    $set: { status: "pending", attempts: 0, lastError: "", nextAttemptAt: new Date() }, $unset: { leaseId: 1, leaseUntil: 1 },
  });
  return res.json({ status: "success", data: { queued: result.modifiedCount } });
}));
