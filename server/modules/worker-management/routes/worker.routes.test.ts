import { once } from "node:events";
import http from "node:http";
import express from "express";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../middleware/auth", () => ({
  requirePermission: (required: string | string[]) => {
    const needs = Array.isArray(required) ? required : [required];
    return (req: any, res: any, next: any) => {
      const granted = new Set(String(req.headers["x-permissions"] || "").split(",").filter(Boolean));
      return needs.some((permission) => granted.has(permission))
        ? next()
        : res.status(403).json({ message: "Forbidden" });
    };
  },
}));

import { WorkerService } from "../services/worker.service";
import { workerRoutes } from "./worker.routes";

async function withServer(run: (base: string) => Promise<void>) {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.user = { companyCode: String(req.headers["x-company"] || "ACME"), branchId: req.headers["x-branch"] };
    next();
  });
  app.use("/workers", workerRoutes);
  const server = http.createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not start");
  try { await run(`http://127.0.0.1:${address.port}/workers`); }
  finally { server.close(); await once(server, "close"); }
}

afterEach(() => vi.restoreAllMocks());

describe("worker HTTP routes", () => {
  it("allows worker:read to list but not mutate", async () => {
    vi.spyOn(WorkerService, "list").mockResolvedValue([] as any);
    await withServer(async (base) => {
      const list = await fetch(base, { headers: { "x-permissions": "worker:read" } });
      expect(list.status).toBe(200);
      expect(await list.json()).toEqual({ workers: [] });
      const create = await fetch(base, { method: "POST", headers: { "content-type": "application/json", "x-permissions": "worker:read" }, body: JSON.stringify({ fullName: "A" }) });
      expect(create.status).toBe(403);
    });
  });

  it("allows worker:manage and preserves create 201", async () => {
    vi.spyOn(WorkerService, "create").mockResolvedValue({ _id: "w1", fullName: "A" } as any);
    await withServer(async (base) => {
      const response = await fetch(base, { method: "POST", headers: { "content-type": "application/json", "x-permissions": "worker:manage", "x-company": "acme", "x-branch": " B1 " }, body: JSON.stringify({ fullName: "A" }) });
      expect(response.status).toBe(201);
      expect(await response.json()).toMatchObject({ worker: { _id: "w1" } });
      expect(WorkerService.create).toHaveBeenCalledWith({ companyCode: "ACME", branchId: "B1" }, { fullName: "A" });
    });
  });

  it("preserves 404 for missing update and delete targets", async () => {
    vi.spyOn(WorkerService, "update").mockResolvedValue(null as any);
    vi.spyOn(WorkerService, "delete").mockResolvedValue(null as any);
    await withServer(async (base) => {
      const update = await fetch(`${base}/missing`, { method: "PATCH", headers: { "content-type": "application/json", "x-permissions": "worker:manage" }, body: JSON.stringify({ fullName: "A" }) });
      expect(update.status).toBe(404);
      const remove = await fetch(`${base}/missing`, { method: "DELETE", headers: { "x-permissions": "worker:manage" } });
      expect(remove.status).toBe(404);
    });
  });
});