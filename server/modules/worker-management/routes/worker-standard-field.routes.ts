import { Router } from "express";
import { requirePermission } from "../../../middleware/auth";
import { WORKER_MANAGE_PERMISSION, WORKER_READ_PERMISSION } from "../permissions";
import { workerScopeFromActor } from "../contracts";
import { getWorkerStandardFields, setWorkerStandardFields } from "../services/worker-standard-field.service";
export const workerStandardFieldRoutes = Router();
workerStandardFieldRoutes.get("/", requirePermission(WORKER_READ_PERMISSION) as any, async (req: any, res) => { try { res.json({ data: await getWorkerStandardFields(workerScopeFromActor(req.user || {}), String(req.query.moduleKey || "workers")) }); } catch (e) { res.status(500).json({ error: e instanceof Error ? e.message : "Unable to load standard fields" }); } });
workerStandardFieldRoutes.put("/", requirePermission(WORKER_MANAGE_PERMISSION) as any, async (req: any, res) => { try { const fields = Array.isArray(req.body?.fields) ? req.body.fields : []; res.json({ data: await setWorkerStandardFields(workerScopeFromActor(req.user || {}), String(req.body?.moduleKey || "workers"), fields) }); } catch (e) { res.status(400).json({ error: e instanceof Error ? e.message : "Unable to save standard fields" }); } });
