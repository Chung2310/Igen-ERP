import { Router } from "express";
import { requirePermission } from "../../../middleware/auth";
import { receivableController } from "../controllers/receivable.controller";
import { RECEIVABLE_ADJUST_PERMISSION, RECEIVABLE_COLLECT_PERMISSION, RECEIVABLE_READ_PERMISSION } from "../permissions";

export const FINANCE_RECEIVABLE_ROUTE_PERMISSIONS = {
  "GET /": RECEIVABLE_READ_PERMISSION, "GET /aging": RECEIVABLE_READ_PERMISSION, "GET /by-customer": RECEIVABLE_READ_PERMISSION, "GET /:id": RECEIVABLE_READ_PERMISSION,
  "POST /:id/payments": RECEIVABLE_COLLECT_PERMISSION, "POST /:id/adjustments": RECEIVABLE_ADJUST_PERMISSION,
  "POST /:id/write-off": RECEIVABLE_ADJUST_PERMISSION, "POST /:id/suspend": RECEIVABLE_ADJUST_PERMISSION, "POST /:id/extend": RECEIVABLE_ADJUST_PERMISSION,
  "POST /:id/entries/:entryId/reversal": RECEIVABLE_ADJUST_PERMISSION,
} as const;

export const financeReceivableRoutes = Router();
const read = requirePermission(RECEIVABLE_READ_PERMISSION) as any;
const collect = requirePermission(RECEIVABLE_COLLECT_PERMISSION) as any;
const adjust = requirePermission(RECEIVABLE_ADJUST_PERMISSION) as any;
financeReceivableRoutes.get("/", read, receivableController.list as any);
financeReceivableRoutes.get("/aging", read, receivableController.aging as any);
financeReceivableRoutes.get("/by-customer", read, receivableController.byCustomer as any);
financeReceivableRoutes.get("/:id", read, receivableController.detail as any);
financeReceivableRoutes.post("/:id/payments", collect, receivableController.collect as any);
financeReceivableRoutes.post("/:id/adjustments", adjust, receivableController.adjust as any);
financeReceivableRoutes.post("/:id/write-off", adjust, receivableController.writeOff as any);
financeReceivableRoutes.post("/:id/suspend", adjust, receivableController.suspend as any);
financeReceivableRoutes.post("/:id/extend", adjust, receivableController.extend as any);
financeReceivableRoutes.post("/:id/entries/:entryId/reversal", adjust, receivableController.reverse as any);
