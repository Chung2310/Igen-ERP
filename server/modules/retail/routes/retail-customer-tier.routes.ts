import { Router } from "express";
import { requirePermission } from "../../../middleware/auth";
import { retailCustomerTierController } from "../controllers/retail-customer-tier.controller";
import { RETAIL_MANAGER_PERMISSION, RETAIL_OPERATE_PERMISSION } from "../permissions";

export const retailCustomerTierRoutes = Router();
const operate = requirePermission([RETAIL_OPERATE_PERMISSION, RETAIL_MANAGER_PERMISSION]) as any;
const manage = requirePermission(RETAIL_MANAGER_PERMISSION) as any;
retailCustomerTierRoutes.get("/tier-summary", manage, retailCustomerTierController.tierSummary as any);
retailCustomerTierRoutes.get("/:id/tier-history", operate, retailCustomerTierController.tierHistory as any);
retailCustomerTierRoutes.post("/:id/tier-overrides", manage, retailCustomerTierController.overrideTier as any);
