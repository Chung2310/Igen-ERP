import { once } from "node:events";
import http from "node:http";
import express from "express";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../middleware/auth", async (importOriginal) => {
  const original = await importOriginal<typeof import("../middleware/auth")>();
  return {
    ...original,
    requirePermission: () => (_req: any, _res: any, next: any) => next(),
  };
});

import { WorkerService } from "../modules/worker-management/services/worker.service";
import { workerManagementRouter } from "../modules/worker-management/router";

afterEach(() => vi.restoreAllMocks());

describe("worker management API wiring", () => {
  it("serves real worker CRUD routing at the client-required prefix", async () => {
    vi.spyOn(WorkerService, "list").mockResolvedValue([] as any);
    const app = express();
    app.use(express.json());
    app.use((req: any, _res, next) => {
      req.user = { role: "admin", companyCode: "ACME", branchId: "branch-1" };
      next();
    });
    app.use("/api/v1", workerManagementRouter);
    const server = http.createServer(app);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Test server did not start");
    }

    try {
      const response = await fetch(
        `http://127.0.0.1:${address.port}/api/v1/worker-management/workers?companyCode=ACME&branchId=branch-1`,
      );
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ workers: [] });
      expect(WorkerService.list).toHaveBeenCalledWith({
        companyCode: "ACME",
        branchId: "branch-1",
      });
    } finally {
      server.close();
      await once(server, "close");
    }
  });
});
