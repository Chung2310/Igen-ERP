import { Router } from "express";
import { requirePermission } from "../../../middleware/auth";
import { validate } from "../middlewares/validate.middleware";
import { WorkerLaborContractController } from "../controllers/worker-labor-contract.controller";
import { WORKER_MANAGE_PERMISSION, WORKER_READ_PERMISSION } from "../permissions";
import {
  idParamSchema,
  createWorkerLaborContractSchema,
  updateWorkerLaborContractSchema,
  renewWorkerLaborContractSchema,
} from "../validations/worker-labor-contract.validation";

export const workerLaborContractRoutes = Router();

const canRead = () =>
  requirePermission([WORKER_READ_PERMISSION, WORKER_MANAGE_PERMISSION]) as any;
const canManage = () => requirePermission(WORKER_MANAGE_PERMISSION) as any;

workerLaborContractRoutes.get(
  "/",
  canRead(),
  WorkerLaborContractController.getList as any,
);

workerLaborContractRoutes.get(
  "/expiring-summary",
  canRead(),
  WorkerLaborContractController.getExpiringSummary as any,
);

workerLaborContractRoutes.get(
  "/:id",
  canRead(),
  validate(idParamSchema, "params"),
  WorkerLaborContractController.getDetail as any,
);

workerLaborContractRoutes.get(
  "/:id/history",
  canRead(),
  validate(idParamSchema, "params"),
  WorkerLaborContractController.getHistory as any,
);

workerLaborContractRoutes.post(
  "/",
  canManage(),
  validate(createWorkerLaborContractSchema),
  WorkerLaborContractController.create as any,
);

workerLaborContractRoutes.patch(
  "/:id",
  canManage(),
  validate(idParamSchema, "params"),
  validate(updateWorkerLaborContractSchema),
  WorkerLaborContractController.update as any,
);

workerLaborContractRoutes.post(
  "/:id/renew",
  canManage(),
  validate(idParamSchema, "params"),
  validate(renewWorkerLaborContractSchema),
  WorkerLaborContractController.renew as any,
);

workerLaborContractRoutes.delete(
  "/:id",
  canManage(),
  validate(idParamSchema, "params"),
  WorkerLaborContractController.delete as any,
);
