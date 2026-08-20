import { Router } from "express";
import { requirePermission } from "../../../middleware/auth";
import { serialUnitController } from "./serial-unit.controller";

export const serialUnitRouter = Router();
serialUnitRouter.get("/", requirePermission("inventory:read") as any, serialUnitController.list as any);
serialUnitRouter.get("/:id/history", requirePermission("inventory:read") as any, serialUnitController.history as any);
serialUnitRouter.get("/:id", requirePermission("inventory:read") as any, serialUnitController.detail as any);
serialUnitRouter.post("/", requirePermission("inventory:manage") as any, serialUnitController.create as any);
serialUnitRouter.post("/:id/transition", requirePermission("inventory:manage") as any, serialUnitController.transition as any);
serialUnitRouter.post("/:id/transfer", requirePermission("inventory:manage") as any, serialUnitController.transfer as any);
serialUnitRouter.post("/:id/transfer/request", requirePermission("inventory:manage") as any, serialUnitController.requestTransfer as any);
serialUnitRouter.post("/:id/transfer/accept", requirePermission("inventory:manage") as any, serialUnitController.acceptTransfer as any);
serialUnitRouter.post("/:id/transfer/cancel", requirePermission("inventory:manage") as any, serialUnitController.cancelTransfer as any);
