import { Router } from "express";
import { requirePermission } from "../../../middleware/auth";
import { assetInventoryController } from "../controllers/asset-inventory.controller";
import { ASSET_MANAGE_PERMISSION, ASSET_READ_PERMISSION } from "../permissions";

export const FINANCE_ASSET_INVENTORY_ROUTE_PERMISSIONS = {
  "GET /": ASSET_READ_PERMISSION, "GET /:id": ASSET_READ_PERMISSION, "GET /:id/variance": ASSET_READ_PERMISSION,
  "POST /": ASSET_MANAGE_PERMISSION, "POST /:id/counts": ASSET_MANAGE_PERMISSION, "POST /:id/finalize": ASSET_MANAGE_PERMISSION,
} as const;

export const financeAssetInventoryRoutes = Router();
const read = requirePermission(ASSET_READ_PERMISSION) as any;
const manage = requirePermission(ASSET_MANAGE_PERMISSION) as any;
financeAssetInventoryRoutes.get("/", read, assetInventoryController.list as any);
financeAssetInventoryRoutes.get("/:id", read, assetInventoryController.detail as any);
financeAssetInventoryRoutes.get("/:id/variance", read, assetInventoryController.variance as any);
financeAssetInventoryRoutes.post("/", manage, assetInventoryController.open as any);
financeAssetInventoryRoutes.post("/:id/counts", manage, assetInventoryController.count as any);
financeAssetInventoryRoutes.post("/:id/finalize", manage, assetInventoryController.finalize as any);
