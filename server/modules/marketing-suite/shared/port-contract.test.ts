import { test } from "vitest";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { candidateCount, contentSimilarity, normalizeScores, validateCandidate } from "../campaign/service/candidate-policy";
import { MarketingCampaignModel } from "../campaign/model/marketing-campaign.model";
import { MarketingCampaignModel as LegacyCampaignModel } from "../../marketing/models/marketing-campaign.model";
import { SocialIntegrationModel } from "./model/social-integration.model";
import { CompanyModel } from "../../../model/company.model";
import { suiteAccess, isMarketingSuitePath } from "./access";
import { getMarketingAppUrl, getMarketingApprovalSecret, getMarketingOAuthSecret } from "./runtime-settings";
import { listErpKnowledgeDriveFiles, readErpKnowledgeDriveFile } from "../knowledge/service/erp-drive.adapter";
import { verifyZaloWebhook } from "../message/webhook-signature";

test("candidate count remains bounded and defaults to three", () => {
  assert.equal(candidateCount(), 3);
  assert.equal(candidateCount(0), 2);
  assert.equal(candidateCount(999), 5);
  assert.equal(candidateCount(Number.NaN), 3);
});
test("Zalo webhook verifies the exact raw payload and refuses missing configuration or forged data", () => {
  const timestamp = Date.now();
  const rawBody = JSON.stringify({ app_id: "app-erp", timestamp });
  const input = { appId: "app-erp", expectedAppId: "app-erp", timestamp, rawBody, secret: "oa-test-secret", signature: "mac=" + createHash("sha256").update(`app-erp${rawBody}${timestamp}oa-test-secret`).digest("hex") };
  assert.equal(verifyZaloWebhook(input), true);
  assert.equal(verifyZaloWebhook({ ...input, rawBody: rawBody + " " }), false);
  assert.equal(verifyZaloWebhook({ ...input, secret: "" }), false);
  assert.equal(verifyZaloWebhook({ ...input, appId: "foreign-app" }), false);
  assert.equal(verifyZaloWebhook({ ...input, now: timestamp + 25 * 60 * 60 * 1000 }), false);
});
test("scores are finite, bounded, and cannot fabricate a passing result", () => {
  const scores = { fidelity: 999, objective: 15, platform: 15, hook: 15, conversion: 10, readability: 10, novelty: -2 };
  assert.deepEqual(normalizeScores(scores), { ...scores, fidelity: 25, novelty: 0 });
  assert.throws(() => normalizeScores({ ...scores, hook: Number.NaN }));
  assert.throws(() => normalizeScores({ ...scores, fidelity: "100" }));
});
test("hard validation rejects placeholders, forbidden claims, duplicates, and invalid TikTok captions", () => {
  const draft = { title: "Sản phẩm", outline: "Chi tiết sản phẩm", mediaPrompt: "Ảnh sản phẩm", bodyText: "Ưu đãi sản phẩm dành cho khách hàng hôm nay" };
  assert.deepEqual(validateCandidate(draft, "Facebook", {}, []), []);
  assert.equal(contentSimilarity(draft.bodyText, draft.bodyText), 1);
  assert.ok(validateCandidate(draft, "Facebook", {}, [draft.bodyText]).length);
  assert.ok(validateCandidate({ ...draft, bodyText: "Liên hệ [số điện thoại]" }, "Facebook", {}, []).length);
  assert.ok(validateCandidate({ ...draft, bodyText: "Cảnh 1: sản phẩm" }, "TikTok", {}, []).length);
  assert.ok(validateCandidate(draft, "Facebook", { forbiddenTerms: ["ưu đãi"], requiredCta: "Đặt ngay", requiredHashtags: ["#brand"] }, []).length === 3);
  assert.ok(validateCandidate(draft, "TikTok", {}, [], true).includes("Thiếu kịch bản lời nói."));
});
test("social campaign registration does not reuse the ERP legacy model or collection", () => {
  assert.equal(MarketingCampaignModel.modelName, "SocialMarketingCampaign");
  assert.equal(MarketingCampaignModel.collection.name, "social_marketing_campaigns");
  assert.notEqual(MarketingCampaignModel.modelName, LegacyCampaignModel.modelName);
  assert.notEqual(MarketingCampaignModel.collection.name, LegacyCampaignModel.collection.name);
});
test("integration secrets are sealed at rest and opened only by getters", () => {
  const saved = process.env.SUPERADMIN_ENCRYPTION_KEY;
  process.env.SUPERADMIN_ENCRYPTION_KEY = "a".repeat(64);
  try {
    const account = new SocialIntegrationModel({ companyCode: "ERP", platform: "Facebook", displayName: "Page", username: "123", createdBy: "user", accessToken: "test-token", appSecret: "test-app-secret" });
    const raw = account.toObject({ getters: false });
    assert.match(raw.accessToken!, /^v1\./);
    assert.notEqual(raw.appSecret, "test-app-secret");
    assert.equal(account.accessToken, "test-token");
    account.accessToken = raw.accessToken;
    assert.equal(account.accessToken, "test-token");
  } finally { if (saved === undefined) delete process.env.SUPERADMIN_ENCRYPTION_KEY; else process.env.SUPERADMIN_ENCRYPTION_KEY = saved; }
});
test("suite guard leaves existing ERP routes alone and closes internal endpoints without secrets", () => {
  assert.equal(isMarketingSuitePath("/resource"), false);
  assert.equal(isMarketingSuitePath("/webhooks/unrelated-erp-webhook"), false);
  assert.equal(isMarketingSuitePath("/heygen/library"), false);
  assert.equal(isMarketingSuitePath("/html-video-generations"), false);
  assert.equal(isMarketingSuitePath("/opusclip/projects"), false);
  assert.equal(isMarketingSuitePath("/professional/render"), false);
  const saved = process.env.CAMPAIGN_WORKER_SECRET;
  delete process.env.CAMPAIGN_WORKER_SECRET;
  try {
    let status = 0, nextValue: unknown;
    const res = { status(code: number) { status = code; return this; }, json() { return this; } } as unknown as Response;
    const next = ((value?: unknown) => { nextValue = value; }) as NextFunction;
    suiteAccess({ path: "/resource", headers: {} } as Request, res, next);
    assert.equal(nextValue, "router");
    suiteAccess({ path: "/marketing-campaigns/internal/prepare", headers: {} } as Request, res, next);
    assert.equal(status, 401);
  } finally { if (saved !== undefined) process.env.CAMPAIGN_WORKER_SECRET = saved; }
});
test("company provider keys use document getters while raw ERP serialization remains encrypted", () => {
  const saved = process.env.SUPERADMIN_ENCRYPTION_KEY;
  process.env.SUPERADMIN_ENCRYPTION_KEY = "b".repeat(64);
  try {
    const company = new CompanyModel({ code: "ERP", name: "ERP", elevenlabsConfig: { apiKey: "private-provider-key" } });
    assert.equal(company.elevenlabsConfig?.apiKey, "private-provider-key");
    assert.match(company.toObject({ getters: false }).elevenlabsConfig!.apiKey!, /^v1\./);
  } finally { if (saved === undefined) delete process.env.SUPERADMIN_ENCRYPTION_KEY; else process.env.SUPERADMIN_ENCRYPTION_KEY = saved; }
});
test("Drive folder reads are bounded and malformed IDs are rejected before making a request", async () => {
  const client = { async request<T>() { return { data: { files: [{ id: "document12345" }], nextPageToken: "more" } as T }; } };
  await assert.rejects(() => listErpKnowledgeDriveFiles(client, "folder12345"), /50/);
  await assert.rejects(() => listErpKnowledgeDriveFiles(client, "../unsafe"), /không hợp lệ/);
});
test("private Drive export selects a safe MIME type and returns only content bytes", async () => {
  const urls: string[] = [];
  const client = { async request<T>(input: { url: string }) {
    urls.push(input.url);
    const data = urls.length === 1 ? { id: "document12345", name: "Tài liệu", mimeType: "application/vnd.google-apps.document" } : Buffer.from("Nội dung tài liệu");
    return { data: data as T };
  } };
  const result = await readErpKnowledgeDriveFile(client, "document12345");
  assert.equal(result.mimeType, "text/plain");
  assert.equal(result.buffer.toString("utf8"), "Nội dung tài liệu");
  assert.ok(urls[1].endsWith("/export?mimeType=text%2Fplain"));
});
test("approval and OAuth keys have separate purposes and callback URLs require ERP configuration", () => {
  const jwt = process.env.JWT_ACCESS_SECRET, url = process.env.APP_URL;
  process.env.JWT_ACCESS_SECRET = "test-erp-secret-with-sufficient-length";
  delete process.env.APP_URL;
  try {
    assert.notEqual(getMarketingApprovalSecret(), getMarketingOAuthSecret());
    assert.throws(() => getMarketingAppUrl(), /APP_URL/);
    process.env.APP_URL = "https://erp.example.com/";
    assert.equal(getMarketingAppUrl(), "https://erp.example.com");
    process.env.APP_URL = "http://erp.example.com";
    assert.throws(() => getMarketingAppUrl(), /Invalid APP_URL/);
  } finally {
    if (jwt === undefined) delete process.env.JWT_ACCESS_SECRET; else process.env.JWT_ACCESS_SECRET = jwt;
    if (url === undefined) delete process.env.APP_URL; else process.env.APP_URL = url;
  }
});
