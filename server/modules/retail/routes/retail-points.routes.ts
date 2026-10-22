import { Router } from "express";
import { requirePermission } from "../../../middleware/auth";
import { retailScopeFromRequest } from "../contracts";
import { CustomerModel } from "../../customer-management/models/customer.model";
import { RetailPointLedgerModel } from "../models/retail-point-ledger.model";
import { Types } from "mongoose";
import { adjustCustomerPoints, getPointPolicy, updatePointPolicy } from "../services/retail-points.service";

export const retailPointsRoutes = Router();
const manage = requirePermission("retail-points:manage") as any;
const operate = requirePermission("retail:manage") as any;
const scope = (req: any) => retailScopeFromRequest(req.user || {}, req.query);
const handle = (work: (req: any) => Promise<unknown>) => async (req: any, res: any, next: any) => {
  try { res.json({ success: true, data: await work(req) }); }
  catch (error) { next(error); }
};
retailPointsRoutes.get("/policy", operate, handle((req) => getPointPolicy(scope(req).companyCode)));
retailPointsRoutes.put("/policy", manage, handle((req) => updatePointPolicy(scope(req).companyCode, req.body || {}, String(req.user?.id || ""))));
retailPointsRoutes.get("/customers/search", manage, handle(async (req) => {
  const companyCode = scope(req).companyCode;
  const q = String(req.query.q || "").trim();
  if (q.length < 2 || q.length > 80) return [];
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return CustomerModel.find({ companyCode, status: "active", $or: [{ name: new RegExp(escaped, "i") }, { phone: new RegExp(escaped) }, { customerCode: new RegExp(escaped, "i") }] })
    .select("_id customerCode name phone pointsBalance").limit(10).lean();
}));
retailPointsRoutes.get("/customers/:id", operate, handle(async (req) => {
  if (!Types.ObjectId.isValid(req.params.id)) throw Object.assign(new Error("Khách hàng không hợp lệ."), { status: 400 });
  const companyCode = scope(req).companyCode;
  const customer = await CustomerModel.findOne({ _id: req.params.id, companyCode }).select("pointsBalance totalPointsEarned totalPointsRedeemed").lean();
  if (!customer) throw Object.assign(new Error("Không tìm thấy khách hàng."), { status: 404 });
  return { balance: Number(customer.pointsBalance || 0), totalEarned: Number(customer.totalPointsEarned || 0), totalRedeemed: Number(customer.totalPointsRedeemed || 0),
    ledger: await RetailPointLedgerModel.find({ companyCode, customerId: req.params.id }).sort({ createdAt: -1 }).limit(100).lean() };
}));
retailPointsRoutes.post("/customers/:id/adjust", manage, handle((req) => adjustCustomerPoints(scope(req).companyCode, req.params.id, Number(req.body?.points), String(req.body?.reason || ""), String(req.user?.id || ""), String(req.body?.idempotencyKey || ""))));
