import type { Request, Response, NextFunction, IRoute } from "express";
import { beforeEach, expect, it, vi } from "vitest";
import { suiteDataRouter } from "./data.router";

const state = vi.hoisted(() => ({ filter: {} as Record<string, unknown>, fields: "", update: {} as Record<string, unknown>, found: true, permissions: ["omni-inbox:manage"] }));
vi.mock("../../../middleware/auth", () => ({ requirePermission: (permission: string) => (_req: Request, res: Response, next: NextFunction) => state.permissions.includes(permission) ? next() : res.status(403).json({ status: "error" }) }));
vi.mock("./model/social-integration.model", () => ({ SocialIntegrationModel: {
  find: (filter: Record<string, unknown>) => {
    state.filter = filter;
    return { select: (fields: string) => { state.fields = fields; return { sort: () => ({ lean: async () => [] }) }; } };
  },
  findOne: (filter: Record<string, unknown>) => {
    state.filter = filter;
    return { select: (fields: string) => { state.fields = fields; return { lean: async () => state.found ? { _id: "account" } : null }; } };
  },
  findOneAndUpdate: (filter: Record<string, unknown>, update: Record<string, unknown>) => {
    state.filter = filter; state.update = update;
    return { select: (fields: string) => { state.fields = fields; return { lean: async () => state.found ? { _id: "account" } : null }; } };
  },
} }));

type RuntimeRoute = IRoute & { methods: Record<string, boolean> };
function request(path: string, method = "get", body: Record<string, unknown> = {}) {
  const route = suiteDataRouter.stack.find((layer) => layer.route?.path === path && (layer.route as RuntimeRoute).methods[method])!.route;
  return new Promise<{ status: number; body: unknown }>((resolve, reject) => {
    let status = 200, index = 0;
    const req = { body, params: { id: "507f1f77bcf86cd799439011" }, query: { companyCode: "FOREIGN" }, user: { id: "operator", companyCode: "ERP" } } as unknown as Request;
    const res = { status(code: number) { status = code; return this; }, json(data: unknown) { resolve({ status, body: data }); return this; } } as unknown as Response;
    const next: NextFunction = (error?: unknown) => {
      if (error) return reject(error);
      const layer = route.stack[index++];
      if (!layer) return reject(new Error("No response"));
      try { layer.handle(req, res, next); } catch (error) { reject(error); }
    };
    next();
  });
}
beforeEach(() => { state.filter = {}; state.fields = ""; state.update = {}; state.found = true; state.permissions = ["omni-inbox:manage"]; });

it.each(["/omni-inbox", "/marketing-campaigns", "/company-knowledge"])("scopes %s account metadata to the session company and selects no credentials", async (prefix) => {
  expect((await request(`${prefix}/accounts`)).status).toBe(200);
  expect(state.filter).toEqual({ companyCode: "ERP" });
  expect(state.fields).toContain("username");
  expect(state.fields).not.toMatch(/accessToken|refreshToken|appSecret|verifyToken|oauth|orderSheetConfig/);
  if (prefix !== "/omni-inbox") expect(state.fields).not.toContain("aiAutoReplyConfig");
});
it("updates only AI configuration under Inbox permissions", async () => {
  expect((await request("/omni-inbox/accounts/:id/ai-config", "patch", { aiAutoReplyConfig: { enabled: true, commentReplyEnabled: true } })).status).toBe(200);
  expect(state.filter).toEqual({ _id: "507f1f77bcf86cd799439011", companyCode: "ERP" });
  expect(state.update).toEqual({ $set: { aiAutoReplyConfig: { enabled: true, commentReplyEnabled: true } } });
});
it.each([
  { aiAutoReplyConfig: { enabled: true }, accessToken: "injected" },
  { aiAutoReplyConfig: { enabled: true, accessToken: "injected" } },
  { aiAutoReplyConfig: { $set: { enabled: true } } },
  { aiAutoReplyConfig: [] },
])("rejects credential or operator injection on the Inbox configuration endpoint", async (body) => {
  expect((await request("/omni-inbox/accounts/:id/ai-config", "patch", body)).status).toBe(400);
  expect(state.update).toEqual({});
});
it("rejects writes from an Inbox reader", async () => {
  state.permissions = ["omni-inbox:read"];
  expect((await request("/omni-inbox/accounts/:id/ai-config", "patch", { aiAutoReplyConfig: { enabled: true } })).status).toBe(403);
  expect(state.update).toEqual({});
});
it("returns 404 for a foreign or missing account", async () => {
  state.found = false;
  expect((await request("/omni-inbox/accounts/:id")).status).toBe(404);
  expect((await request("/omni-inbox/accounts/:id/ai-config", "patch", { aiAutoReplyConfig: { enabled: true } })).status).toBe(404);
  expect(state.filter.companyCode).toBe("ERP");
});
