import { Router } from "express";
import Joi from "joi";
import { requireAuth, requireRole, type AuthenticatedRequest } from "../middleware/auth";
import { validateRequest } from "../middleware/validation";
import { TransactionModel } from "../model/transaction.model";
import { payOS, isPayOSConfigured } from "../config/payos";
import { companyWalletEnabled } from "../service/free-ai.service";
import { companyWalletStatus, createCompanyDeposit, creditConfirmedDeposit } from "../service/company-wallet.service";

export const companyWalletRouter = Router();
companyWalletRouter.use(requireAuth as any, requireRole(["admin"]) as any);
companyWalletRouter.use((_req, res, next) => companyWalletEnabled() ? next() : res.status(503).json({ status: "error", message: "Ví doanh nghiệp chưa được bật." }));
const handle = (fn: (req: AuthenticatedRequest) => Promise<unknown>) => async (req: AuthenticatedRequest, res: any) => {
  try { return res.json({ status: "success", data: await fn(req) }); }
  catch (error: any) { return res.status(error.statusCode || 503).json({ status: "error", message: error.message || "Không thể thực hiện thao tác ví doanh nghiệp." }); }
};
companyWalletRouter.get("/status", handle((req) => companyWalletStatus(req.user!.companyCode!)));
companyWalletRouter.post("/deposit", validateRequest({ body: Joi.object({ amountVND: Joi.number().integer().min(2000).max(100_000_000).required() }) }),
  handle((req) => createCompanyDeposit(req.user!.id, req.user!.companyCode!, req.body.amountVND)));
companyWalletRouter.get("/deposit/:orderCode", validateRequest({ params: Joi.object({ orderCode: Joi.number().integer().positive().required() }) }),
  handle(async (req) => {
    const row = await TransactionModel.findOne({ orderCode: Number(req.params.orderCode), payerType: "company",
      payerId: req.user!.companyCode, type: "deposit" }).select("status amount createdAt paymentProvider bankTransfer checkoutUrl").lean();
    if (!row) throw Object.assign(new Error("Không tìm thấy giao dịch của công ty."), { statusCode: 404 });
    if (row.status === "pending" && row.paymentProvider === "payos" && isPayOSConfigured && payOS) {
      const provider = await payOS.paymentRequests.get(Number(req.params.orderCode));
      if (provider.status === "PAID" && Number(provider.amount) === Math.round(row.amount * 100)) {
        await creditConfirmedDeposit(row._id as any);
        return { ...row, status: "success" };
      }
    }
    return row;
  }));
