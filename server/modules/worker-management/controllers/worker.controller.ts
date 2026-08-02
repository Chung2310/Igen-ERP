import type { Request, Response } from "express";
import { WorkerService, type WorkerScope } from "../services/worker.service";

function scopeFromRequest(req: Request): WorkerScope {
  const user = (req as any).user || {};
  if (!user.companyCode) throw new Error("Company scope is required");
  return { companyCode: user.companyCode, ...(user.branchId ? { branchId: String(user.branchId) } : {}) };
}

export const workerController = {
  list: async (req: Request, res: Response) => res.json({ workers: await WorkerService.list(scopeFromRequest(req)) }),
  create: async (req: Request, res: Response) => res.status(201).json({ worker: await WorkerService.create(scopeFromRequest(req), req.body || {}) }),
  update: async (req: Request, res: Response) => {
    const worker = await WorkerService.update(scopeFromRequest(req), req.params.id, req.body || {});
    return worker ? res.json({ worker }) : res.status(404).json({ message: "Worker not found" });
  },
  delete: async (req: Request, res: Response) => {
    const worker = await WorkerService.delete(scopeFromRequest(req), req.params.id);
    return worker ? res.json({ worker }) : res.status(404).json({ message: "Worker not found" });
  },
};
