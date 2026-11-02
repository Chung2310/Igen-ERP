import type { Request, Response, NextFunction } from "express";
import { beforeEach, expect, it, vi } from "vitest";
import { suiteAccess } from "./access";

const state = vi.hoisted(() => ({
  modules: ["omni-inbox"], permissions: ["omni-inbox:manage"], required: [] as string[],
  card: { authorUid: "author" } as { authorUid: string } | null,
  account: null as Record<string, unknown> | null,
  owner: { facebookIntegration: { isConnected: true, pageId: "author-page", pageAccessToken: "author-token" } } as Record<string, unknown> | null,
  ownerQueries: [] as unknown[],
}));
vi.mock("./model/social-integration.model", () => ({ SocialIntegrationModel: {
  exists: async () => true, findOne: () => ({ lean: async () => state.account }),
} }));
vi.mock("../../../model/user.model", () => ({ UserModel: {
  findOne: (filter: unknown) => { state.ownerQueries.push(filter); return { lean: async () => state.owner }; },
  findById: () => { throw new Error("Must resolve the card author, not the operator"); },
} }));
vi.mock("./account-ownership", () => ({ assertMarketingAccountOwnership: async () => undefined }));
vi.mock("../campaign/model/marketing-content.model", () => ({ MarketingContentModel: {
  exists: async () => Boolean(state.card),
  findOne: () => ({ select: () => ({ lean: async () => state.card }), lean: async () => state.card }),
} }));
vi.mock("../../../middleware/auth", () => ({
  requireAuth: (_req: Request, _res: Response, next: NextFunction) => next(),
  requirePermission: (permission: string) => (_req: Request, res: Response, next: NextFunction) => {
    state.required.push(permission);
    return state.permissions.includes(permission) ? next() : res.status(403).json({ status: "error" });
  },
}));
vi.mock("../../../middleware/require-module", () => ({ getModuleStateForCompany: async () => ({ exists: true, modules: state.modules }) }));

function authorize(path = "/marketing-settings/auto-reply", method = "PATCH", headers: Record<string, string> = {}, body: Record<string, unknown> = {}) {
  return new Promise<number>((resolve, reject) => {
    let status = 200;
    const req = { path, method, body, query: {}, headers, user: { id: "user", companyCode: "ERP" } } as unknown as Request;
    const res = { status(code: number) { status = code; return this; }, json() { resolve(status); return this; } } as unknown as Response;
    suiteAccess(req, res, ((error?: unknown) => error ? reject(error) : resolve(status)) as NextFunction);
  });
}
beforeEach(() => {
  state.modules = ["omni-inbox"];
  state.permissions = ["omni-inbox:manage"];
  state.required = [];
  state.card = { authorUid: "author" };
  state.account = null;
  state.owner = { facebookIntegration: { isConnected: true, pageId: "author-page", pageAccessToken: "author-token" } };
  state.ownerQueries = [];
});
it("allows an Inbox manager to save personal AI configuration without integration permissions", async () => {
  expect(await authorize()).toBe(200);
  expect(state.required).toEqual(["omni-inbox:manage"]);
});
it("requires Inbox management rather than read access for saving AI configuration", async () => {
  state.permissions = ["omni-inbox:read"];
  expect(await authorize()).toBe(403);
});
it("rejects AI configuration changes when the Inbox module is disabled", async () => {
  state.modules = ["social-marketing"];
  expect(await authorize()).toBe(403);
});
it("retains the integration management permission on integration writes", async () => {
  expect(await authorize("/social-integrations", "POST")).toBe(403);
  expect(state.required).toEqual(["social-integration:manage"]);
});


it.each([
  ["/omni-inbox/accounts", "GET", "omni-inbox", "omni-inbox:read"],
  ["/omni-inbox/accounts/abc/ai-config", "PATCH", "omni-inbox", "omni-inbox:manage"],
  ["/marketing-campaigns/accounts", "GET", "social-marketing", "marketing:read"],
  ["/marketing-settings/authors/abc", "GET", "social-marketing", "marketing:read"],
  ["/company-knowledge/accounts", "GET", "company-knowledge", "company-knowledge:read"],
  ["/company-knowledge/documents/upload", "POST", "company-knowledge", "company-knowledge:manage"],
  ["/facebook/validate-token", "POST", "omni-inbox", "social-integration:manage"],
  ["/tiktok/validate-token", "POST", "omni-inbox", "social-integration:manage"],
])("authorizes %s using only its feature permission", async (path, method, module, permission) => {
  state.modules = [module]; state.permissions = [permission];
  expect(await authorize(path, method)).toBe(200);
  expect(state.required).toEqual([permission]);
});

it("cannot edit credentials with Inbox management permission", async () => {
  expect(await authorize("/social-integrations/abc", "PATCH")).toBe(403);
});

it("uses the author's Facebook Page and ignores browser-supplied credentials when scheduling on behalf", async () => {
  state.modules = ["social-marketing"]; state.permissions = ["marketing:manage"];
  const body = { cardId: "card", channel: "Facebook", integration: { pageId: "author-page", pageAccessToken: "browser-token" } };
  expect(await authorize("/scheduler/schedule-post", "POST", {}, body)).toBe(200);
  expect(body.integration).toEqual({ pageId: "author-page", pageAccessToken: "author-token", isMock: false });
  expect(state.ownerQueries).toEqual([{ _id: "author", companyCode: "ERP" }]);
});

it("rejects a Page mismatch instead of silently selecting another personal Page", async () => {
  state.modules = ["social-marketing"]; state.permissions = ["marketing:manage"];
  expect(await authorize("/scheduler/schedule-post", "POST", {}, { cardId: "card", channel: "Facebook", integration: { pageId: "different-page" } })).toBe(400);
});

it("uses an explicitly selected company account without requiring a personal connection", async () => {
  state.modules = ["social-marketing"]; state.permissions = ["marketing:manage"];
  state.account = { username: "company-page", accessToken: "company-token", isMock: true }; state.owner = null;
  const body = { cardId: "card", pageId: "company-page", integrationId: "507f1f77bcf86cd799439011", accessToken: "browser-token" };
  expect(await authorize("/facebook/publish", "POST", {}, body)).toBe(200);
  expect(body.accessToken).toBe("company-token");
  expect(state.ownerQueries).toEqual([]);
});

it("does not fall back to a personal Page when the explicitly selected integration is disconnected", async () => {
  state.modules = ["social-marketing"]; state.permissions = ["marketing:manage"];
  expect(await authorize("/scheduler/schedule-post", "POST", {}, { cardId: "card", channel: "Facebook", integrationId: "507f1f77bcf86cd799439011", integration: { pageId: "author-page" } })).toBe(400);
});

it("rejects foreign or missing cards before reading personal credentials", async () => {
  state.modules = ["social-marketing"]; state.permissions = ["marketing:manage"]; state.card = null;
  expect(await authorize("/facebook/publish", "POST", {}, { cardId: "foreign", pageId: "author-page" })).toBe(403);
  expect(state.ownerQueries).toEqual([]);
});
