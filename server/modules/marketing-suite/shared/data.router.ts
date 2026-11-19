import { Router, type Request, type Response, type NextFunction } from "express";
import type { Model } from "mongoose";
import mongoose from "mongoose";
import { SocialIntegrationModel } from "./model/social-integration.model";
import { MarketingContentModel } from "../campaign/model/marketing-content.model";
import { CRMTicketModel } from "../message/model/crm-ticket.model";
import { TelecomInvoiceModel } from "../message/model/telecom-invoice.model";
import { FBMessageModel } from "../message/model/fb-messenger.model";
import { ZaloMessageModel } from "../message/model/zalo-messenger.model";
import type { TelecomInvoicePlatform } from "../../../../shared/marketing-suite/telecom-invoice";
import { isTrustedChatImageUrl } from "../message/service/chat-image-context";
import type { AuthenticatedRequest } from "../../../middleware/auth";
import { requirePermission } from "../../../middleware/auth";
import { getCompletedLeadModule } from "../../../../shared/marketing-suite/lead-customer-transfer";
import { Schema } from "mongoose";
import { AIReplyLogModel } from "../message/model/ai-reply-log.model";
import { assertMarketingAccountOwnership } from "./account-ownership";
import { AiAutoReplyConfigSchema, UserModel } from "../../../model/user.model";
import { assertCampaignContentLinks, syncCampaignContentMedia } from "../campaign/service/campaign-uploaded-media.service";
import { createMarketingContentDraft, deleteMarketingContentDraft, updateMarketingContentDraft } from "../campaign/service/marketing-content-draft.service";
import { queueLeadSheet } from "../message/service/lead-sheet.service";
import { PageChatFlowStateModel } from "../message/model/page-chat-flow.model";
import { mapIntakeStandardFields, parseLeadIntakeAmount } from "../message/service/lead-intake.service";
import { leadContractRouter } from "../message/router/lead-contract.router";
import { chatTestRouter } from "../message/router/chat-test.router";
import { resetCompanyChat } from "../message/service/company-chat-reset.service";
import { withLeadZaloIdentities } from "../message/service/lead-zalo-identity.service";
import { requireFacebookWebhookSubscription } from "./service/facebook-webhook-subscription";
import { broadcastEvent } from "./socket";

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

const leadStatusValues = new Set(["cold", "warm", "hot", "won", "upsell"]);
const intakeStatusValues = new Set(["collecting", "complete", "needs_human"]);
const intakeFieldTypes = new Set(["text", "long_text", "number", "currency", "date", "phone", "email", "single_select", "multi_select", "checkbox"]);
function leadAnswers(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw Object.assign(new Error("Thông tin thu thập phải là một đối tượng hợp lệ."), { statusCode: 400 });
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length > 50 || entries.some(([key, answer]) => !/^[a-z][a-z0-9_]{0,39}$/.test(key) || typeof answer !== "string" || answer.length > 3000)) {
    throw Object.assign(new Error("Mỗi Lead được phép có tối đa 50 trường; tên trường và câu trả lời cần hợp lệ."), { statusCode: 400 });
  }
  return Object.fromEntries(entries.map(([key, answer]) => [key, (answer as string).trim()]));
}
function leadFieldSnapshot(value: unknown) {
  if (!Array.isArray(value) || value.length > 30) throw Object.assign(new Error("Danh sách trường Lead không hợp lệ."), { statusCode: 400 });
  return value.map((rawField: unknown) => {
    const field = rawField && typeof rawField === "object" ? (rawField as Record<string, unknown>) : null;
    const fieldType = typeof field?.type === "string" && field.type ? field.type : "text";
    if (!field || typeof field.key !== "string" || !/^[a-z][a-z0-9_]{0,39}$/.test(field.key)
      || typeof field.label !== "string" || field.label.length > 100
      || typeof field.question !== "string" || field.question.length > 300
      || !intakeFieldTypes.has(fieldType)) throw Object.assign(new Error("Một trường Lead không hợp lệ."), { statusCode: 400 });
    return {
      key: field.key, label: field.label, question: field.question, type: fieldType,
      required: field.required !== false, options: Array.isArray(field.options) ? field.options.filter((option: unknown) => typeof option === "string").slice(0, 30) : []
    };
  });
}

export const suiteDataRouter = Router();
suiteDataRouter.use("/omni-inbox", leadContractRouter);
suiteDataRouter.use("/omni-inbox/chat-test", chatTestRouter);
const ALLOWED_LEAD_SORT_KEYS = new Set([
  "customerName",
  "phone",
  "email",
  "company",
  "productOfChoice",
  "value",
  "status",
  "collectionStatus",
  "sourcePlatform",
  "sourceAccountId",
  "createdAt",
  "lastInteractionAt",
  "updatedAt",
]);

const ALLOWED_LEAD_FILTER_KEYS = new Set([
  "customerName",
  "phone",
  "email",
  "company",
  "productOfChoice",
  "value",
  "status",
  "collectionStatus",
  "sourcePlatform",
  "sourceAccountId",
  "notes",
  "createdAt",
  "lastInteractionAt",
  "updatedAt",
]);

