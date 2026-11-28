import { createHash } from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import cookieParser from "cookie-parser";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import type { AuthenticatedRequest } from "../../../middleware/auth";
import { UserModel } from "../../../model/user.model";
import { SocialIntegrationModel } from "./model/social-integration.model";
import { suiteAccess } from "./access";
import { suiteDataRouter } from "./data.router";
import { zaloOAuthRouter } from "./zalo-oauth.router";
import { resolveZaloAppConfig, verifyZaloConnectionWebhook } from "./zalo-app-config";
import { syncZbsTemplates, createZbsDraft, confirmZbsBatch, getZbsBatch } from "../message/zbs/service";
import { ZbsTemplateModel, ZbsOaLockModel } from "../message/zbs/model";
import { processNextZbsMessage } from "../message/zbs/worker";
import { zaloMessengerService } from "../message/service/zalo-messenger.service";

const ids = vi.hoisted(() => ({ ACME: "111111111111111111111111", OTHER: "222222222222222222222222" }));
vi.mock("../../../middleware/auth", () => ({
  requireAuth(req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) {
    const company = req.get("authorization")?.replace("Bearer ", "") as keyof typeof ids;
    if (!ids[company]) return res.sendStatus(401);
    req.user = { id: ids[company], role: "admin", companyCode: company, email: "test@example.test" }; next();
  },
  requirePermission: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
  getEffectivePermissions: async () => new Set(["social-integration:manage", "omni-inbox:manage"]),
}));
vi.mock("../../../middleware/require-module", () => ({ getModuleStateForCompany: async () => ({ exists: true, modules: ["omni-inbox", "social-marketing"] }) }));
vi.mock("../../../security/account-access", () => ({ AccountAccessError: class extends Error {}, assertAccountUsable: vi.fn() }));
vi.mock("./socket", () => ({ emitToMessengerAccount: vi.fn(), broadcastEvent: vi.fn() }));
vi.mock("../message/service/ai-auto-reply.service.ts", () => ({ aiAutoReplyService: {} }));
const realFetch = fetch;
const provider = vi.fn<typeof fetch>();
const publicOrigin = "https://erp.example.test";
let origin: string;
let server: Server;
let mongo: MongoMemoryServer;
const appOas: Record<string, string> = { "100": "111", "200": "111", "300": "222", "400": "111" };
beforeAll(async () => {
  mongo = await MongoMemoryServer.create(); await mongoose.connect(mongo.getUri());
  await SocialIntegrationModel.init();
  const app = express(); app.use(express.json()); app.use(cookieParser()); app.use("/api/v1", suiteAccess, zaloOAuthRouter, suiteDataRouter);
  server = await new Promise(resolve => { const listener = app.listen(0, "127.0.0.1", () => resolve(listener)); });
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}, 60000);
afterAll(async () => { await new Promise<void>(resolve => server.close(() => resolve())); await mongoose.disconnect(); await mongo?.stop(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
beforeEach(async () => {
  await Promise.all(Object.values(mongoose.connection.collections).map(collection => collection.deleteMany({})));
  await UserModel.collection.insertMany(Object.entries(ids).map(([companyCode, id]) => ({ _id: new mongoose.Types.ObjectId(id), companyCode, role: "admin", email: `${companyCode}@example.test` })));
  vi.stubEnv("APP_URL", publicOrigin); vi.stubEnv("ZALO_APP_ID", "100"); vi.stubEnv("ZALO_APP_SECRET", "global-secret"); vi.stubEnv("ZALO_OA_SECRET_KEY", "global-hook");
  vi.stubEnv("SUPERADMIN_ENCRYPTION_KEY", Buffer.alloc(32, 1).toString("hex"));
  provider.mockReset();
  provider.mockImplementation(async (input, options) => {
    const url = new URL(String(input));
    if (url.hostname === "oauth.zaloapp.com") {
      const body = new URLSearchParams(String(options?.body)); const appId = body.get("app_id");
      const expected = appId === "100" ? "global-secret" : `secret-${appId}`;
      expect((options?.headers as Record<string, string>).secret_key).toBe(expected);
      return Response.json({ access_token: `token-${appId}`, refresh_token: `refresh-${appId}`, expires_in: "3600" });
    }
    const token = (options?.headers as Record<string, string>).access_token;
    const appId = token.split("-").at(-1)!;
    if (url.pathname.endsWith("/getoa")) return Response.json({ error: 0, data: { oaid: appOas[appId], name: `OA ${appOas[appId]}` } });
    if (url.pathname === "/template/all") return Response.json({ error: 0, data: [{ templateId: "777" }], metadata: { total: 1 } });
    if (url.pathname === "/template/info/v2") return Response.json({ error: 0, data: { templateId: "777", templateName: `Mẫu App ${appId}`, status: "ENABLE", listParams: [], listButtons: [], price_uid: "200", price_sdt: "300" } });
    return Response.json({ error: 0, data: { message_id: `message-${appId}`, msg_id: `message-${appId}` } });
  });
  vi.stubGlobal("fetch", provider);
});
async function start(company: keyof typeof ids, body: object) {
  const response = await realFetch(origin + "/api/v1/zalo/oauth-session", { method: "POST", headers: { authorization: `Bearer ${company}`, origin: publicOrigin, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { response, result: await response.json(), cookie: response.headers.get("set-cookie")?.split(";")[0] || "" };
}
async function finish(session: Awaited<ReturnType<typeof start>>, oaId: string) {
  const state = new URL(session.result.authorizationUrl).searchParams.get("state")!;
  const response = await realFetch(origin + "/api/v1/zalo/oauth-callback?" + new URLSearchParams({ state, code: "test-code", oa_id: oaId }), { headers: { cookie: session.cookie }, redirect: "manual" });
  return new URL(response.headers.get("location")!).searchParams.get("zalo_oauth");
}
async function connect(company: keyof typeof ids, appId: string, oaId: string, integrationId?: string) {
  const session = await start(company, { appMode: "custom", appId, appSecret: `secret-${appId}`, webhookSecret: `hook-${appId}`, ...(integrationId ? { integrationId } : {}) });
  expect(session.response.status).toBe(200); expect(await finish(session, oaId)).toBe("connected");
  return (await SocialIntegrationModel.findOne({ companyCode: company, username: oaId }).lean())!;
}
it("uses independent Apps for two companies, encrypts secrets and scopes templates and metadata", async () => {
  const a = await connect("ACME", "200", "111"); await connect("OTHER", "300", "222");
  const stored = await SocialIntegrationModel.collection.findOne({ _id: a._id });
  expect(stored?.zaloAppSecret).toMatch(/^v1\./); expect(stored?.zaloWebhookSecret).toMatch(/^v1\./);
  expect((await resolveZaloAppConfig("111", "ACME")).appId).toBe("200");
  await expect(resolveZaloAppConfig("111", "OTHER")).rejects.toThrow();
  const [templatesA, templatesB] = await Promise.all([syncZbsTemplates("ACME", "111"), syncZbsTemplates("OTHER", "222")]);
  expect(templatesA[0]).toMatchObject({ appId: "200", templateId: "777", name: "Mẫu App 200" });
  expect(templatesB[0]).toMatchObject({ appId: "300", templateId: "777", name: "Mẫu App 300" });
  expect(await ZbsTemplateModel.countDocuments()).toBe(2);
  const response = await realFetch(origin + "/api/v1/social-integrations", { headers: { authorization: "Bearer ACME" } });
  const json = await response.json();
  expect(json.data).toHaveLength(1);
  expect(json.data[0]).toMatchObject({ zaloAppId: "200", hasZaloAppSecret: true, hasZaloWebhookSecret: true });
  expect(JSON.stringify(json)).not.toMatch(/secret-200|hook-200|token-200|v1\./);
  expect(json.data[0]).not.toHaveProperty("zaloAppSecret");
  expect(json.data[0]).not.toHaveProperty("zaloWebhookSecret");
  expect(process.env.ZALO_APP_ID).toBe("100");
  vi.stubEnv("ZALO_APP_ID", ""); vi.stubEnv("ZALO_APP_SECRET", ""); vi.stubEnv("ZALO_OA_SECRET_KEY", "");
  expect((await resolveZaloAppConfig("111", "ACME")).appId).toBe("200");
  expect((await syncZbsTemplates("ACME", "111"))[0].name).toBe("Mẫu App 200");
});
it("refreshes with the connection App credentials and never writes stale refreshed credentials over a changed connection", async () => {
  const a = await connect("ACME", "200", "111");
  await SocialIntegrationModel.updateOne({ _id: a._id }, { $set: { tokenExpiredAt: new Date(0) } });
  provider.mockClear();
  expect(await zaloMessengerService.getAccessTokenByOAId("111", "ACME")).toBe("token-200");
  const call = provider.mock.calls.find(([url]) => String(url).includes("oa/access_token"))!;
  expect(new URLSearchParams(String(call[1]?.body)).get("app_id")).toBe("200");
  expect((call[1]?.headers as Record<string, string>).secret_key).toBe("secret-200");
  const current = await SocialIntegrationModel.findById(a._id);
  await SocialIntegrationModel.updateOne({ _id: a._id }, { $inc: { zaloConnectionVersion: 1 }, $set: { accessToken: "newer-token" } });
  await expect(zaloMessengerService.refreshCompanyZaloToken(String(a._id), current)).rejects.toThrow("đã thay đổi");
  expect((await SocialIntegrationModel.findById(a._id))?.accessToken).toBe("newer-token");
});
it("accepts only the exact App/OA webhook signature and rejects cross-OA and global-key fallback", async () => {
  await connect("ACME", "200", "111"); await connect("OTHER", "300", "222");
  function signed(appId: string, oaId: string, secret: string) {
    const body = { app_id: appId, event_name: "user_send_text", sender: { id: "999" }, recipient: { id: oaId }, timestamp: Date.now() };
    const rawBody = JSON.stringify(body); return { body, rawBody, signature: "mac=" + createHash("sha256").update(appId + rawBody + body.timestamp + secret).digest("hex") };
  }
  expect(await verifyZaloConnectionWebhook(signed("200", "111", "hook-200"))).toMatchObject({ companyCode: "ACME", appId: "200", oaId: "111" });
  expect(await verifyZaloConnectionWebhook(signed("300", "111", "hook-300"))).toBeNull();
  expect(await verifyZaloConnectionWebhook(signed("100", "111", "global-hook"))).toBeNull();
  expect(await verifyZaloConnectionWebhook(signed("200", "111", "global-hook"))).toBeNull();
});
it("blocks another tenant and wrong OA callbacks, requires new secrets for a changed App and retains saved secrets on same-App reconnect", async () => {
  const a = await connect("ACME", "200", "111");
  expect((await start("OTHER", { integrationId: String(a._id), appMode: "custom", appId: "200" })).response.status).toBe(404);
  expect((await start("ACME", { integrationId: String(a._id), appMode: "custom", appId: "400" })).response.status).toBe(400);
  const wrong = await start("ACME", { integrationId: String(a._id), appMode: "custom", appId: "200" });
  provider.mockClear(); expect(await finish(wrong, "222")).toBe("conflict"); expect(provider).not.toHaveBeenCalled();
  const same = await start("ACME", { integrationId: String(a._id), appMode: "custom", appId: "200" });
  const session = await mongoose.connection.collection("marketing_zalo_oauth_sessions").findOne({});
  expect(session?.appSecret).toMatch(/^v1\./);
  expect(await finish(same, "111")).toBe("connected");
});
it("rejects stale OAuth callbacks and prevents generic CRUD from overriding managed App bindings", async () => {
  const a = await connect("ACME", "200", "111");
  const session = await start("ACME", { integrationId: String(a._id), appMode: "custom", appId: "200" });
  await SocialIntegrationModel.updateOne({ _id: a._id }, { $inc: { zaloConnectionVersion: 1 } });
  provider.mockClear(); expect(await finish(session, "111")).toBe("conflict"); expect(provider).not.toHaveBeenCalled();
  const response = await realFetch(origin + `/api/v1/social-integrations/${a._id}`, { method: "PATCH", headers: { authorization: "Bearer ACME", "Content-Type": "application/json" }, body: JSON.stringify({ zaloAppId: "400", zaloAppSecret: "injected" }) });
  expect(response.status).toBe(400);
  expect((await resolveZaloAppConfig("111", "ACME")).appId).toBe("200");
});
it("sends custom-App UID and phone batches and pauses old-App batches after switching the connection", async () => {
  const a = await connect("ACME", "200", "111");
  const draft = (method: "uid" | "phone") => createZbsDraft("ACME", ids.ACME, { name: "Thử App riêng", oaId: "111", templateId: "777", method, leadIds: [], mapping: {}, test: true, manualRecipient: method === "uid" ? "99999" : "0912345678" });
  const uid = await draft("uid"); await confirmZbsBatch("ACME", ids.ACME, uid.id); provider.mockClear(); await processNextZbsMessage();
  const send = provider.mock.calls.find(([url]) => String(url).includes("/message/template"))!;
  expect((send[1]?.headers as Record<string, string>).access_token).toBe("token-200");
  expect((await getZbsBatch("ACME", uid.id)).rows[0].status).toBe("accepted");
  const phone = await draft("phone"); await confirmZbsBatch("ACME", ids.ACME, phone.id);
  await connect("ACME", "400", "111", String(a._id));
  // Advance the persisted one-second rate limit without sleeping in this test.
  await ZbsOaLockModel.updateMany({}, { $set: { nextAt: new Date(0) } });
  provider.mockClear(); await processNextZbsMessage();
  expect((await getZbsBatch("ACME", phone.id)).status).toBe("paused");
  expect(provider.mock.calls.some(([url]) => String(url).includes("/message/template"))).toBe(false);
  const fresh = await draft("phone"); await confirmZbsBatch("ACME", ids.ACME, fresh.id); provider.mockClear(); await processNextZbsMessage();
  const phoneSend = provider.mock.calls.find(([url]) => String(url).includes("/message/template"))!;
  expect((phoneSend[1]?.headers as Record<string, string>).access_token).toBe("token-400");
  expect(JSON.parse(String(phoneSend[1]?.body))).toMatchObject({ phone: "84912345678", template_id: "777" });
});
