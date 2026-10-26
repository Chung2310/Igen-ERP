import { Router } from "express";
import type { Request, Response } from "express";
import { requireAuth, requirePermission } from "../../../middleware/auth";
import { requireModule } from "../../../middleware/require-module";
import { requireRetailBranch, retailScopeFromRequest } from "../contracts";
import { RETAIL_MANAGER_PERMISSION, RETAIL_OPERATE_PERMISSION } from "../permissions";
import { retailBirthdayProgramService } from "../services/retail-birthday-coupon.service";
import { retailCouponAutomationService, issueCouponAutomations } from "../services/retail-coupon-automation.service";
import { getPromotionCustomer } from "../../customer-management/contracts";
import { retailCouponService } from "../services/retail-coupon.service";

export const retailCouponRoutes = Router();
const operate = requirePermission([RETAIL_OPERATE_PERMISSION, RETAIL_MANAGER_PERMISSION]) as any;
const manage = requirePermission(RETAIL_MANAGER_PERMISSION) as any;
retailCouponRoutes.use(requireAuth as any, requireModule("retail"));
retailCouponRoutes.get("/selectable", operate, async (req: Request, res: Response) => {
  try {
    const scope = requireRetailBranch(retailScopeFromRequest((req as any).user || {}, req.query));
    if (req.query.customerId) {
      const customer = await getPromotionCustomer(scope.companyCode, req.query.customerId);
      if (!customer) throw new Error("Khách hàng không tồn tại hoặc đã ngừng hoạt động.");
      await issueCouponAutomations(scope, new Date(), String(customer._id));
    }
    res.json({ success: true, data: await retailCouponService.selectable(scope, req.query.customerId) });
  } catch (error: any) { res.status(error.status || 400).json({ success: false, error: error.message }); }
});
retailCouponRoutes.get("/tiers", operate, async (req: Request, res: Response) => {
  try {
    const scope = requireRetailBranch(retailScopeFromRequest((req as any).user || {}, req.query));
    res.json({ success: true, data: await retailCouponService.tiers(scope) });
  } catch (error: any) { res.status(error.status || 400).json({ success: false, error: error.message }); }
});
retailCouponRoutes.get("/available", operate, async (req: Request, res: Response) => {
  try {
    const scope = requireRetailBranch(retailScopeFromRequest((req as any).user || {}, req.query));
    const customer = await getPromotionCustomer(scope.companyCode, req.query.customerId);
    if (!customer) throw new Error("Khách hàng không tồn tại hoặc đã ngừng hoạt động.");
    await issueCouponAutomations(scope, new Date(), String(customer._id));
    res.json({ success: true, data: await retailCouponService.available(scope, String(customer._id)) });
  } catch (error: any) { res.status(error.status || 400).json({ success: false, error: error.message }); }
});
for (const method of ["get", "post", "put"] as const) {
  retailCouponRoutes[method](method === "put" ? "/automations/:id" : "/automations", manage, async (req: Request, res: Response) => {
    try {
      const actor = (req as any).user || {};
      const scope = requireRetailBranch(retailScopeFromRequest(actor, req.query));
      const actorId = String(actor.id || actor.uid || "");
      const data = method === "get" ? await retailCouponAutomationService.list(scope)
        : method === "post" ? await retailCouponAutomationService.create(scope, req.body || {}, actorId)
        : await retailCouponAutomationService.update(scope, req.params.id, req.body || {}, actorId);
      res.status(method === "post" ? 201 : 200).json({ success: true, data });
    } catch (error: any) { res.status(error.status || 400).json({ success: false, error: error.message }); }
  });
}
for (const method of ["get", "put"] as const) {
  retailCouponRoutes[method]("/birthday-program", manage, async (req: Request, res: Response) => {
    try {
      const actor = (req as any).user || {};
      const scope = requireRetailBranch(retailScopeFromRequest(actor, req.query));
      const data = method === "get" ? await retailBirthdayProgramService.get(scope)
        : await retailBirthdayProgramService.save(scope, req.body || {}, String(actor.id || actor.uid || ""));
      res.json({ success: true, data });
    } catch (error: any) { res.status(error.status || 400).json({ success: false, error: error.message }); }
  });
}
for (const method of ["get", "post", "put"] as const) {
  retailCouponRoutes[method](method === "put" ? "/:id" : "/", manage, async (req: Request, res: Response) => {
    try {
      const actor = (req as any).user || {};
      const scope = requireRetailBranch(retailScopeFromRequest(actor, req.query));
      const actorId = String(actor.id || actor.uid || "");
      const data = method === "get" ? await retailCouponService.list(scope, req.query.page)
        : method === "post" ? await retailCouponService.create(scope, req.body || {}, actorId)
        : await retailCouponService.update(scope, req.params.id, req.body || {}, actorId);
      res.status(method === "post" ? 201 : 200).json({ success: true, data });
    } catch (error: any) {
      res.status(error.code === 11000 ? 409 : error.status || 400).json({ success: false, error: error.code === 11000 ? "Mã ưu đãi đã tồn tại tại chi nhánh này." : error.message });
    }
  });
}