const CUSTOM_ANSWER_PATH_RE = /^answers\.[a-z][a-z0-9_]{0,39}$/;

function isAllowedLeadKey(key: string, allowedSystemKeys: Set<string>): boolean {
  return allowedSystemKeys.has(key) || CUSTOM_ANSWER_PATH_RE.test(key);
}

function escapeLeadRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseLeadSort(raw: unknown): string {
  if (typeof raw !== "string") return "-lastInteractionAt";
  const trimmed = raw.trim();
  if (!trimmed) return "-lastInteractionAt";

  let field = "";
  let desc = true;
  const colonMatch = /^([a-zA-Z0-9_.]+):(asc|desc)$/i.exec(trimmed);
  if (colonMatch) {
    field = colonMatch[1];
    desc = colonMatch[2].toLowerCase() === "desc";
  } else {
    const prefixMatch = /^(-?)([a-zA-Z0-9_.]+)$/.exec(trimmed);
    if (!prefixMatch) return "-lastInteractionAt";
    desc = prefixMatch[1] === "-";
    field = prefixMatch[2];
  }

  if (!isAllowedLeadKey(field, ALLOWED_LEAD_SORT_KEYS)) {
    return "-lastInteractionAt";
  }
  return `${desc ? "-" : ""}${field}`;
}

function buildLeadKeyFilterClause(key: string, rawValue: string, mode: string): Record<string, unknown> | null {
  if (key === "value") {
    const groupedNumberMatch = /^-?\d{1,3}(?:[.,\s]\d{3})+$/.test(rawValue);
    const normalized = groupedNumberMatch
      ? rawValue.replace(/[.,\s]/g, "")
      : rawValue.replace(/[^\d.-]/g, "");
    const numeric = Number(normalized);
    return normalized && !Number.isNaN(numeric) ? { value: numeric } : null;
  }

  if ((key === "createdAt" || key === "lastInteractionAt" || key === "updatedAt") && /^\d{4}-\d{2}-\d{2}$/.test(rawValue)) {
    const start = new Date(`${rawValue}T00:00:00.000+07:00`);
    const end = new Date(`${rawValue}T23:59:59.999+07:00`);
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
      return { [key]: { $gte: start, $lte: end } };
    }
  }

  if (mode === "unchecked") {
    return {
      $or: [
        { [key]: { $exists: false } },
        { [key]: { $in: ["", "Không", "không", "false", "0"] } },
      ],
    };
  }

  if (mode === "exact") {
    if (key === "status" || key === "collectionStatus" || key === "sourcePlatform") {
      return { [key]: rawValue };
    }
    return { [key]: { $regex: `^${escapeLeadRegex(rawValue)}$`, $options: "i" } };
  }

  if (CUSTOM_ANSWER_PATH_RE.test(key) && /^\d{4}-\d{2}-\d{2}$/.test(rawValue)) {
    const [yyyy, mm, dd] = rawValue.split("-");
    return {
      [key]: {
        $regex: `(${escapeLeadRegex(rawValue)}|${escapeLeadRegex(`${dd}/${mm}/${yyyy}`)})`,
        $options: "i",
      },
    };
  }

  if (CUSTOM_ANSWER_PATH_RE.test(key) && /^-?\d{1,3}(?:[.,\s]\d{3})+$/.test(rawValue)) {
    const digitsOnly = rawValue.replace(/[.,\s]/g, "");
    return {
      [key]: {
        $regex: `(${escapeLeadRegex(rawValue)}|${escapeLeadRegex(digitsOnly)})`,
        $options: "i",
      },
    };
  }

  return { [key]: { $regex: escapeLeadRegex(rawValue), $options: "i" } };
}

function parseLeadFieldFilters(raw: unknown): Array<Record<string, unknown>> {
  let parsed: unknown = raw;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];

  const clauses: Array<Record<string, unknown>> = [];
  for (const entry of parsed.slice(0, 10)) {
    if (!entry || typeof entry !== "object") continue;
    const item = entry as { key?: unknown; altKeys?: unknown; value?: unknown; mode?: unknown };
    const key = typeof item.key === "string" ? item.key.trim() : "";
    const rawValue = typeof item.value === "string" ? item.value.trim().slice(0, 200) : "";
    const mode = typeof item.mode === "string" ? item.mode : "contains";
    if (!key || !rawValue || !isAllowedLeadKey(key, ALLOWED_LEAD_FILTER_KEYS)) continue;

    const rawAltKeys = Array.isArray(item.altKeys) ? item.altKeys : [];
    const safeKeys = [
      key,
      ...rawAltKeys
        .filter((k): k is string => typeof k === "string")
        .map(k => k.trim())
        .filter(k => k && k !== key && isAllowedLeadKey(k, ALLOWED_LEAD_FILTER_KEYS)),
    ].slice(0, 5);

    const perKeyClauses = safeKeys
      .map(targetKey => buildLeadKeyFilterClause(targetKey, rawValue, mode))
      .filter((clause): clause is Record<string, unknown> => clause !== null);

    if (perKeyClauses.length === 1) {
      clauses.push(perKeyClauses[0]);
    } else if (perKeyClauses.length > 1) {
      clauses.push({
        $or: perKeyClauses.flatMap(clause => (Array.isArray(clause.$or) ? (clause.$or as Array<Record<string, unknown>>) : [clause])),
      });
    }
  }
  return clauses;
}

