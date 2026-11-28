import express, { type NextFunction, type Request, type Response } from "express";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import type { AuthenticatedRequest } from "../../../../middleware/auth";
import { suiteAccess } from "../../shared/access";

vi.mock("../../../../middleware/auth", () => ({
  requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    if (!req.get("authorization")) return res.sendStatus(401);
    req.user = { id: "test-user", email: "test@example.test", role: "staff", companyCode: "ACME" }; next();
  },
  requirePermission: (permission: string) => (req: Request, res: Response, next: NextFunction) => {
    if (req.get("authorization") !== "Bearer manage" && permission.endsWith(":manage")) return res.sendStatus(403);
    return permission.startsWith("omni-inbox:") ? next() : res.sendStatus(403);
  },
}));
vi.mock("../../../../middleware/require-module", () => ({ getModuleStateForCompany: vi.fn(async () => ({ exists: true, modules: ["omni-inbox"] })) }));
let server: ReturnType<express.Express["listen"]>;
let origin: string;
beforeAll(async () => {
  const app = express(); app.use(express.json()); app.use("/api/v1", suiteAccess);
  app.use("/api/v1/zalo/zbs", (_req, res) => res.json({ allowed: true }));
  server = await new Promise(resolve => { const listener = app.listen(0, "127.0.0.1", () => resolve(listener)); });
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1/zalo/zbs`;
});
afterAll(async () => { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); });
it("protects all ZBS reads and mutations through the existing CRM module and permissions", async () => {
  expect((await fetch(`${origin}/batches`)).status).toBe(401);
  expect((await fetch(`${origin}/batches`, { headers: { authorization: "Bearer read" } })).status).toBe(200);
  for (const path of ["templates/sync", "drafts", "batches/id/confirm", "batches/id/control", "batches/id/reconcile"]) {
    expect((await fetch(`${origin}/${path}`, { method: "POST", headers: { authorization: "Bearer read" } })).status).toBe(403);
    expect((await fetch(`${origin}/${path}`, { method: "POST", headers: { authorization: "Bearer manage" } })).status).toBe(200);
  }
});
