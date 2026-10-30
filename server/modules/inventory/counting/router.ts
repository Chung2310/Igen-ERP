import { Router } from "express";
import { requirePermission } from "../../../middleware/auth";
import { inventoryCountController } from "./inventory-count.controller";
export const inventoryCountRouter = Router();
inventoryCountRouter.get("/", requirePermission("inventory:read") as any, inventoryCountController.list as any);
inventoryCountRouter.get("/:id", requirePermission("inventory:read") as any, inventoryCountController.get as any);
inventoryCountRouter.post("/", requirePermission("inventory:manage") as any, inventoryCountController.create as any);
inventoryCountRouter.patch("/:id/items/:itemId", requirePermission("inventory:manage") as any, inventoryCountController.updateItem as any);
inventoryCountRouter.post("/:id/scan", requirePermission("inventory:manage") as any, inventoryCountController.scan as any);
inventoryCountRouter.post("/:id/start", requirePermission("inventory:manage") as any, inventoryCountController.start as any);
inventoryCountRouter.post("/:id/submit", requirePermission("inventory:manage") as any, inventoryCountController.submit as any);
inventoryCountRouter.post("/:id/cancel", requirePermission("inventory:manage") as any, inventoryCountController.cancel as any);
inventoryCountRouter.post("/:id/approve", requirePermission("inventory-count-approval:manage") as any, inventoryCountController.approve as any);
inventoryCountRouter.post("/:id/recreate", requirePermission("inventory:manage") as any, inventoryCountController.recreate as any);

inventoryCountRouter.post("/:id/items/:itemId/reconcile", requirePermission("inventory:manage") as any, inventoryCountController.reconcileItem as any);

inventoryCountRouter.post("/:id/items/:itemId/revoke-request", requirePermission("inventory:manage") as any, inventoryCountController.revokeItemRequest as any);