suiteDataRouter.get("/omni-inbox/leads", run(async (req, res) => {
  const page = Math.max(1, Math.floor(Number(req.query.page) || 1));
  const limit = Math.min(1000, Math.max(1, Math.floor(Number(req.query.limit) || 1000)));
  const filter: Record<string, unknown> = { companyCode: req.user!.companyCode };
  if (typeof req.query.status === "string" && leadStatusValues.has(req.query.status)) filter.status = req.query.status;
  if (typeof req.query.sourcePlatform === "string" && ["facebook", "zalo", "tiktok"].includes(req.query.sourcePlatform)) filter.sourcePlatform = req.query.sourcePlatform;
  if (typeof req.query.sourceAccountId === "string" && req.query.sourceAccountId.trim()) filter.sourceAccountId = req.query.sourceAccountId.trim().slice(0, 200);
  if (typeof req.query.collectionStatus === "string" && intakeStatusValues.has(req.query.collectionStatus)) filter.collectionStatus = req.query.collectionStatus;
  if (typeof req.query.intakeProfileId === "string" && mongoose.isValidObjectId(req.query.intakeProfileId)) filter.intakeProfileId = req.query.intakeProfileId;
  const andClauses: Array<Record<string, unknown>> = [];
  if (typeof req.query.search === "string" && req.query.search.trim()) {
    const expression = escapeLeadRegex(req.query.search.trim().slice(0, 100));
    andClauses.push({
      $or: ["customerName", "phone", "email", "company", "productOfChoice", "sourceAccountId", "intakeSearchText", "telecomSubscriberCode"]
        .map(key => ({ [key]: { $regex: expression, $options: "i" } })),
    });
  }
  const fieldFilterClauses = parseLeadFieldFilters(req.query.fieldFilters);
  if (fieldFilterClauses.length > 0) {
    andClauses.push(...fieldFilterClauses);
  }
  if (andClauses.length === 1 && !("$or" in andClauses[0])) {
    Object.assign(filter, andClauses[0]);
  } else if (andClauses.length === 1 && "$or" in andClauses[0]) {
    filter.$or = andClauses[0].$or;
  } else if (andClauses.length > 1) {
    filter.$and = andClauses;
  }
  const sortKey = parseLeadSort(req.query.sort);
  const [items, total] = await Promise.all([
    CRMTicketModel.find(filter).sort(`${sortKey} -_id`).skip((page - 1) * limit).limit(limit).lean(),
    CRMTicketModel.countDocuments(filter),
  ]);
  const rows = req.query.includeZaloUid === "true" ? await withLeadZaloIdentities(req.user!.companyCode!, items) : items;
  return res.json({ status: "success", data: rows.map(item => publicRecord(item, false)), total, page, limit, totalPages: Math.ceil(total / limit) });
}));

suiteDataRouter.get("/omni-inbox/leads/by-conversation", requirePermission(["omni-inbox:read", "omni-inbox:manage"]), run(async (req, res) => {
  const { channel, accountId, conversationId } = req.query;
  if ((channel !== "facebook" && channel !== "zalo" && channel !== "tiktok") || typeof accountId !== "string" || typeof conversationId !== "string"
    || !accountId.trim() || !conversationId.trim() || accountId.length > 200 || conversationId.length > 200) {
    return res.status(400).json({ status: "error", message: "Hội thoại hoặc tài khoản không hợp lệ." });
  }
  const platform = channel === "facebook" ? "Facebook" : channel === "zalo" ? "Zalo" : "TikTok";
  const companyCode = req.user!.companyCode;
  await assertMarketingAccountOwnership(companyCode, platform, accountId.trim());
  const lead = await CRMTicketModel.findOne({
    companyCode, sourcePlatform: channel, sourceAccountId: accountId.trim(), sourceConversationId: conversationId.trim(),
  }).select("collectionStatus moduleSync.targetModule customerTransfer.completedAt customerTransfer.destination").lean();
  return res.json({ status: "success", data: lead });
}));

