import { financeTreasuryService as treasury } from "../services/finance-treasury.service";
﻿import { Router } from "express";
import { requirePermission } from "../../../middleware/auth";
import { financeScopeFromRequest, requireFinanceBranch } from "../contracts";
import { financialReportingService as service } from "../services/financial-reporting.service";
export const financialReportingRoutes = Router();
const read = requirePermission(["finance-wallet:read", "finance-wallet:manage"]) as any;
const manage = requirePermission("finance-wallet:manage") as any;
const route = (fn: (scope: any, req: any, actor: string) => Promise<any>) => async (req: any, res: any, next: any) => {
  try { const scope = requireFinanceBranch(financeScopeFromRequest(req.user || {}, req.query)); res.json({ success: true, data: await fn(scope, req, String(req.user?.id || "")) }); }
  catch (error: any) { if (error.code === 11000) return res.status(409).json({ message: "Chứng từ đã tồn tại hoặc phiên bản đã thay đổi. Vui lòng tải lại." }); next(error); }
};
financialReportingRoutes.get("/debts", read, route((s, r) => service.debts(s, r.query)));
financialReportingRoutes.post("/debts", manage, route((s, r, a) => service.createDebt(s, r.body, a)));
financialReportingRoutes.post("/debts/:id/payments", manage, route((s, r, a) => service.payDebt(s, r.params.id, r.body, a)));
financialReportingRoutes.get("/vat", read, route((s, r) => service.vat(s, r.query)));
financialReportingRoutes.post("/vat/invoices", manage, route((s, r, a) => service.createInvoice(s, r.body, a)));
financialReportingRoutes.put("/vat/period", manage, route((s, r, a) => service.saveVatPeriod(s, r.body, a)));
financialReportingRoutes.get("/profit", read, route((s, r) => service.profit(s, r.query)));
financialReportingRoutes.post("/expenses", manage, route((s, r, a) => service.createExpense(s, r.body, a)));
financialReportingRoutes.get("/breakeven", read, route((s, r) => service.breakeven(s, String(r.query.month || ""))));
financialReportingRoutes.put("/plan", manage, route((s, r, a) => service.savePlan(s, r.body, a)));

financialReportingRoutes.get("/treasury", read, route((s, r) => treasury.overview(s, r.query)));
financialReportingRoutes.post("/treasury/accounts", manage, route((s, r, a) => treasury.createAccount(s, r.body, a)));
financialReportingRoutes.post("/treasury/vouchers", manage, route((s, r, a) => treasury.createVoucher(s, r.body, a)));
financialReportingRoutes.post("/treasury/vouchers/:id/decision", manage, route((s, r, a) => treasury.decide(s, r.params.id, r.body, a)));
financialReportingRoutes.post("/treasury/reconciliations", manage, route((s, r, a) => treasury.reconcile(s, r.body, a)));
financialReportingRoutes.post("/treasury/bank-lines", manage, route((s, r, a) => treasury.bankLine(s, r.body, a)));
financialReportingRoutes.post("/treasury/bank-lines/:id/match", manage, route((s, r, a) => treasury.matchBankLine(s, r.params.id, r.body, a)));
financialReportingRoutes.post("/treasury/periods", manage, route((s, r, a) => treasury.period(s, r.body, a)));

financialReportingRoutes.get("/documents/:source/:id", read, route((s, r) => service.document(s, r.params.source, r.params.id)));
