import { createHash } from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import cookieParser from "cookie-parser";
import express from "express";
import { models } from "mongoose";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { getEffectivePermissions, type AuthenticatedRequest } from "../../../middleware/auth";
import { UserModel } from "../../../model/user.model";
import { assertMarketingAccountOwnership } from "./account-ownership";
import { suiteAccess } from "./access";
import { SocialIntegrationModel } from "./model/social-integration.model";
import { zaloOAuthRouter } from "./zalo-oauth.router";

vi.mock("../../../middleware/auth", () => ({
  requireAuth: (req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) => {
    if (req.get("authorization") !== "Bearer admin") return res.sendStatus(401);
    req.user = { id: "507f191e810c19729de860ea", companyCode: "ERP", role: "admin" } as AuthenticatedRequest["user"];
    next();
  },
  requirePermission: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
  getEffectivePermissions: vi.fn(),
}));
vi.mock("../../../middleware/require-module", () => ({
  getModuleStateForCompany: async () => ({ exists: true, modules: ["omni-inbox"] }),
}));
vi.mock("../../../security/account-access", () => ({ AccountAccessError: class extends Error {}, assertAccountUsable: vi.fn() }));
vi.mock("./account-ownership", () => ({ assertMarketingAccountOwnership: vi.fn() }));
vi.mock("./socket", () => ({ emitToMessengerAccount: vi.fn() }));
vi.mock("../message/service/ai-auto-reply.service.ts", () => ({ aiAutoReplyService: {} }));

const oaId = "4462152339089565647";
const erpOrigin = "https://erp.example.test";
const realFetch = fetch;
const providerFetch = vi.fn<typeof fetch>();
const callbackPath = "/api/v1/zalo/oauth-callback";
let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  app.use(cookieParser());
  app.use("/api/v1", suiteAccess, zaloOAuthRouter);
  server = await new Promise<Server>((resolve) => {
    const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
});

beforeEach(() => {
  vi.stubEnv("APP_URL", erpOrigin);
  vi.stubEnv("ZALO_APP_ID", "1234");
  vi.stubEnv("ZALO_APP_SECRET", "test-zalo-secret");
  vi.stubEnv("SUPERADMIN_ENCRYPTION_KEY", Buffer.alloc(32, 1).toString("hex"));
  vi.stubGlobal("fetch", providerFetch);
  vi.mocked(getEffectivePermissions).mockResolvedValue(new Set(["social-integration:manage"]));
  vi.mocked(assertMarketingAccountOwnership).mockResolvedValue();
  vi.spyOn(UserModel.collection, "findOne").mockResolvedValue({ role: "admin", companyCode: "ERP" });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  providerFetch.mockReset();
});

async function startSession() {
  const collection = models.ZaloOAuthSession.collection;
  const insert = vi.spyOn(collection, "insertOne").mockImplementation(async doc => ({ acknowledged: true, insertedId: doc._id }));
  const response = await realFetch(baseUrl + "/api/v1/zalo/oauth-session", {
    method: "POST", headers: { Authorization: "Bearer admin", Origin: erpOrigin },
  });
  expect(response.status).toBe(200);
  const { authorizationUrl } = await response.json();
  const url = new URL(authorizationUrl);
  const setCookie = response.headers.get("set-cookie")!;
  expect(setCookie).toContain("HttpOnly; Secure; SameSite=Lax");
  expect(setCookie).toContain(`Path=${callbackPath}`);
  const cookie = setCookie.split(";")[0];
  const session = insert.mock.calls[0][0];
  const { _id } = session;
  if (!_id) throw new Error("OAuth session was created without an ID.");
  let available = true;
  vi.spyOn(collection, "findOneAndDelete").mockImplementation(async query => {
    if (!available || query.bindingHash !== session.bindingHash || query.expiresAt.$gt >= session.expiresAt) return null;
    available = false;
    return { ...session, _id };
  });
  return { cookie, url, session };
}

async function callback(state: string, cookie?: string) {
  const query = new URLSearchParams({ state, oa_id: oaId, code: "fake-code" });
  const response = await realFetch(`${baseUrl}${callbackPath}?${query}`, {
    headers: cookie ? { Cookie: cookie } : {}, redirect: "manual",
  });
  expect(response.status).toBe(303);
  const location = new URL(response.headers.get("location")!);
  expect(location.origin + location.pathname).toBe(erpOrigin + "/tich-hop-marketing");
  return location.searchParams.get("zalo_oauth");
}

it("connects the verified OA with PKCE and stores encrypted tokens for the originating company", async () => {
  const { cookie, url, session } = await startSession();
  expect(url.origin + url.pathname).toBe("https://oauth.zaloapp.com/v4/oa/permission");
  expect(url.searchParams.get("redirect_uri")).toBe(erpOrigin + callbackPath);
  expect(url.searchParams.get("code_challenge")).toBe(createHash("sha256").update(session.codeVerifier).digest("base64url"));
  expect(session.codeVerifier).toMatch(/^[A-Za-z0-9]{43}$/);
  providerFetch
    .mockResolvedValueOnce(Response.json({ access_token: "oa-access", refresh_token: "oa-refresh", expires_in: "90000" }))
    .mockResolvedValueOnce(Response.json({ error: 0, data: { oaid: oaId, name: "OA thử nghiệm" } }));
  const persist = vi.spyOn(SocialIntegrationModel.collection, "findOneAndUpdate").mockResolvedValue(null);
  const state = url.searchParams.get("state")!;
  expect(await callback(state)).toBe("expired");
  expect(providerFetch).not.toHaveBeenCalled();
  expect(await callback(state, cookie)).toBe("connected");
  expect(await callback(state, cookie)).toBe("expired");
  expect(providerFetch).toHaveBeenCalledTimes(2);
  expect(String(providerFetch.mock.calls[0][1]?.body)).toContain(`code_verifier=${session.codeVerifier}`);
  expect(persist).toHaveBeenCalledWith(
    { companyCode: "ERP", platform: "Zalo", username: oaId },
    expect.objectContaining({
      $set: expect.objectContaining({
        isConnected: true, accessToken: expect.stringMatching(/^v1\./), refreshToken: expect.stringMatching(/^v1\./),
        tokenExpiredAt: expect.any(Date),
      }),
      $setOnInsert: expect.objectContaining({ displayName: "OA thử nghiệm", createdBy: session.userId }),
    }),
    expect.objectContaining({ upsert: true }),
  );
});

it("rejects authorization for an OA already owned by another company before exchanging the code", async () => {
  const { cookie, url } = await startSession();
  vi.mocked(assertMarketingAccountOwnership).mockRejectedValueOnce(Object.assign(new Error("Conflict"), { statusCode: 409 }));
  expect(await callback(url.searchParams.get("state")!, cookie)).toBe("conflict");
  expect(providerFetch).not.toHaveBeenCalled();
});

it("rejects an OA profile error even when Zalo responds with HTTP 200", async () => {
  const { cookie, url } = await startSession();
  providerFetch
    .mockResolvedValueOnce(Response.json({ access_token: "oa-access", refresh_token: "oa-refresh", expires_in: "90000" }))
    .mockImplementation(async () => Response.json({ error: -216, message: "Permission denied" }));
  const persist = vi.spyOn(SocialIntegrationModel.collection, "findOneAndUpdate");
  expect(await callback(url.searchParams.get("state")!, cookie)).toBe("failed");
  expect(persist).not.toHaveBeenCalled();
});