suiteDataRouter.get("/omni-inbox/leads/:id/telecom-invoices", requirePermission(["omni-inbox:read", "omni-inbox:manage"]), run(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ status: "error", message: "ID Lead không hợp lệ." });
  const companyCode = req.user!.companyCode;
  const lead = await CRMTicketModel.findOne({ companyCode, _id: req.params.id }).select("telecomSubscriberCode").lean();
  if (!lead) return res.status(404).json({ status: "error", message: "Không tìm thấy Lead." });
  const cursor = typeof req.query.before === "string" && mongoose.isValidObjectId(req.query.before) ? req.query.before : undefined;
  const limit = 20;
  const invoices = lead.telecomSubscriberCode ? await TelecomInvoiceModel.find({ companyCode, subscriberCode: lead.telecomSubscriberCode, status: "confirmed",
    ...(cursor ? { _id: { $lt: cursor } } : {}),
  }).sort({ _id: -1 }).limit(limit + 1).select("values leadFields subscriberFieldKey invoiceKey platform pageId conversationId confirmedAt sourceMessageId sourceIndex").lean() : [];
  const items = invoices.slice(0, limit);
  const sourcesFor = (platform: TelecomInvoicePlatform) => items
    .filter(item => (item.platform ?? "facebook") === platform && mongoose.isValidObjectId(item.conversationId))
    .map(({ sourceMessageId, conversationId, pageId }) => ({ messageId: sourceMessageId, conversationId, recipientId: pageId }));
  const facebookSources = sourcesFor("facebook");
  const zaloSources = sourcesFor("zalo");
  const sourceFields = "messageId conversationId recipientId attachments";
  const [facebookMessages, zaloMessages] = await Promise.all([
    facebookSources.length ? FBMessageModel.find({ direction: "inbound", $or: facebookSources }).select(sourceFields).lean() : [],
    zaloSources.length ? ZaloMessageModel.find({ direction: "inbound", $or: zaloSources }).select(sourceFields).lean() : [],
  ]);
  const originals = new Map([
    ...facebookMessages.map(message => [`facebook:${message.conversationId}:${message.recipientId}:${message.messageId}`, message.attachments] as const),
    ...zaloMessages.map(message => [`zalo:${message.conversationId}:${message.recipientId}:${message.messageId}`, message.attachments] as const),
  ]);
  res.setHeader("Cache-Control", "no-store");
  return res.json({ status: "success", data: {
    items: items.map(({ _id, values, leadFields, subscriberFieldKey, invoiceKey, platform = "facebook", pageId, conversationId, confirmedAt, sourceMessageId, sourceIndex }) => {
      const attachment = originals.get(`${platform}:${conversationId}:${pageId}:${sourceMessageId}`)?.[sourceIndex];
      const imageUrl = (attachment?.type === "image" || attachment?.type?.startsWith("image/")) && attachment.url && isTrustedChatImageUrl(attachment.url) ? attachment.url : undefined;
      return { id: String(_id), values, leadFields, subscriberFieldKey, invoiceNumber: invoiceKey ?? values.invoiceNumber, platform, pageId, conversationId, confirmedAt, imageUrl };
    }),
    ...(invoices.length > limit ? { before: String(items[limit - 1]._id) } : {}),
  } });
}));

suiteDataRouter.get("/omni-inbox/leads/:id", requirePermission(["omni-inbox:read", "omni-inbox:manage"]), run(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ status: "error", message: "ID Lead không hợp lệ." });
  const lead = await CRMTicketModel.findOne({ companyCode: req.user!.companyCode, _id: req.params.id }).lean();
  if (!lead) return res.status(404).json({ status: "error", message: "Không tìm thấy Lead." });
  return res.json({ status: "success", data: publicRecord(lead, false) });
}));

suiteDataRouter.post("/omni-inbox/leads/export-google-sheets", requirePermission("omni-inbox:manage"), run(async (req, res) => {
  const data = payload(req.body);
  const rawIds = data.ids;
  if (!Array.isArray(rawIds) || rawIds.length < 1 || rawIds.length > 100
    || rawIds.some(id => typeof id !== "string" || !mongoose.isValidObjectId(id))) {
    return res.status(400).json({ status: "error", message: "Chọn từ 1 đến 100 Lead hợp lệ để xuất." });
  }
  const ids = [...new Set(rawIds as string[])];
  const leads = await CRMTicketModel.find({ _id: { $in: ids }, companyCode: req.user!.companyCode })
    .select("_id sourcePlatform sourceAccountId").lean();
  let queued = 0;
  for (const lead of leads) {
    if (typeof lead.sourcePlatform !== "string" || !["facebook", "zalo", "tiktok"].includes(lead.sourcePlatform) || !lead.sourceAccountId) continue;
    const didQueue = await queueLeadSheet(req.user!.companyCode, lead.sourcePlatform as "facebook" | "zalo" | "tiktok", lead.sourceAccountId, String(lead._id));
    if (didQueue) queued++;
  }
  return res.json({ status: "success", data: { queued, skipped: ids.length - queued } });
}));

