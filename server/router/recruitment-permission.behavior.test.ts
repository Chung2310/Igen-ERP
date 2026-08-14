import { once } from "node:events";
import http from "node:http";
import express from "express";
import { describe, expect, it, vi } from "vitest";

vi.mock("../middleware/auth", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.user = { id: "user-1", role: "user", companyCode: "ACME" };
    next();
  },
  requirePermission: (required: string) => (req: any, res: any, next: any) => {
    const granted = String(req.headers["x-permissions"] || "").split(",").filter(Boolean);
    return granted.includes(required) || granted.includes("*")
      ? next()
      : res.status(403).json({ message: "Forbidden" });
  },
}));
vi.mock("../middleware/require-module", () => ({ requireModule: () => (_req: any, _res: any, next: any) => next() }));
vi.mock("../utils/recruitment-scope", () => ({ resolveRecruitmentScope: vi.fn().mockResolvedValue({ companyCode: "ACME" }) }));
vi.mock("../controller/recruitment.controller", () => ({
  recruitmentController: new Proxy({}, { get: () => (_req: any, res: any) => res.status(200).json({ ok: true }) }),
}));

const { recruitmentRouter } = await import("./recruitment.router");

async function withServer(run: (base: string) => Promise<void>) {
  const app = express();
  app.use(express.json());
  app.use("/recruitment", recruitmentRouter);
  const server = http.createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not start");
  try { await run(`http://127.0.0.1:${address.port}/recruitment`); }
  finally { server.close(); await once(server, "close"); }
}

describe("recruitment permission behavior", () => {
  it("allows read-only users to GET and denies recruitment mutations", async () => {
    await withServer(async (base) => {
      const list = await fetch(`${base}/jobs`, { headers: { "x-permissions": "recruitment:read" } });
      expect(list.status).toBe(200);
      const create = await fetch(`${base}/jobs`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-permissions": "recruitment:read" },
        body: JSON.stringify({}),
      });
      expect(create.status).toBe(403);
    });
  });

  it("allows manage users to mutate recruitment resources", async () => {
    await withServer(async (base) => {
      const create = await fetch(`${base}/jobs`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-permissions": "recruitment:manage" },
        body: JSON.stringify({}),
      });
      expect(create.status).toBe(200);
    });
  });
});
