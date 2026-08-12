import { Router } from "express";
import { requirePermission } from "../../../middleware/auth";
import { retailCustomerController } from "../controllers/retail-customer.controller";
import { RETAIL_MANAGER_PERMISSION, RETAIL_OPERATE_PERMISSION } from "../permissions";

export const retailCustomerRoutes = Router();
const operate = requirePermission([RETAIL_OPERATE_PERMISSION, RETAIL_MANAGER_PERMISSION]) as any;
const manage = requirePermission(RETAIL_MANAGER_PERMISSION) as any;
retailCustomerRoutes.get("/", operate, retailCustomerController.list as any);
retailCustomerRoutes.post("/", operate, retailCustomerController.create as any);
retailCustomerRoutes.get("/tier-summary", manage, retailCustomerController.tierSummary as any);
retailCustomerRoutes.get("/:id/tier-history", operate, retailCustomerController.tierHistory as any);
retailCustomerRoutes.post("/:id/tier-overrides", manage, retailCustomerController.overrideTier as any);
retailCustomerRoutes.get("/:id", operate, retailCustomerController.detail as any);
retailCustomerRoutes.patch("/:id", operate, retailCustomerController.update as any);