suiteDataRouter.post("/omni-inbox/leads/bulk", requirePermission("omni-inbox:manage"), run(async (req, res) => {
  const data = payload(req.body);
  const rawIds = data.ids;
  if (!Array.isArray(rawIds) || rawIds.length < 1 || rawIds.length > 100
    || rawIds.some(id => typeof id !== "string" || !mongoose.isValidObjectId(id))) {
    return res.status(400).json({ status: "error", message: "Chọn từ 1 đến 100 Lead hợp lệ." });
  }

  const ids = [...new Set((rawIds as string[]).map(id => id.toLowerCase()))];
  const companyCode = req.user!.companyCode;
  const scope = { companyCode, _id: { $in: ids } };
  let affected = 0;
  if (data.action === "delete") {
    affected = (await CRMTicketModel.deleteMany(scope)).deletedCount;
  } else if (data.action === "update") {
    const { status, collectionStatus } = data;
    if ((status === undefined && collectionStatus === undefined)
      || (status !== undefined && (typeof status !== "string" || !leadStatusValues.has(status)))
      || (collectionStatus !== undefined && (typeof collectionStatus !== "string" || !intakeStatusValues.has(collectionStatus)))) {
      return res.status(400).json({ status: "error", message: "Chọn trạng thái Lead hoặc tình trạng Bot hợp lệ." });
    }
    const fields = {
      ...(typeof status === "string" ? { status } : {}),
      ...(typeof collectionStatus === "string" ? { collectionStatus } : {}),
    };
    const shouldChange = Object.entries(fields).map(([key, value]) => ({ [key]: { $ne: value } }));
    affected = (await CRMTicketModel.updateMany({ ...scope, $or: shouldChange }, {
      $set: { ...fields, lastInteractionAt: new Date() },
      $inc: { intakeRevision: 1 },
    }, { runValidators: true })).modifiedCount;
  } else {
    return res.status(400).json({ status: "error", message: "Thao tác hàng loạt không hợp lệ." });
  }

  if (affected) broadcastEvent("crm_leads_changed", { companyCode });
  return res.json({ status: "success", data: { affected, skipped: ids.length - affected } });
}));

suiteDataRouter.post("/omni-inbox/leads", run(async (req, res) => {
  const data = payload(req.body);
  const customerName = typeof data.customerName === "string" ? data.customerName.trim().slice(0, 200) : "";
  if (!customerName) return res.status(400).json({ status: "error", message: "Cần nhập tên khách hàng cho Lead." });
  const status = typeof data.status === "string" && leadStatusValues.has(data.status) ? data.status : "cold";
  const input: Record<string, unknown> = {
    customerName, companyCode: req.user!.companyCode, createdBy: req.user!.id, status,
    company: typeof data.company === "string" ? data.company.slice(0, 200) : "",
    phone: typeof data.phone === "string" ? data.phone.slice(0, 40) : "",
    email: typeof data.email === "string" ? data.email.slice(0, 254) : "",
    avatar: typeof data.avatar === "string" ? data.avatar.slice(0, 20) : "",
    productOfChoice: typeof data.productOfChoice === "string" ? data.productOfChoice.slice(0, 200) : "",
    value: typeof data.value === "number" && Number.isFinite(data.value) && data.value >= 0 ? data.value : 0,
    lastInteraction: typeof data.lastInteraction === "string" ? data.lastInteraction.slice(0, 200) : "Mới tiếp nhận",
    answers: data.answers === undefined ? {} : leadAnswers(data.answers),
  };
  input.intakeSearchText = Object.values(input.answers as Record<string, string>).join(" ").slice(0, 100000);
  if (data.intakeFields !== undefined) {
    const fields = leadFieldSnapshot(data.intakeFields);
    input.intakeFields = fields;
    const standard = mapIntakeStandardFields(fields, input.answers as Record<string, string>);
    if (!input.phone && standard.phone) input.phone = standard.phone.slice(0, 40);
    if (!input.email && standard.email) input.email = standard.email.slice(0, 254);
    if (!input.company && standard.company) input.company = standard.company.slice(0, 200);
    if (!input.productOfChoice && standard.productOfChoice) input.productOfChoice = standard.productOfChoice.slice(0, 200);
    if (data.value === undefined && standard.value) {
      const amount = parseLeadIntakeAmount(standard.value);
      if (amount !== undefined) input.value = amount;
    }
  }
  if (data.collectionStatus !== undefined) {
    if (typeof data.collectionStatus !== "string" || !intakeStatusValues.has(data.collectionStatus)) return res.status(400).json({ status: "error", message: "Trạng thái thu thập Lead không hợp lệ." });
    input.collectionStatus = data.collectionStatus;
  }
  const sourcePlatform = data.sourcePlatform;
  if (sourcePlatform !== undefined || data.sourceAccountId !== undefined || data.sourceConversationId !== undefined) {
    if (typeof sourcePlatform !== "string" || !["facebook", "zalo", "tiktok"].includes(sourcePlatform)
      || typeof data.sourceAccountId !== "string" || !data.sourceAccountId.trim()
      || (data.sourceConversationId !== undefined
        && (typeof data.sourceConversationId !== "string" || !data.sourceConversationId.trim()))) {
      return res.status(400).json({ status: "error", message: "Thông tin nguồn hội thoại của Lead không hợp lệ." });
    }
    const platformName = sourcePlatform === "facebook" ? "Facebook" : sourcePlatform === "zalo" ? "Zalo" : "TikTok";
    const personalQuery = sourcePlatform === "facebook"
      ? { _id: req.user!.id, companyCode: req.user!.companyCode, "facebookIntegration.isConnected": true, "facebookIntegration.pageId": data.sourceAccountId }
      : sourcePlatform === "zalo"
        ? { _id: req.user!.id, companyCode: req.user!.companyCode, "zaloIntegration.isConnected": true, "zaloIntegration.oaId": data.sourceAccountId }
        : { _id: req.user!.id, companyCode: req.user!.companyCode, "tiktokIntegration.isConnected": true, "tiktokIntegration.username": data.sourceAccountId };
    const [ownedCompanyAccount, ownedPersonalAccount] = await Promise.all([
      SocialIntegrationModel.exists({ companyCode: req.user!.companyCode, platform: platformName, username: data.sourceAccountId, isConnected: true }),
      UserModel.exists(personalQuery),
    ]);
    if (!ownedCompanyAccount && !ownedPersonalAccount) return res.status(404).json({ status: "error", message: "Không tìm thấy tài khoản nguồn của Lead." });
    input.sourcePlatform = sourcePlatform;
    input.sourceAccountId = data.sourceAccountId;
    if (typeof data.sourceConversationId === "string") input.sourceConversationId = data.sourceConversationId.trim();
    input.lastInteractionAt = new Date();
  } else {
    input.lastInteractionAt = new Date();
  }
  try {
    const item = await CRMTicketModel.create(input);
    broadcastEvent("crm_leads_changed", { companyCode: req.user!.companyCode });
    return res.status(201).json({ status: "success", data: publicRecord(item.toObject(), false) });
  } catch (error) {
    if (!input.sourceConversationId || (error as { code?: number }).code !== 11000) throw error;
    return res.status(409).json({
      status: "error", message: "Hội thoại đã có Lead. Mở dòng đó trong bảng Lead để cập nhật thông tin.",
    });
  }
}));

