import { Router } from "express";
import { requirePermission } from "../../../middleware/auth";
import { financeScopeFromRequest, requireFinanceBranch } from "../contracts";
import { validateManagement } from "../validations/management.validation";
import { financeReport, financeDebts, reverseVoucher, createPayable, createVoucher, saveFollowup, importInvoiceTax } from "../services/management.service";
import { FinanceTaxModel, FinanceManagementSettingsModel } from "../models/management.model";
export const financeManagementRoutes = Router();
const scope = (r: any) => requireFinanceBranch(financeScopeFromRequest(r.user || {}, r.query));
const run = (fn: (r: any) => Promise<any>) => async (req: any, res: any, next: any) => {
    try {
        res.json({ success: true, data: await fn(req) });
    }
    catch (error: any) {
        if (error.code === 20 && /Transaction numbers are only allowed on a replica set member or mongos/i.test(error.message || ""))
            return res.status(503).json({ code: "FINANCE_TRANSACTIONS_REQUIRED", message: "Giao dịch gặp sự cố, vui lòng thử lại sau." });
        if (error.code === 11000)
            return res.status(409).json({ message: "Chứng từ đã được ghi nhận. Vui lòng tải lại danh sách." });
        if (error.status && error.status < 500)
            return res.status(error.status).json({ message: error.message });
        next(error);
    }
};
// Existing wallet-manager permission protects sensitive cost, profit and tax data.
const manager = requirePermission("finance-wallet:manage") as any;
financeManagementRoutes.get("/report", manager, run(r => financeReport(scope(r), r.query)));
financeManagementRoutes.get("/debts", requirePermission(["finance-receivable:read", "finance-receivable:manage", "finance-wallet:manage"]) as any, run(r => financeDebts(scope(r))));
financeManagementRoutes.post("/payables", manager, run(r => createPayable(scope(r), validateManagement("payable", r.body), r.user)));
financeManagementRoutes.post("/vouchers", manager, run(r => createVoucher(scope(r), validateManagement("voucher", r.body), r.user)));
financeManagementRoutes.post("/vouchers/:id/reversal", manager, run(r => reverseVoucher(scope(r), r.params.id, validateManagement("reversal", r.body), r.user)));
financeManagementRoutes.post("/followups", requirePermission(["finance-receivable:manage", "finance-wallet:manage"]) as any, run(r => saveFollowup(scope(r), validateManagement("followup", r.body), r.user)));
financeManagementRoutes.post("/tax/from-invoice/:id", manager, run(r => importInvoiceTax(scope(r), r.params.id, r.user)));
financeManagementRoutes.post("/tax", manager, run(r => FinanceTaxModel.create({ ...scope(r), ...validateManagement("tax", r.body), createdBy: r.user.id })));
financeManagementRoutes.put("/settings", manager, run(r => {
    const data = validateManagement("settings", r.body);
    return FinanceManagementSettingsModel.findOneAndUpdate({ ...scope(r), period: data.period }, { $set: { ...data, updatedBy: r.user.id } }, { upsert: true, returnDocument: "after", runValidators: true });
}));
