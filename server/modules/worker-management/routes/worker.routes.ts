import { Router } from "express";
import { requirePermission } from "../../../middleware/auth";
import { workerController } from "../controllers/worker.controller";
import { WORKER_MANAGE_PERMISSION, WORKER_READ_PERMISSION } from "../permissions";

export const workerRoutes = Router();
workerRoutes.get("/", requirePermission([WORKER_READ_PERMISSION, WORKER_MANAGE_PERMISSION]) as any, workerController.list as any);
workerRoutes.post("/", requirePermission(WORKER_MANAGE_PERMISSION) as any, workerController.create as any);
workerRoutes.post("/bulk", requirePermission(WORKER_MANAGE_PERMISSION) as any, workerController.bulkCreate as any);
workerRoutes.patch("/:id", requirePermission(WORKER_MANAGE_PERMISSION) as any, workerController.update as any);
workerRoutes.delete("/:id", requirePermission(WORKER_MANAGE_PERMISSION) as any, workerController.delete as any);