suiteDataRouter.patch("/omni-inbox/leads/:id", run(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ status: "error", message: "ID không hợp lệ." });
  const data = payload(req.body);
  const updates: Record<string, unknown> = {};
  for (const key of ["customerName", "company", "phone", "email", "avatar", "productOfChoice", "lastInteraction"] as const) {
    if (typeof data[key] === "string") updates[key] = data[key].slice(0, key === "email" ? 254 : 300);
  }
  if (typeof data.value === "number" && Number.isFinite(data.value) && data.value >= 0) updates.value = data.value;
  if (typeof data.status === "string") {
    if (!leadStatusValues.has(data.status)) return res.status(400).json({ status: "error", message: "Trạng thái Lead không hợp lệ." });
    updates.status = data.status;
  }
  if (data.collectionStatus !== undefined) {
    if (typeof data.collectionStatus !== "string" || !intakeStatusValues.has(data.collectionStatus)) {
      return res.status(400).json({ status: "error", message: "Trạng thái thu thập Lead không hợp lệ." });
    }
    updates.collectionStatus = data.collectionStatus;
  }
  const nextAnswers = data.answers !== undefined ? leadAnswers(data.answers) : undefined;
  if (nextAnswers !== undefined) {
    updates.answers = nextAnswers;
    updates.intakeSearchText = Object.values(nextAnswers).filter(Boolean).join(" ").slice(0, 100000);
  }
  if (!Object.keys(updates).length) return res.status(400).json({ status: "error", message: "Không có trường Lead hợp lệ để cập nhật." });

  const scope = { _id: req.params.id, companyCode: req.user!.companyCode };
  const staffFields = Object.keys(updates).filter(key => ["customerName", "company", "phone", "email", "productOfChoice", "value"].includes(key));
  const existing = nextAnswers !== undefined
    ? await CRMTicketModel.findOne(scope).select("answers needs intakeRevision intakeFields sourcePlatform sourceAccountId sourceConversationId collectionStatus").lean()
    : null;
  if (nextAnswers !== undefined && !existing) return res.status(404).json({ status: "error", message: "Không tìm thấy Lead." });

  const staffAnswerChanges: Record<string, string | undefined> = {};
  if (existing && nextAnswers !== undefined) {
    for (const key of new Set([...Object.keys(existing.answers || {}), ...Object.keys(nextAnswers)])) {
      if (existing.answers?.[key] === nextAnswers[key]) continue;
      staffFields.push(`answers.${key}`);
      staffAnswerChanges[key] = nextAnswers[key];
    }
    updates.intakeSearchText = [...Object.values(nextAnswers), ...(existing.needs || []).flatMap(need => [need.title, need.groupLabel, ...Object.values(need.answers || {})])].filter(Boolean).join(" ").slice(0, 100000);
    const fields = existing.intakeFields || [];
    if (fields.length > 0) {
      const standard = mapIntakeStandardFields(fields, nextAnswers);
      if (standard.name && !("customerName" in updates)) updates.customerName = standard.name.slice(0, 200);
      if (standard.phone && !("phone" in updates)) updates.phone = standard.phone.slice(0, 40);
      if (standard.email && !("email" in updates)) updates.email = standard.email.slice(0, 254);
      if (standard.company && !("company" in updates)) updates.company = standard.company.slice(0, 200);
      if (standard.productOfChoice && !("productOfChoice" in updates)) updates.productOfChoice = standard.productOfChoice.slice(0, 200);
      if (standard.value && !("value" in updates)) {
        const amount = parseLeadIntakeAmount(standard.value);
        if (amount !== undefined) updates.value = amount;
      }
      if (!("collectionStatus" in updates)) {
        const isComplete = fields.every(field => field.required === false || Boolean(nextAnswers[field.key]?.trim()));
        if (isComplete) updates.collectionStatus = "complete";
        else if (existing.collectionStatus === "complete" || existing.collectionStatus === "collecting") updates.collectionStatus = "collecting";
      }
    }
  }
  updates.lastInteractionAt = new Date();

  const updateScope = existing ? { ...scope, intakeRevision: existing.intakeRevision ?? { $exists: false } } : scope;
  const item = await CRMTicketModel.findOneAndUpdate(updateScope, {
    $set: updates,
    $inc: { intakeRevision: 1 },
    ...(staffFields.length ? { $addToSet: { intakeStaffFields: { $each: staffFields } } } : {}),
  }, { new: true, runValidators: true }).lean();
  if (!item && existing) return res.status(409).json({ status: "error", message: "Lead vừa được cập nhật. Tải lại bảng trước khi sửa." });
  if (!item) return res.status(404).json({ status: "error", message: "Không tìm thấy Lead." });

  if (existing && nextAnswers !== undefined && existing.sourcePlatform && existing.sourceAccountId && existing.sourceConversationId) {
    const stateFilter = {
      companyCode: req.user!.companyCode,
      pageId: existing.sourceAccountId,
      conversationId: existing.sourceConversationId,
      ...(existing.sourcePlatform === "facebook" ? {} : { platform: existing.sourcePlatform }),
    };
    const valuesToSet: Record<string, unknown> = {};
    const valuesToUnset: Record<string, 1> = {};
    for (const [key, value] of Object.entries(staffAnswerChanges)) {
      if (!/^[a-z][a-z0-9_]{0,39}$/.test(key)) continue;
      if (value) valuesToSet[`values.${key}`] = value;
      else valuesToUnset[`values.${key}`] = 1;
    }
    if (updates.collectionStatus === "complete") valuesToSet.completedAt = new Date();
    else if (updates.collectionStatus === "collecting") valuesToSet.completedAt = null;
    if (Object.keys(valuesToSet).length || Object.keys(valuesToUnset).length) {
      await PageChatFlowStateModel.updateOne(stateFilter, {
        ...(Object.keys(valuesToSet).length ? { $set: valuesToSet } : {}),
        ...(Object.keys(valuesToUnset).length ? { $unset: valuesToUnset } : {}),
      });
    }
  }

  broadcastEvent("crm_leads_changed", { companyCode: req.user!.companyCode });
  return res.json({ status: "success", data: publicRecord(item, false) });
}));

