import { timingSafeEqual } from "node:crypto";
import type { NextFunction, Response, RequestHandler } from "express";
import { requireAuth, requirePermission } from "../../../middleware/auth";
import type { AuthenticatedRequest } from "../../../middleware/auth";
import { getModuleStateForCompany } from "../../../middleware/require-module";
import type { ModuleKey } from "../../../config/module-keys";
import { SocialIntegrationModel } from "./model/social-integration.model";
import { UserModel } from "../../../model/user.model";
import { assertMarketingAccountOwnership } from "./account-ownership";

const PREFIXES = ["/marketing-campaigns", "/marketing-contents", "/omni-inbox", "/social-integrations", "/company-knowledge", "/company-telegram-order", "/company-sepay", "/company-cake-catalog", "/company-product-catalog", "/order-sheets", "/gemini", "/facebook", "/zalo", "/tiktok", "/tiktok-business", "/scheduler", "/video-caption-projects", "/bulk-create", "/canva", "/webhooks", "/marketing-media", "/marketing-wallet", "/marketing-settings"];
export function isMarketingSuitePath(path: string) {
  if (path === "/webhooks" || path.startsWith("/webhooks/")) return /^\/webhooks\/(?:tiktok|sepay\/[^/]+)\/?$/.test(path);
  if (["/elevenlabs"].some((prefix) => path === prefix || path.startsWith(prefix + "/"))) return true;
  return PREFIXES.some((prefix) => path === prefix || path.startsWith(prefix + "/"));
}
export async function companyModuleEnabled(companyCode: string, key: ModuleKey) {
  const state = await getModuleStateForCompany(companyCode);
  return state.exists && Boolean(state.modules?.includes(key));
}
function secretMatches(expected: string | undefined, actual: unknown) {
  if (!expected || typeof actual !== "string") return false;
  const a = Buffer.from(expected), b = Buffer.from(actual);
  return a.length === b.length && timingSafeEqual(a, b);
}
export const suiteAccess: RequestHandler = (request, response, next) => {
  const req = request as AuthenticatedRequest;
  if (!isMarketingSuitePath(req.path)) return next("router");
  if (req.method === "GET" && req.path === "/canva/callback") return next();
  // Whitelisted CDN streams are embedded by browsers and fetched by TikTok without a session.
  if (req.method === "GET" && ["/marketing-media/audio-proxy", "/marketing-media/video-proxy"].includes(req.path)) return next();
  if (req.path.startsWith("/marketing-campaigns/internal/")) {
    return secretMatches(process.env.CAMPAIGN_WORKER_SECRET, req.headers["x-worker-secret"] || req.headers["x-webhook-token"] || req.headers.authorization?.replace(/^Bearer /, ""))
      ? next() : response.status(401).json({ status: "error", message: "Invalid worker secret." });
  }
  if (req.path.startsWith("/marketing-campaigns/public/")) return next();
  const providerCallback = /^\/(facebook\/(?:webhook|oauth-callback|data-deletion-callback|data-deletion-status\/[^/]+)|zalo\/webhook|tiktok\/messenger\/webhook|tiktok(?:-business)?\/(?:webhook|oauth\/callback)|webhooks\/(?:tiktok|sepay\/[^/]+))\/?$/.test(req.path);
  if (providerCallback) return next();
  if (req.path === "/scheduler/check-and-publish" || req.path === "/facebook/n8n-callback") {
    return secretMatches(process.env.N8N_WEBHOOK_SECRET, req.headers["x-webhook-token"])
      ? next() : response.status(401).json({ status: "error", message: "Invalid scheduler secret." });
  }
  return requireAuth(req, response, (error?: unknown) => {
    if (error) return next(error);
    void authorizeSuiteRequest(req, response, next).catch(next);
  });
};

