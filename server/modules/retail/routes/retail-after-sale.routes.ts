import { Router } from "express";
import { requirePermission } from "../../../middleware/auth";
import { retailAfterSaleController } from "../controllers/retail-after-sale.controller";
import { RETAIL_MANAGER_PERMISSION } from "../permissions";
export const retailAfterSaleRoutes = Router(); const manage = requirePermission(RETAIL_MANAGER_PERMISSION) as any;
const read = requirePermission(["retail:read", RETAIL_MANAGER_PERMISSION]) as any;
retailAfterSaleRoutes.get("/:id", read, retailAfterSaleController.detail as any);
retailAfterSaleRoutes.get("/", read, retailAfterSaleController.list as any);
retailAfterSaleRoutes.post("/", manage, retailAfterSaleController.create as any);

retailAfterSaleRoutes.post("/reconcile", manage, retailAfterSaleController.reconcile as any);

retailAfterSaleRoutes.post("/revoke", manage, retailAfterSaleController.revoke as any);
