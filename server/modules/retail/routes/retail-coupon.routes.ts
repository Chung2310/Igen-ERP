import { Router } from "express";
import { requirePermission } from "../../../middleware/auth";
import { requireRetailBranch, retailScopeFromRequest } from "../contracts";
import { RetailCouponService } from "../services/retail-coupon.service";
import { RetailCouponAutomationService, issueCouponAutomations } from "../services/retail-coupon-automation.service";
import { Types } from "mongoose";

export const retailCouponRoutes = Router();
const manage = requirePermission("retail-coupon:manage") as any;
const operate = requirePermission("retail:manage") as any;
const scope = (req: any) => requireRetailBranch(retailScopeFromRequest(req.user || {}, req.query));
const actorId = (req: any) => String(req.user?.id || "");
const handle = (work: (req: any) => Promise<unknown>, created = false) => async (req: any, res: any, next: any) => {
  try { res.status(created ? 201 : 200).json({ success: true, data: await work(req) }); }
  catch (error: any) {
    if (error?.code === 11000) return res.status(409).json({ success: false, error: "Mã ưu đãi đã tồn tại tại chi nhánh này." });
    next(error);
  }
};
retailCouponRoutes.get("/available", operate, handle(async (req) => {
  const branch = scope(req);
  const customerId = String(req.query.customerId || "");
  if (customerId && !Types.ObjectId.isValid(customerId)) throw Object.assign(new Error("Khách hàng không hợp lệ."), { status: 400 });
  if (customerId) await issueCouponAutomations(branch, new Date(), customerId);
  return RetailCouponService.available(branch, customerId);
}));
retailCouponRoutes.get("/automations", manage, handle((req) => RetailCouponAutomationService.list(scope(req))));
retailCouponRoutes.post("/automations", manage, handle((req) => RetailCouponAutomationService.create(scope(req), req.body || {}, actorId(req)), true));
retailCouponRoutes.put("/automations/:id", manage, handle((req) => RetailCouponAutomationService.update(scope(req), req.params.id, req.body || {}, actorId(req))));
retailCouponRoutes.get("/", manage, handle((req) => RetailCouponService.list(scope(req))));
retailCouponRoutes.post("/", manage, handle((req) => RetailCouponService.create(scope(req), req.body || {}, actorId(req)), true));
retailCouponRoutes.put("/:id", manage, handle((req) => RetailCouponService.update(scope(req), req.params.id, req.body || {}, actorId(req))));
