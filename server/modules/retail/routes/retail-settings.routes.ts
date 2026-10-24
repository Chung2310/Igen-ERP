import { Router } from "express";
import { requirePermission } from "../../../middleware/auth";
import { retailSettingsController } from "../controllers/retail-settings.controller";
import { RETAIL_MANAGER_PERMISSION, RETAIL_OPERATE_PERMISSION } from "../permissions";

export const retailSettingsRoutes = Router();
retailSettingsRoutes.get("/", requirePermission(["retail:read", RETAIL_MANAGER_PERMISSION]) as any, retailSettingsController.get as any);
retailSettingsRoutes.get("/print", requirePermission(["retail:read", RETAIL_OPERATE_PERMISSION, RETAIL_MANAGER_PERMISSION]) as any, retailSettingsController.printConfig as any);
retailSettingsRoutes.put("/", requirePermission(RETAIL_MANAGER_PERMISSION) as any, retailSettingsController.update as any);
