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
import { importResourceService } from "../../../service/import-resource.service";
import { workerRoutes } from "./worker.routes";

async function withServer(run: (base: string) => Promise<void>) {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.user = {
      id: String(req.headers["x-user"] || "user-1"),
      role: String(req.headers["x-role"] || "admin"),
      companyCode: String(req.headers["x-company"] || "ACME"),
      branchId: req.headers["x-branch"],
    };
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
+  it("applies a superadmin-selected company and branch scope", async () => {
    vi.spyOn(WorkerService, "list").mockResolvedValue([] as any);
    await withServer(async (base) => {
      const response = await fetch(`${base}?companyCode=labor&branchId=branch-2`, {
        headers: {
          "x-company": "",
          "x-role": "superadmin",
          "x-permissions": "worker:read",
        },
      });
      expect(response.status).toBe(200);
      expect(WorkerService.list).toHaveBeenCalledWith({
        companyCode: "LABOR",
        branchId: "branch-2",
      });
    });
  });

  it("rejects a tenant user attempting to override authenticated scope", async () => {
    const list = vi.spyOn(WorkerService, "list").mockResolvedValue([] as any);
    await withServer(async (base) => {
      const response = await fetch(`${base}?companyCode=OTHER`, {
        headers: {
          "x-company": "ACME",
          "x-role": "admin",
          "x-permissions": "worker:read",
        },
      });
      expect(response.status).toBe(403);
      expect(list).not.toHaveBeenCalled();
    });
  });
});

describe("bulk import route", () => {
  const post = (base: string, body: unknown, permissions = "worker:manage") =>
    fetch(`${base}/bulk`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-company": "ACME", "x-role": "admin", "x-permissions": permissions },
      body: JSON.stringify(body),
    });

  it("requires the manage permission", async () => {
    const bulk = vi.spyOn(WorkerService, "bulkCreate");
    await withServer(async (base) => {
      const response = await post(base, { workers: [] }, "worker:read");
      expect(response.status).toBe(403);
      expect(bulk).not.toHaveBeenCalled();
    });
  });

  it("passes the scoped rows and project to the service", async () => {
    const bulk = vi.spyOn(WorkerService, "bulkCreate").mockResolvedValue({ importedCount: 1, skippedCount: 0, errors: [] });
    await withServer(async (base) => {
      const response = await post(base, { workers: [{ fullName: "A", phone: "0912345678" }], projectId: "p1" });
      expect(response.status).toBe(201);
      expect(await response.json()).toEqual({ importedCount: 1, skippedCount: 0, errors: [] });
      expect(bulk).toHaveBeenCalledWith({ companyCode: "ACME" }, [{ fullName: "A", phone: "0912345678" }], "p1");
    });
  });

  it("records the uploaded spreadsheet after workers are persisted", async () => {
    vi.spyOn(WorkerService, "bulkCreate").mockResolvedValue({ importedCount: 2, skippedCount: 1, errors: [] });
    const record = vi.spyOn(importResourceService, "recordSuccessfulImport").mockResolvedValue({ _id: "run-1" } as any);
    await withServer(async (base) => {
      const response = await post(base, {
        workers: [{ fullName: "A", phone: "0912345678" }],
        importUpload: { uploadToken: "token-1", fileName: "workers.xlsx" },
      });
      expect(response.status).toBe(201);
      expect(record).toHaveBeenCalledWith(
        expect.objectContaining({ companyCode: "ACME", actorId: "user-1" }),
        expect.objectContaining({
          sourceType: "import.worker",
          uploadToken: "token-1",
          fileName: "workers.xlsx",
          importedCount: 2,
          skippedCount: 1,
        }),
      );
    });
  });

  it("rejects a payload that is not a list", async () => {
    const bulk = vi.spyOn(WorkerService, "bulkCreate");
    await withServer(async (base) => {
      const response = await post(base, { workers: "nope" });
      expect(response.status).toBe(400);
      expect(bulk).not.toHaveBeenCalled();
    });
  });

  it("rejects a file larger than the row cap", async () => {
    const bulk = vi.spyOn(WorkerService, "bulkCreate");
    await withServer(async (base) => {
      const response = await post(base, { workers: new Array(2001).fill({ fullName: "A", phone: "0912345678" }) });
      expect(response.status).toBe(400);
      expect((await response.json()).message).toContain("2000");
      expect(bulk).not.toHaveBeenCalled();
    });
  });
});