suiteDataRouter.post("/omni-inbox/leads/:id/module-sync", requirePermission("omni-inbox:manage"), run(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ status: "error", message: "ID Lead không hợp lệ." });
  const data = payload(req.body);
  const targets = new Set(["students", "healthcare", "workers"]);
  const targetModule = data.targetModule;
  const targetRecordId = typeof data.targetRecordId === "string" ? data.targetRecordId.trim() : "";
  if (typeof targetModule !== "string" || !targets.has(targetModule) || !targetRecordId || targetRecordId.length > 100) {
    return res.status(400).json({ status: "error", message: "Thông tin module đích không hợp lệ." });
  }
  const scope = { _id: req.params.id, companyCode: req.user!.companyCode };
  const existing = await CRMTicketModel.findOne(scope).select("moduleSync customerTransfer").lean();
  if (!existing) return res.status(404).json({ status: "error", message: "Không tìm thấy Lead." });
  if (existing.moduleSync) {
    const isSameRecord = existing.moduleSync.targetModule === targetModule && existing.moduleSync.targetRecordId === targetRecordId;
    if (isSameRecord) return res.json({ status: "success", data: existing.moduleSync, alreadyLinked: true });
    return res.status(409).json({ status: "error", message: "Lead này đã được đồng bộ vào module khác hoặc hồ sơ khác." });
  }
  if (getCompletedLeadModule(existing.customerTransfer)) {
    return res.status(409).json({ status: "error", message: "Lead này đã có hồ sơ nghiệp vụ được đồng bộ trước đó." });
  }
  const moduleSync = { targetModule, targetRecordId, syncedAt: new Date(), syncedBy: req.user!.id };
  const item = await CRMTicketModel.findOneAndUpdate({ ...scope, moduleSync: { $exists: false } }, { $set: { moduleSync } }, { new: true }).lean();
  if (!item) return res.status(409).json({ status: "error", message: "Lead vừa được đồng bộ bởi người khác. Tải lại để kiểm tra." });
  broadcastEvent("crm_leads_changed", { companyCode: req.user!.companyCode });
  return res.json({ status: "success", data: item.moduleSync });
}));

