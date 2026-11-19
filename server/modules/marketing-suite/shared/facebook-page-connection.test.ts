import type { IRoute, NextFunction, Request, Response } from "express";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { facebookPostController } from "./controller/facebook-post.controller";
import { suiteDataRouter } from "./data.router";
import { SocialIntegrationModel } from "./model/social-integration.model";
import { facebookPostService } from "./service/facebook-post.service";

vi.mock("./account-ownership", () => ({ assertMarketingAccountOwnership: vi.fn(async () => {}) }));

const companyCode = "ERP";
const integrationId = "507f1f77bcf86cd799439011";
const validPage = { id: "938475", name: "Page hợp lệ", access_token: "valid-page-token", facebookUserId: "sender-1" };
const rejectedPage = { id: "938476", name: "Page bị từ chối", access_token: "rejected-page-token", facebookUserId: "sender-1" };

beforeEach(() => {
  vi.stubEnv("FB_APP_ID", "test-app-id");
  vi.stubEnv("FB_APP_SECRET", "test-app-secret");
  vi.spyOn(SocialIntegrationModel, "create").mockImplementation(async (data: unknown) => ({ toObject: () => data }) as never);
  vi.spyOn(SocialIntegrationModel, "findOneAndUpdate").mockReturnValue({ lean: async () => ({ _id: integrationId }) } as never);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function runCallback() {
  const req = {
    query: { code: "test-code", state: encodeURIComponent(JSON.stringify({ companyCode, createdBy: "user" })) },
    get: () => "localhost:3000",
    protocol: "http",
  } as unknown as Request;
  const res = { status: vi.fn().mockReturnThis(), send: vi.fn() };
  return facebookPostController.oauthCallback(req, res as unknown as Response).then(() => res);
}

function runIntegrationWrite(method: "post" | "patch", body: Record<string, unknown>) {
  const path = method === "post" ? "/social-integrations" : "/social-integrations/:id";
  const route = suiteDataRouter.stack.find(layer =>
    layer.route?.path === path && (layer.route as IRoute & { methods: Record<string, boolean> }).methods[method],
  )!.route;
  return new Promise<{ status: number; data: unknown }>((resolve, reject) => {
    let status = 200;
    let index = 0;
    const req = { body, params: { id: integrationId }, user: { id: "user", companyCode } } as unknown as Request;
    const res = {
      status(code: number) { status = code; return this; },
      json(data: unknown) { resolve({ status, data }); },
    } as unknown as Response;
    const next: NextFunction = (error?: unknown) => {
      if (error) return reject(error);
      const layer = route.stack[index++];
      if (!layer) return reject(new Error("No response"));
      layer.handle(req, res, next);
    };
    next();
  });
}

it("saves and reports only OAuth Pages that Meta confirmed", async () => {
  vi.spyOn(facebookPostService, "exchangeCodeForPagesWithCreds").mockResolvedValue([validPage, rejectedPage]);
  const fetch = vi.fn().mockImplementation(async (url: URL) =>
    url.pathname.includes(validPage.id) ? Response.json({ success: true }) : Response.json({ success: false }));
  vi.stubGlobal("fetch", fetch);

  const { send } = await runCallback();
  expect(SocialIntegrationModel.findOneAndUpdate).toHaveBeenCalledExactlyOnceWith(
    { companyCode, platform: "Facebook", username: validPage.id },
    { $set: expect.objectContaining({ isConnected: true }) },
    { upsert: true, new: true },
  );
  expect(fetch.mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(SocialIntegrationModel.findOneAndUpdate).mock.invocationCallOrder[0]);
  const html = send.mock.calls[0][0];
  expect(html).toContain("1/2 Fanpage đã kết nối");
  expect(html).toContain(validPage.id);
  expect(html).not.toContain(rejectedPage.id);
  expect(html).not.toContain(validPage.access_token);
});

it("shows OAuth failure and performs no write when Meta rejects every Page", async () => {
  vi.spyOn(facebookPostService, "exchangeCodeForPagesWithCreds").mockResolvedValue([rejectedPage]);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ success: true }, { status: 403 })));

  const { status, send } = await runCallback();
  expect(status).toHaveBeenCalledWith(500);
  expect(SocialIntegrationModel.findOneAndUpdate).not.toHaveBeenCalled();
  expect(send.mock.calls[0][0]).toContain("Meta chưa xác nhận đăng ký webhook.");
  expect(send.mock.calls[0][0]).not.toContain("FACEBOOK_PAGES_SELECTED");
});

it("leaves manual connections unsaved when registration fails and accepts a verified retry", async () => {
  const body = { platform: "Facebook", username: validPage.id, displayName: validPage.name, accessToken: validPage.access_token };
  const fetch = vi.fn()
    .mockRejectedValueOnce(new TypeError("Test network failure"))
    .mockResolvedValueOnce(Response.json({ success: true }));
  vi.stubGlobal("fetch", fetch);
  await expect(runIntegrationWrite("post", body)).rejects.toMatchObject({ statusCode: 502 });
  expect(SocialIntegrationModel.create).not.toHaveBeenCalled();

  await expect(runIntegrationWrite("post", body)).resolves.toMatchObject({ status: 201 });
  expect(SocialIntegrationModel.create).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
    companyCode, platform: "Facebook", username: validPage.id,
  }));
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(fetch.mock.calls[1][0].searchParams.get("subscribed_fields").split(",")).toContain("messages");
});

it("verifies a manual reactivation or changed credential before updating a Page", async () => {
  const existing = { _id: integrationId, platform: "Facebook", username: validPage.id, accessToken: validPage.access_token };
  vi.spyOn(SocialIntegrationModel, "findOne").mockReturnValueOnce({ lean: async () => ({ ...existing, isConnected: false }) } as never)
    .mockReturnValueOnce({ lean: async () => ({ ...existing, isConnected: true }) } as never);
  const fetch = vi.fn().mockImplementation(async () => Response.json({ success: false }));
  vi.stubGlobal("fetch", fetch);
  await expect(runIntegrationWrite("patch", { isConnected: true })).rejects.toMatchObject({ statusCode: 502 });
  await expect(runIntegrationWrite("patch", { accessToken: "new-token" })).rejects.toMatchObject({ statusCode: 502 });
  expect(SocialIntegrationModel.findOneAndUpdate).not.toHaveBeenCalled();
  expect(fetch.mock.calls.map(([, init]) => init.headers.Authorization)).toEqual([
    `Bearer ${validPage.access_token}`, "Bearer new-token",
  ]);
});
