import { Router } from "express";
import { requirePermission } from "../../../middleware/auth";
import { WORKER_READ_PERMISSION } from "../permissions";
import { workerScopeFromActor } from "../contracts";
import { getWorkerDashboard } from "../services/worker-dashboard.service";

export const workerDashboardRoutes = Router();
workerDashboardRoutes.get("/", requirePermission(WORKER_READ_PERMISSION) as any, async (req: any, res) => {
  try { res.json({ data: await getWorkerDashboard(workerScopeFromActor(req.user || {})) }); }
  catch (error) { res.status(500).json({ error: error instanceof Error ? error.message : "Unable to load worker dashboard" }); }
});
