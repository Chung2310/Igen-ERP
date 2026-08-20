import { Router } from "express";
import { requirePermission } from "../../../middleware/auth";
import { assetController } from "../controllers/asset.controller";
import { ASSET_MANAGE_PERMISSION, ASSET_READ_PERMISSION } from "../permissions";

export const FINANCE_ASSET_ROUTE_PERMISSIONS = {
  "GET /": ASSET_READ_PERMISSION, "GET /depreciations": ASSET_READ_PERMISSION, "GET /:id": ASSET_READ_PERMISSION, "GET /:id/schedule": ASSET_READ_PERMISSION,
  "POST /": ASSET_MANAGE_PERMISSION, "PATCH /:id": ASSET_MANAGE_PERMISSION, "POST /:id/transfer": ASSET_MANAGE_PERMISSION, "POST /:id/disposal": ASSET_MANAGE_PERMISSION,
  "POST /depreciations/run": ASSET_MANAGE_PERMISSION, "POST /depreciations/post": ASSET_MANAGE_PERMISSION,
} as const;

export const financeAssetRoutes = Router();
const read = requirePermission(ASSET_READ_PERMISSION) as any;
const manage = requirePermission(ASSET_MANAGE_PERMISSION) as any;
financeAssetRoutes.get("/", read, assetController.list as any);
financeAssetRoutes.get("/depreciations", read, assetController.listDepreciations as any);
financeAssetRoutes.get("/:id", read, assetController.detail as any);
financeAssetRoutes.get("/:id/schedule", read, assetController.schedule as any);
financeAssetRoutes.post("/", manage, assetController.create as any);
financeAssetRoutes.patch("/:id", manage, assetController.update as any);
financeAssetRoutes.post("/:id/transfer", manage, assetController.transfer as any);
financeAssetRoutes.post("/:id/disposal", manage, assetController.dispose as any);
financeAssetRoutes.post("/depreciations/run", manage, assetController.runDepreciation as any);
financeAssetRoutes.post("/depreciations/post", manage, assetController.postDepreciation as any);
