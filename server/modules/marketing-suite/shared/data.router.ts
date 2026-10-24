import { Router, type Request, type Response, type NextFunction } from "express";
import type { Model } from "mongoose";
import mongoose from "mongoose";
import { SocialIntegrationModel } from "./model/social-integration.model";
import { MarketingContentModel } from "../campaign/model/marketing-content.model";
import { CRMTicketModel } from "../message/model/crm-ticket.model";
import type { AuthenticatedRequest } from "../../../middleware/auth";
import { requirePermission } from "../../../middleware/auth";
import { Schema } from "mongoose";
import { AIReplyLogModel } from "../message/model/ai-reply-log.model";
import { assertMarketingAccountOwnership } from "./account-ownership";
import { AiAutoReplyConfigSchema } from "../../../model/user.model";
import { assertCampaignContentLinks, syncCampaignContentMedia } from "../campaign/service/campaign-uploaded-media.service";

type SuiteRecord = Record<string, unknown> & { companyCode: string };
type AsyncHandler = (req: AuthenticatedRequest, res: Response) => Promise<unknown>;
const run = (handler: AsyncHandler) => (req: Request, res: Response, next: NextFunction) => { void handler(req as AuthenticatedRequest, res).catch(next); };
const secretFields = ["accessToken", "refreshToken", "appSecret", "verifyToken"];
function publicRecord(value: unknown, integration: boolean) {
  const record = value && typeof value === "object" ? { ...value } as Record<string, unknown> : {};
  if (integration) for (const field of secretFields) { record[`has${field[0].toUpperCase()}${field.slice(1)}`] = Boolean(record[field]); delete record[field]; }
  return record;
}
function payload(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw Object.assign(new Error("Dữ liệu không hợp lệ."), { statusCode: 400 });
  const result: Record<string, unknown> = {};
  for (const [key, data] of Object.entries(value)) {
    if (key.startsWith("$") || key.includes(".") || ["__proto__", "prototype", "constructor"].includes(key)) throw Object.assign(new Error("Trường dữ liệu không hợp lệ."), { statusCode: 400 });
    if (!["_id", "companyCode", "createdBy", "createdAt", "__v", "facebookUserId"].includes(key)) result[key] = data;
  }
  return result;
}
export const suiteDataRouter = Router();
// Account selectors need metadata, independently of credential-management permissions.
const accountFields = "platform displayName username avatarUrl isConnected connectedAt createdBy isMock";
for (const prefix of ["/omni-inbox", "/marketing-campaigns", "/company-knowledge"]) {
  const fields = `${accountFields}${prefix === "/omni-inbox" ? " aiAutoReplyConfig" : ""}${prefix === "/marketing-campaigns" ? " blotatoAccountId" : ""}`;
  suiteDataRouter.get(`${prefix}/accounts`, run(async (req, res) => {
    const filter: Record<string, unknown> = { companyCode: req.user!.companyCode };
    if (typeof req.query.platform === "string" && ["Facebook", "Zalo", "TikTok"].includes(req.query.platform)) filter.platform = req.query.platform;
    const items = await SocialIntegrationModel.find(filter).select(fields).sort({ displayName: 1 }).lean();
    return res.json({ status: "success", data: items });
  }));
  suiteDataRouter.get(`${prefix}/accounts/:id`, run(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ status: "error", message: "ID không hợp lệ." });
    const item = await SocialIntegrationModel.findOne({ _id: req.params.id, companyCode: req.user!.companyCode }).select(fields).lean();
    return item ? res.json({ status: "success", data: item }) : res.status(404).json({ status: "error", message: "Không tìm thấy tích hợp." });
  }));
}
suiteDataRouter.patch("/omni-inbox/accounts/:id/ai-config", requirePermission("omni-inbox:manage"), run(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ status: "error", message: "ID không hợp lệ." });
  const config = req.body?.aiAutoReplyConfig;
  const allowed = Object.keys(AiAutoReplyConfigSchema.paths).filter((key) => key !== "_id");
  if (!config || typeof config !== "object" || Array.isArray(config)
    || Object.keys(req.body).some((key) => key !== "aiAutoReplyConfig")
    || Object.keys(config).some((key) => !allowed.includes(key))) {
    return res.status(400).json({ status: "error", message: "Cấu hình AI không hợp lệ." });
  }
  const item = await SocialIntegrationModel.findOneAndUpdate({ _id: req.params.id, companyCode: req.user!.companyCode }, { $set: { aiAutoReplyConfig: config } }, { returnDocument: "after", runValidators: true }).select(`${accountFields} aiAutoReplyConfig`).lean();
  return item ? res.json({ status: "success", data: item }) : res.status(404).json({ status: "error", message: "Không tìm thấy tích hợp." });
}));
suiteDataRouter.patch("/omni-inbox/ai-reply-logs/:id", run(async (req, res) => {
  if (!["good", "bad", "needs_fix"].includes(req.body?.feedback)) return res.status(400).json({ status: "error", message: "Phản hồi không hợp lệ." });
  const item = await AIReplyLogModel.findOneAndUpdate({ _id: req.params.id, companyCode: req.user!.companyCode }, { $set: { feedback: req.body.feedback } }, { returnDocument: "after", runValidators: true }).lean();
  return item ? res.json({ status: "success", data: item }) : res.status(404).json({ status: "error", message: "Không tìm thấy nhật ký." });
}));
const SecretReadAudit = mongoose.model("MarketingSecretReadAudit", new Schema({
  companyCode: { type: String, required: true }, userId: { type: String, required: true },
  integrationId: { type: String, required: true }, field: { type: String, required: true },
}, { timestamps: true }), "marketing_secret_read_audits");
suiteDataRouter.post("/social-integrations/:id/reveal-secret", requirePermission("social-integration:manage"), run(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ status: "error", message: "ID không hợp lệ." });
  const item = await SocialIntegrationModel.findOne({ _id: req.params.id, companyCode: req.user!.companyCode }).lean();
  if (!item) return res.status(404).json({ status: "error", message: "Không tìm thấy tích hợp." });
  if (item.platform === "TikTok") return res.status(403).json({ status: "error", message: "Token TikTok chỉ được sử dụng tại máy chủ." });
  await SecretReadAudit.create({ companyCode: req.user!.companyCode, userId: req.user!.id, integrationId: String(item._id), field: "accessToken" });
  res.setHeader("Cache-Control", "no-store");
  return res.json({ status: "success", data: { accessToken: item.accessToken || "" } });
}));
for (const [path, rawModel] of [
  ["/marketing-contents", MarketingContentModel], ["/omni-inbox/leads", CRMTicketModel], ["/social-integrations", SocialIntegrationModel],
] as const) {
  const model = rawModel as unknown as Model<SuiteRecord>;
  const integration = path === "/social-integrations";
  suiteDataRouter.get(path, run(async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1), limit = Math.min(1000, Math.max(1, Number(req.query.limit) || 1000));
    const filter: Record<string, unknown> = { companyCode: req.user!.companyCode };
    for (const key of ["status", "platform", "channel", "campaignId", "campaignSlotId", "integrationId", "username", "createdBy", "authorUid", "isConnected"]) {
      const value = req.query[key];
      if (typeof value === "string" && value.length <= 500) filter[key] = key === "isConnected" ? value === "true" : value;
    }
    if (typeof req.query.search === "string" && req.query.search.trim()) {
      const expression = req.query.search.trim().slice(0, 200).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = (integration ? ["displayName", "username"] : path.includes("leads") ? ["name", "phone"] : ["title", "bodyText"]).map((key) => ({ [key]: { $regex: expression, $options: "i" } }));
    }
    const sort = typeof req.query.sort === "string" && /^-?[a-zA-Z][a-zA-Z0-9]*$/.test(req.query.sort) ? req.query.sort : "-_id";
    const [items, total] = await Promise.all([model.find(filter).sort(sort).skip((page - 1) * limit).limit(limit).lean(), model.countDocuments(filter)]);
    res.json({ status: "success", data: items.map((item) => publicRecord(item, integration)), total, page, limit });
  }));
  suiteDataRouter.get(path + "/:id", run(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ status: "error", message: "ID không hợp lệ." });
    const item = await model.findOne({ _id: req.params.id, companyCode: req.user!.companyCode }).lean();
    return item ? res.json({ status: "success", data: publicRecord(item, integration) }) : res.status(404).json({ status: "error", message: "Không tìm thấy dữ liệu." });
  }));
  suiteDataRouter.post(path, run(async (req, res) => {
    const data = payload(req.body);
    if (path === "/marketing-contents") await assertCampaignContentLinks(req.user!.companyCode!, data);
    if (integration && (typeof data.username !== "string" || !data.username.trim())) return res.status(400).json({ status: "error", message: "Thiếu định danh tài khoản mạng xã hội." });
    if (integration) await assertMarketingAccountOwnership(req.user!.companyCode!, String(data.platform), String(data.username));
    const item = await model.create({ ...data, companyCode: req.user!.companyCode, createdBy: req.user!.id });
    if (path === "/marketing-contents") await syncCampaignContentMedia(item.toObject(), data);
    return res.status(201).json({ status: "success", data: publicRecord(item.toObject(), integration) });
  }));
  suiteDataRouter.patch(path + "/:id", run(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ status: "error", message: "ID không hợp lệ." });
    const data = payload(req.body);
    let campaignContent: SuiteRecord | null = null;
    if (path === "/marketing-contents") {
      const existing = await model.findOne({ _id: req.params.id, companyCode: req.user!.companyCode }).lean();
      if (!existing) return res.status(404).json({ status: "error", message: "Không tìm thấy dữ liệu." });
      if (data.status === "scheduled" && existing.channel === "Facebook" && ["published", "processing", "failed"].includes(String(existing.status))) {
        return res.status(409).json({ status: "error", message: "Kết quả đăng Facebook đã thay đổi. Hãy tải lại bài viết trước khi lên lịch." });
      }
      await assertCampaignContentLinks(req.user!.companyCode!, data, existing);
      campaignContent = existing;
    }
    if (integration) for (const key of secretFields) if (data[key] === "") delete data[key];
    if (integration) {
      const existing = await model.findOne({ _id: req.params.id, companyCode: req.user!.companyCode }).lean();
      if (!existing) return res.status(404).json({ status: "error", message: "Không tìm thấy dữ liệu." });
      await assertMarketingAccountOwnership(req.user!.companyCode!, String(data.platform || existing.platform), String(data.username || existing.username));
      if (existing.platform === "Facebook" && ["platform", "username", "fbAppId", "appSecret", "accessToken"]
        .some(key => key in data && data[key] !== existing[key])) data.facebookUserId = "";
    }
    const persist = async (session?: mongoose.ClientSession) => {
      const protectFacebookResult = data.status === "scheduled" && campaignContent?.channel === "Facebook";
      const saved = await model.findOneAndUpdate({
        _id: req.params.id, companyCode: req.user!.companyCode,
        ...(protectFacebookResult ? { status: { $nin: ["published", "processing", "failed"] } } : {}),
      }, { $set: data }, { returnDocument: "after", runValidators: true, session }).lean();
      if (!saved) throw Object.assign(new Error(protectFacebookResult ? "Kết quả đăng Facebook đã thay đổi. Hãy tải lại bài viết trước khi lên lịch." : "Không tìm thấy dữ liệu."), { statusCode: protectFacebookResult ? 409 : 404 });
    };
    if (campaignContent) await syncCampaignContentMedia({ ...campaignContent, ...data }, data, persist);
    else await persist();
    const item = await model.findOne({ _id: req.params.id, companyCode: req.user!.companyCode }).lean();
    return item ? res.json({ status: "success", data: publicRecord(item, integration) }) : res.status(404).json({ status: "error", message: "Không tìm thấy dữ liệu." });
  }));
  suiteDataRouter.delete(path + "/:id", run(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ status: "error", message: "ID không hợp lệ." });
    if (path === "/marketing-contents") {
      const existing = await model.findOne({ _id: req.params.id, companyCode: req.user!.companyCode }).lean();
      if (!existing) return res.status(404).json({ status: "error", message: "Không tìm thấy dữ liệu." });
      if (existing.campaignSlotId) return res.status(409).json({ status: "error", message: "Bài viết thuộc Campaign. Hãy hủy bài trong Campaign để giữ liên kết và lịch sử xuất bản." });
    }
    const item = await model.findOneAndDelete({ _id: req.params.id, companyCode: req.user!.companyCode, ...(path === "/marketing-contents" ? { campaignSlotId: null } : {}) });
    return item ? res.json({ status: "success", message: "Đã xóa dữ liệu." }) : res.status(404).json({ status: "error", message: "Không tìm thấy dữ liệu." });
  }));
}
