import { Router } from "express";
import { requireAuth, requirePermission } from "../middleware/auth";
import { warehouseController } from "../controller/warehouse.controller";
import { validateRequest } from "../middleware/validation";
import {
  listWarehouseSchema,
  getWarehouseSchema,
  createWarehouseSchema,
  updateWarehouseSchema,
  deleteWarehouseSchema,
} from "../validation/warehouse.validation";

export const warehouseRouter = Router();

warehouseRouter.use(requireAuth as any);

warehouseRouter.get(
  "/",
  requirePermission("supply:read") as any,
  validateRequest(listWarehouseSchema),
  warehouseController.list as any
);

warehouseRouter.get(
  "/:id",
  requirePermission("supply:read") as any,
  validateRequest(getWarehouseSchema),
  warehouseController.get as any
);

warehouseRouter.post(
  "/",
  requirePermission("supply:manage") as any,
  validateRequest(createWarehouseSchema),
  warehouseController.create as any
);

warehouseRouter.patch(
  "/:id",
  requirePermission("supply:manage") as any,
  validateRequest(updateWarehouseSchema),
  warehouseController.update as any
);

warehouseRouter.delete(
  "/:id",
  requirePermission("supply:manage") as any,
  validateRequest(deleteWarehouseSchema),
  warehouseController.delete as any
);
