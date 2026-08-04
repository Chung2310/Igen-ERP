import type { Request, Response } from "express";
import { workerScopeFromActor } from "../contracts";
import { WorkerService } from "../services/worker.service";

export const workerController = {
  list: async (req: Request, res: Response) => res.json({ workers: await WorkerService.list(workerScopeFromActor((req as any).user || {})) }),
  create: async (req: Request, res: Response) => res.status(201).json({ worker: await WorkerService.create(workerScopeFromActor((req as any).user || {}), req.body || {}) }),
  update: async (req: Request, res: Response) => {
    const worker = await WorkerService.update(workerScopeFromActor((req as any).user || {}), req.params.id, req.body || {});
    return worker ? res.json({ worker }) : res.status(404).json({ message: "Worker not found" });
  },
  delete: async (req: Request, res: Response) => {
    const worker = await WorkerService.delete(workerScopeFromActor((req as any).user || {}), req.params.id);
    return worker ? res.json({ worker }) : res.status(404).json({ message: "Worker not found" });
  },
};