import { Router } from "express";
import { requirePermission } from "../../../middleware/auth";
import { validate } from "../middlewares/validate.middleware";
import { WorkerProjectController } from "../controllers/worker-project.controller";
import { WORKER_MANAGE_PERMISSION, WORKER_READ_PERMISSION } from "../permissions";
import {
  idParamSchema,
  workerIdParamSchema,
  createWorkerProjectSchema,
  updateWorkerProjectSchema,
  addWorkerSchema,
} from "../validations/worker-project.validation";

export const workerProjectRoutes = Router();

workerProjectRoutes.get(
  "/",
  requirePermission([WORKER_READ_PERMISSION, WORKER_MANAGE_PERMISSION]) as any,
  WorkerProjectController.getList as any
);

workerProjectRoutes.get(
  "/:id",
  requirePermission([WORKER_READ_PERMISSION, WORKER_MANAGE_PERMISSION]) as any,
  validate(idParamSchema, "params"),
  WorkerProjectController.getDetail as any
);

workerProjectRoutes.post(
  "/",
  requirePermission(WORKER_MANAGE_PERMISSION) as any,
  validate(createWorkerProjectSchema),
  WorkerProjectController.create as any
);

workerProjectRoutes.patch(
  "/:id",
  requirePermission(WORKER_MANAGE_PERMISSION) as any,
  validate(idParamSchema, "params"),
  validate(updateWorkerProjectSchema),
  WorkerProjectController.update as any
);

workerProjectRoutes.delete(
  "/:id",
  requirePermission(WORKER_MANAGE_PERMISSION) as any,
  validate(idParamSchema, "params"),
  WorkerProjectController.delete as any
);

workerProjectRoutes.post(
  "/:id/workers",
  requirePermission(WORKER_MANAGE_PERMISSION) as any,
  validate(idParamSchema, "params"),
  validate(addWorkerSchema),
  WorkerProjectController.addWorker as any
);

workerProjectRoutes.delete(
  "/:id/workers/:workerId",
  requirePermission(WORKER_MANAGE_PERMISSION) as any,
  validate(workerIdParamSchema, "params"),
  WorkerProjectController.removeWorker as any
);