async function authorizeSuiteRequest(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const companyCode = req.user?.companyCode?.trim().toUpperCase();
  if (!companyCode) return res.status(403).json({ status: "error", message: "Không xác định được doanh nghiệp." });
  const path = req.path;
  const personalAiSettings = /^\/marketing-settings\/auto-reply\/?$/.test(path);
  const campaignSettings = /^\/marketing-settings\/authors\/[^/]+\/?$/.test(path);
  const integrations = !personalAiSettings && !campaignSettings && /social-integrations|company-(?:telegram|sepay|cake|product)|marketing-settings|validate-token|validate-integration|save-integration|order-sheets|oauth|facebook\/config/.test(path);
  const knowledge = path.startsWith("/company-knowledge") || /^\/gemini\/(?:knowledge-health|clear-knowledge|customer-service-scenario|sync-drive|upload-document)/.test(path);
  const inbox = personalAiSettings || /^\/(?:omni-inbox|zalo|tiktok\/messenger)/.test(path) || /^\/facebook\/(?:messenger|debug-ai-logs|comments)/.test(path) || /^\/gemini\/(?:chat|chat-comment|follow-up|test-reply|ai-reply-logs|extract-scenario)/.test(path);
  const module: ModuleKey = knowledge ? "company-knowledge" : inbox ? "omni-inbox" : "social-marketing";
  const enabled = integrations
    ? await companyModuleEnabled(companyCode, "social-marketing") || await companyModuleEnabled(companyCode, "omni-inbox")
    : await companyModuleEnabled(companyCode, module);
  if (!enabled) return res.status(403).json({ status: "error", message: "Phân hệ chưa được kích hoạt cho doanh nghiệp của bạn." });
  if (req.body && typeof req.body === "object" && !Array.isArray(req.body)) {
    if ("companyCode" in req.body) req.body.companyCode = companyCode;
  }
  if ("companyCode" in req.query) req.query.companyCode = companyCode;
  if (req.headers["x-company-code"]) req.headers["x-company-code"] = companyCode;
  const integrationId = req.body?.integrationId || req.query.integrationId;
  if (integrationId && (typeof integrationId !== "string" || !/^[a-fA-F0-9]{24}$/.test(integrationId))) {
    return res.status(400).json({ status: "error", message: "ID tích hợp không hợp lệ." });
  }
  if (typeof integrationId === "string" && integrationId && !integrations) {
    const owned = await SocialIntegrationModel.exists({ _id: integrationId, companyCode });
    if (!owned) return res.status(403).json({ status: "error", message: "Bạn không có quyền truy cập tích hợp này." });
  }
  const identities = [
    ["Facebook", req.query.pageId || req.body?.pageId],
    ["Zalo", req.query.oaId || req.body?.oaId],
    ["TikTok", req.query.businessAccountId || req.body?.businessAccountId],
  ];
  if (req.path === "/scheduler/schedule-post" && req.body?.channel === "TikTok") {
    const { MarketingContentModel } = await import("../campaign/model/marketing-content.model");
    const card = await MarketingContentModel.findOne({ _id: req.body.cardId, companyCode, channel: "TikTok" }).lean();
    if (!card?.videoUrl || card.videoUrl !== req.body.videoUrl) return res.status(400).json({ status: "error", message: "Cần video hoàn tất của bài đăng trước khi lên lịch TikTok." });
    const account = integrationId ? await SocialIntegrationModel.findOne({ _id: integrationId, companyCode, platform: "TikTok", isConnected: true }).lean() : null;
    const owner = await UserModel.findOne({ _id: card.authorUid, companyCode }).lean();
    const own = owner?.tiktokIntegration;
    if (!account && !own?.isConnected) return res.status(400).json({ status: "error", message: "Chưa có kết nối TikTok hợp lệ." });
    req.body.integration = account ? { username: account.username, displayName: account.displayName, accessToken: account.accessToken, blotatoAccountId: account.blotatoAccountId, isMock: account.isMock } : own;
  }
  let resolvedFacebookPage: string | undefined;
  if (req.path === "/facebook/publish" || (req.path === "/scheduler/schedule-post" && req.body?.channel === "Facebook")) {
    const { MarketingContentModel } = await import("../campaign/model/marketing-content.model");
    const card = await MarketingContentModel.findOne({ _id: req.body.cardId, companyCode }).select("authorUid").lean();
    if (!card) return res.status(403).json({ status: "error", message: "Bạn không có quyền truy cập bài đăng này." });
    const requestedPage = req.body?.pageId || req.body?.integration?.pageId;
    const account = integrationId || typeof requestedPage === "string"
      ? await SocialIntegrationModel.findOne({ companyCode, platform: "Facebook", isConnected: true, ...(integrationId ? { _id: integrationId } : { username: requestedPage }) }).lean() : null;
    if (integrationId && !account) return res.status(400).json({ status: "error", message: "Chưa có kết nối Facebook hợp lệ." });
    const owner = account ? null : await UserModel.findOne({ _id: card.authorUid || req.user!.id, companyCode }).lean();
    const own = owner?.facebookIntegration;
    const pageId = account?.username || (own?.isConnected ? own.pageId : "");
    const accessToken = account?.accessToken || (own?.isConnected ? own.pageAccessToken : "");
    if (!pageId || !accessToken) return res.status(400).json({ status: "error", message: "Chưa có kết nối Facebook hợp lệ." });
    if (requestedPage && requestedPage !== pageId) return res.status(400).json({ status: "error", message: "Facebook Page không khớp với tài khoản được chọn." });
    resolvedFacebookPage = pageId;
    if (req.path === "/facebook/publish") { req.body.pageId = pageId; req.body.accessToken = accessToken; }
    else req.body.integration = { pageId, pageAccessToken: accessToken, isMock: account ? Boolean(account.isMock) : Boolean(own?.isMock) };
  }
  if (req.path === "/scheduler/schedule-post" || req.path === "/facebook/publish") {
    const { MarketingContentModel } = await import("../campaign/model/marketing-content.model");
    if (!await MarketingContentModel.exists({ _id: req.body.cardId, companyCode })) return res.status(403).json({ status: "error", message: "Bạn không có quyền truy cập bài đăng này." });
  }
  for (const [platform, value] of identities) {
    if (integrations) continue;
    if (typeof value !== "string" || !value) continue;
    await assertMarketingAccountOwnership(companyCode, String(platform), value);
    if (platform === "Facebook" && value === resolvedFacebookPage) continue;
    const account = await SocialIntegrationModel.exists({ companyCode, platform, username: value, isConnected: true });
    if (!account) {
      const owner = await UserModel.findById(req.user?.id).lean();
      const own = platform === "Facebook" ? owner?.facebookIntegration : platform === "Zalo" ? owner?.zaloIntegration : owner?.tiktokIntegration;
      const id = platform === "Facebook" ? owner?.facebookIntegration?.pageId : platform === "Zalo" ? owner?.zaloIntegration?.oaId : owner?.tiktokIntegration?.username;
      if (!own?.isConnected || id !== value) return res.status(403).json({ status: "error", message: "Bạn không có quyền truy cập tài khoản này." });
    }
  }
  const feature = integrations ? "social-integration" : knowledge ? "company-knowledge" : inbox ? "omni-inbox" : "marketing";
  const read = req.method === "GET" || path.endsWith("/test-search");
  return requirePermission(`${feature}:${read ? "read" : "manage"}`)(req, res, next);
}
