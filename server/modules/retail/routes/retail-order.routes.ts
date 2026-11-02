import { Router } from "express";
import { requirePermission } from "../../../middleware/auth";
import { retailOrderController } from "../controllers/retail-order.controller";
import { retailSePayController } from "../controllers/retail-sepay.controller";
import { RETAIL_MANAGER_PERMISSION, RETAIL_OPERATE_PERMISSION } from "../permissions";
export const retailOrderRoutes = Router(); const operate = requirePermission([RETAIL_OPERATE_PERMISSION, RETAIL_MANAGER_PERMISSION]) as any;
const manage = requirePermission(RETAIL_MANAGER_PERMISSION) as any;
const read = requirePermission(["retail:read", RETAIL_MANAGER_PERMISSION]) as any;
const paymentAccess = requirePermission(["retail:read", RETAIL_OPERATE_PERMISSION, RETAIL_MANAGER_PERMISSION]) as any;
retailOrderRoutes.post("/checkout/reconcile", operate, retailOrderController.reconcileCheckout as any);
retailOrderRoutes.post("/checkout/revoke", operate, retailOrderController.revokeCheckout as any);
retailOrderRoutes.post("/checkout", operate, retailOrderController.checkout as any);
retailOrderRoutes.post("/draft-requests/reconcile", operate, retailOrderController.reconcileDraftRequest as any);
retailOrderRoutes.post("/draft-requests/revoke", operate, retailOrderController.revokeDraftRequest as any);
retailOrderRoutes.post("/quote", operate, retailOrderController.quote as any);
retailOrderRoutes.get("/products", operate, retailOrderController.products as any);
retailOrderRoutes.get("/categories", operate, retailOrderController.categories as any);
retailOrderRoutes.get("/serials", operate, retailOrderController.saleSerials as any);
retailOrderRoutes.get("/idempotency/:key", manage, retailOrderController.idempotency as any);
retailOrderRoutes.get("/", operate, retailOrderController.list as any);
retailOrderRoutes.post("/", operate, retailOrderController.create as any);
retailOrderRoutes.get("/:id", read, retailOrderController.detail as any);
retailOrderRoutes.get("/:id/payment-status", paymentAccess, retailOrderController.paymentStatus as any);
retailOrderRoutes.get("/:id/payment-qr", paymentAccess, retailSePayController.qr as any);
retailOrderRoutes.patch("/:id", operate, retailOrderController.update as any);
retailOrderRoutes.post("/:id/confirm", operate, retailOrderController.confirm as any);
retailOrderRoutes.post("/:id/payments", manage, retailOrderController.collect as any);
retailOrderRoutes.post("/:id/cancel", manage, retailOrderController.cancel as any);
retailOrderRoutes.delete("/:id", manage, retailOrderController.deleteCancelled as any);

retailOrderRoutes.post("/:id/payments/reconcile", manage, retailOrderController.reconcileCollection as any);

retailOrderRoutes.post("/:id/payments/revoke", manage, retailOrderController.revokeCollection as any);

retailOrderRoutes.post("/:id/cancel/reconcile", manage, retailOrderController.reconcileCancellation as any);

retailOrderRoutes.post("/:id/cancel/revoke", manage, retailOrderController.revokeCancellation as any);
