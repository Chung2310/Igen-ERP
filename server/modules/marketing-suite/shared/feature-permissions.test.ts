import { expect, it, vi } from "vitest";
import { facebookPostRouter } from "./router/facebook-post.router";
import { tiktokRouter } from "./router/tiktok.router";
import { companyKnowledgeRouter } from "../knowledge/router/company-knowledge.router";
import type { Router, RequestHandler, IRoute } from "express";

vi.mock("./middleware/auth", () => ({
  requireAuth: vi.fn(),
  requirePermission: (permission: string) => Object.assign(vi.fn(), { permission }),
}));
vi.mock("./controller/facebook-post.controller", () => ({ facebookPostController: new Proxy({}, { get: () => vi.fn() }) }));
vi.mock("./controller/tiktok.controller", () => ({ tiktokController: new Proxy({}, { get: () => vi.fn() }) }));
vi.mock("./controller/gemini.controller", () => ({ geminiController: new Proxy({}, { get: () => vi.fn() }) }));
vi.mock("../knowledge/controller/company-knowledge.controller", () => ({ companyKnowledgeController: new Proxy({}, { get: () => vi.fn() }) }));

type RuntimeRoute = IRoute & { methods: Record<string, boolean> };
function permissions(router: Router, path: string, method: string) {
  const route = router.stack.find((layer) => layer.route?.path === path && (layer.route as RuntimeRoute).methods[method])!.route;
  return route.stack.map((layer: { handle: RequestHandler & { permission?: string } }) => layer.handle.permission).filter(Boolean);
}
it("uses integration management for Facebook validation and TikTok validation/OAuth", () => {
  expect(permissions(facebookPostRouter, "/validate-token", "post")).toEqual(["social-integration:manage"]);
  expect(permissions(tiktokRouter, "/validate-token", "post")).toEqual(["social-integration:manage"]);
  expect(permissions(tiktokRouter, "/oauth/start", "get")).toEqual(["social-integration:manage"]);
});
it("retains Marketing permissions on publishing routes", () => {
  expect(permissions(facebookPostRouter, "/publish", "post")).toEqual(["marketing:post"]);
  expect(permissions(tiktokRouter, "/publish", "post")).toEqual(["marketing:post"]);
});
it("uses ERP knowledge permissions for every management route without legacy role requirements", () => {
  for (const layer of companyKnowledgeRouter.stack) {
    const route = layer.route as RuntimeRoute | undefined;
    if (!route || route.methods.get || route.path === "/test-search") continue;
    const method = Object.keys(route.methods)[0];
    expect(permissions(companyKnowledgeRouter, layer.route.path, method)).toEqual(["company-knowledge:manage"]);
  }
});