suiteDataRouter.delete("/omni-inbox/leads/:id", run(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ status: "error", message: "ID không hợp lệ." });
  const item = await CRMTicketModel.findOneAndDelete({ _id: req.params.id, companyCode: req.user!.companyCode });
  if (item) broadcastEvent("crm_leads_changed", { companyCode: req.user!.companyCode });
  return item ? res.json({ status: "success", message: "Đã xóa Lead." }) : res.status(404).json({ status: "error", message: "Không tìm thấy Lead." });
}));

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
  if (!config || typeof config !== "object" || Array.isArray(config) || Object.keys(config).length === 0
    || Object.keys(req.body).some((key) => key !== "aiAutoReplyConfig")
    || Object.keys(config).some((key) => !allowed.includes(key))) {
    return res.status(400).json({ status: "error", message: "Cấu hình AI không hợp lệ." });
  }
  const updates = Object.fromEntries(Object.entries(config).map(([key, value]) => [`aiAutoReplyConfig.${key}`, value]));
  const item = await SocialIntegrationModel.findOneAndUpdate({ _id: req.params.id, companyCode: req.user!.companyCode }, { $set: updates }, { returnDocument: "after", runValidators: true }).select(`${accountFields} aiAutoReplyConfig`).lean();
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
suiteDataRouter.post("/social-integrations/reset-chat", requirePermission("social-integration:manage"), requirePermission("omni-inbox:manage"), run(async (req, res) => {
  const companyCode = req.user?.companyCode;
  if (!companyCode) return res.status(403).json({ status: "error", message: "Không xác định được doanh nghiệp." });
  if (req.body?.confirmCompanyCode !== companyCode) {
    return res.status(400).json({ status: "error", message: "Doanh nghiệp đang chọn đã thay đổi. Hãy mở lại hộp thoại xác nhận." });
  }
  const data = await resetCompanyChat(companyCode);
  broadcastEvent("company_chat_reset", { companyCode });
  return res.json({ status: "success", data });
}));

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
  ["/marketing-contents", MarketingContentModel], ["/social-integrations", SocialIntegrationModel],
] as const) {
  const model = rawModel as unknown as Model<SuiteRecord>;
  const integration = path === "/social-integrations";
  suiteDataRouter.get(path, ...(path === "/marketing-contents" ? [requirePermission("marketing:read")] : []), run(async (req, res) => {
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
  suiteDataRouter.get(path + "/:id", ...(path === "/marketing-contents" ? [requirePermission("marketing:read")] : []), run(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ status: "error", message: "ID không hợp lệ." });
    const item = await model.findOne({ _id: req.params.id, companyCode: req.user!.companyCode }).lean();
    return item ? res.json({ status: "success", data: publicRecord(item, integration) }) : res.status(404).json({ status: "error", message: "Không tìm thấy dữ liệu." });
  }));
  suiteDataRouter.post(path, run(async (req, res) => {
    const data = payload(req.body);
    if (path === "/marketing-contents") await assertCampaignContentLinks(req.user!.companyCode!, data);
    if (integration && (typeof data.username !== "string" || !data.username.trim())) return res.status(400).json({ status: "error", message: "Thiếu định danh tài khoản mạng xã hội." });
    if (integration) await assertMarketingAccountOwnership(req.user!.companyCode!, String(data.platform), String(data.username));
    if (integration && data.platform === "Facebook" && data.isConnected !== false) {
      await requireFacebookWebhookSubscription(data.username, data.accessToken);
    }
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
      const platform = data.platform || existing.platform;
      const username = "username" in data ? data.username : existing.username;
      await assertMarketingAccountOwnership(req.user!.companyCode!, String(platform), String(data.username || existing.username));
      const credentialsChanged = ["platform", "username", "fbAppId", "appSecret", "accessToken"]
        .some(key => key in data && data[key] !== existing[key]);
      if (existing.platform === "Facebook" && credentialsChanged) data.facebookUserId = "";
      const isConnected = "isConnected" in data ? data.isConnected : existing.isConnected;
      if (platform === "Facebook" && isConnected !== false && (existing.isConnected !== true || credentialsChanged)) {
        await requireFacebookWebhookSubscription(username, "accessToken" in data ? data.accessToken : existing.accessToken);
      }
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

suiteDataRouter.post("/marketing-contents/assistant/drafts", requirePermission("marketing:manage"), run(async (req, res) => {
  const data = await createMarketingContentDraft(req.user!.companyCode!, req.user!.id, req.body);
  return res.status(201).json({ status: "success", data });
}));
suiteDataRouter.patch("/marketing-contents/assistant/drafts/:id", requirePermission("marketing:manage"), run(async (req, res) => {
  const data = await updateMarketingContentDraft(req.user!.companyCode!, req.params.id, req.body);
  return res.json({ status: "success", data });
}));
suiteDataRouter.delete("/marketing-contents/assistant/drafts/:id", requirePermission("marketing:manage"), run(async (req, res) => {
  const data = await deleteMarketingContentDraft(req.user!.companyCode!, req.params.id);
  return res.json({ status: "success", data });
}));
