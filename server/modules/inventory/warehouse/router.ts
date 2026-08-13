import { Router } from "express";
import { requirePermission } from "../../../middleware/auth";
import { warehouseController } from "./warehouse.controller";

export const warehouseRouter = Router();
warehouseRouter.get("/", requirePermission("stock:read") as any, warehouseController.list as any);
warehouseRouter.get("/balances", requirePermission("stock:read") as any, warehouseController.balances as any);
warehouseRouter.patch("/balances/:id/thresholds", requirePermission("stock:manage") as any, warehouseController.updateThresholds as any);
