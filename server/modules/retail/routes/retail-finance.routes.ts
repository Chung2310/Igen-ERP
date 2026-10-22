import { Router } from "express";
import { Types } from "mongoose";
import { requirePermission } from "../../../middleware/auth";
import { requireRetailBranch, retailScopeFromRequest } from "../contracts";
import { listCashbook, createCashVoucher, closeCashPeriod, reconcileCashPeriod, assertCashRange } from "../services/retail-cashbook.service";
import { retailProfitReport } from "../services/retail-profit.service";
import { RetailCommissionPolicyModel, RetailCommissionLedgerModel } from "../models/retail-commission.model";
import { RetailPartnerModel } from "../models/retail-partner.model";
import { partnerStatement, payPartnerCommission, reconcilePartnerCommission } from "../services/retail-commission.service";

export const retailFinanceRoutes = Router();
const manage = requirePermission("retail:manage") as any;
const partnerManage = requirePermission("retail-partner-policy:manage") as any;
const payoutManage = requirePermission("retail-partner-payout:manage") as any;
const selfRead = requirePermission(["retail-partner-self:read", "retail-partner-self:manage"]) as any;
const scope = (req: any) => requireRetailBranch(retailScopeFromRequest(req.user || {}, req.query));
const dates = (req: any) => ({ from: String(req.query.from || req.body?.from || ""), to: String(req.query.to || req.body?.to || "") });
const handle = (run: (req: any) => Promise<unknown>) => async (req: any, res: any, next: any) => { try { res.json({ success: true, data: await run(req) }); } catch (error) { next(error); } };
const bad = (message: string, status = 400) => Object.assign(new Error(message), { status });

retailFinanceRoutes.get("/cashbook", manage, handle((req) => { const { from, to } = dates(req); return listCashbook(scope(req), from, to); }));
retailFinanceRoutes.post("/cashbook/vouchers", manage, handle((req) => createCashVoucher(scope(req), req.body || {}, String(req.user.id))));
retailFinanceRoutes.post("/cashbook/close", manage, handle((req) => { const { from, to } = dates(req); return closeCashPeriod(scope(req), from, to, String(req.user.id)); }));
retailFinanceRoutes.get("/cashbook/reconcile", manage, handle((req) => { const { from, to } = dates(req); return reconcileCashPeriod(scope(req), from, to); }));
retailFinanceRoutes.get("/profit", manage, handle((req) => { const { from, to } = dates(req); return retailProfitReport(scope(req), from, to, req.query); }));

retailFinanceRoutes.get("/commission/policies", partnerManage, handle((req) => RetailCommissionPolicyModel.find({ companyCode: scope(req).companyCode }).sort({ partnerId: 1, kind: 1, sku: 1 }).lean()));
retailFinanceRoutes.put("/commission/policies", partnerManage, handle(async (req) => {
  const branch = scope(req), partnerId = String(req.body?.partnerId || ""), kind = String(req.body?.kind || ""), sku = kind === "repair" ? "*" : String(req.body?.sku || "*").trim().toUpperCase(), ratePercent = Number(req.body?.ratePercent);
  if (!Types.ObjectId.isValid(partnerId) || !await RetailPartnerModel.exists({ companyCode: branch.companyCode, _id: partnerId, roles: "collaborator" })) throw bad("CTV không hợp lệ.");
  if (!["sale", "repair"].includes(kind) || !sku || !Number.isFinite(ratePercent) || ratePercent < 0 || ratePercent > 100) throw bad("Chính sách hoa hồng không hợp lệ.");
  const effectiveFrom = new Date(`${String(req.body.effectiveFrom || "")}T00:00:00.000Z`);
  if (Number.isNaN(effectiveFrom.valueOf())) throw bad("Ngày hiệu lực không hợp lệ.");
  const filter = { companyCode: branch.companyCode, partnerId, kind: kind as "sale" | "repair", sku };
  return RetailCommissionPolicyModel.findOneAndUpdate(filter, { $set: { ratePercent, effectiveFrom, active: req.body.active !== false, updatedBy: String(req.user.id), updatedAt: new Date() }, $inc: { version: 1 }, $setOnInsert: filter }, { upsert: true, returnDocument: "after" }).lean();
}));
retailFinanceRoutes.post("/commission/partners/:id/reconcile", partnerManage, handle((req) => reconcilePartnerCommission(scope(req), req.params.id)));
retailFinanceRoutes.get("/commission/partners/:id/statement", partnerManage, handle(async (req) => { const branch = scope(req); const { from, to } = dates(req); if (!await RetailPartnerModel.exists({ companyCode: branch.companyCode, _id: req.params.id, roles: "collaborator" })) throw bad("CTV không hợp lệ.", 404); return partnerStatement(branch.companyCode, req.params.id, from, to); }));
retailFinanceRoutes.post("/commission/partners/:id/payouts", payoutManage, handle((req) => payPartnerCommission(scope(req), req.params.id, req.body || {}, String(req.user.id))));
retailFinanceRoutes.get("/commission/me", selfRead, handle(async (req) => { const branch = scope(req); const partner = await RetailPartnerModel.findOne({ companyCode: branch.companyCode, userId: String(req.user.id), roles: "collaborator", status: "active" }).lean(); if (!partner) throw bad("Tài khoản chưa liên kết với CTV.", 404); const { from, to } = dates(req); return { partner: { code: partner.code, name: partner.name }, ...await partnerStatement(branch.companyCode, String(partner._id), from, to) }; }));
retailFinanceRoutes.get("/commission/kpi", partnerManage, handle(async (req) => { const branch = scope(req), { from, to } = dates(req); assertCashRange(from, to); const items = await RetailCommissionLedgerModel.aggregate([{ $match: { companyCode: branch.companyCode, branchId: branch.branchId, businessDate: { $gte: from, $lte: to } } }, { $group: { _id: "$partnerId", commission: { $sum: "$amount" }, sources: { $sum: 1 } } }, { $sort: { commission: -1 } }]); return items; }));
