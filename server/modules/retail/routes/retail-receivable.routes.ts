import { Router } from "express";
import { requirePermission } from "../../../middleware/auth";
import { retailReceivableController } from "../controllers/retail-receivable.controller";
import { RETAIL_MANAGER_PERMISSION, RETAIL_OPERATE_PERMISSION } from "../permissions";

export const retailReceivableRoutes = Router();
const operate = requirePermission([RETAIL_OPERATE_PERMISSION, RETAIL_MANAGER_PERMISSION]) as any;
const manage = requirePermission([RETAIL_MANAGER_PERMISSION]) as any;
retailReceivableRoutes.get("/customers/:customerId", operate, retailReceivableController.history as any);
retailReceivableRoutes.post("/adjustments", manage, retailReceivableController.adjustment as any);
retailReceivableRoutes.get("/reconciliations/latest", manage, retailReceivableController.latestReconciliation as any);
retailReceivableRoutes.post("/reconciliations", manage, retailReceivableController.reconcile as any);
retailReceivableRoutes.post("/:entryId/reversal", manage, retailReceivableController.reversal as any);
