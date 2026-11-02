import { Router } from "express";
import { Types } from "mongoose";
import { requirePermission } from "../../../middleware/auth";
import { retailScopeFromRequest } from "../contracts";
import { RetailSePayTransactionModel } from "../models/retail-sepay-transaction.model";

export const retailPaymentReviewRoutes = Router();
const read = requirePermission(["retail-payment-review:read", "retail-payment-review:manage"]) as any;
const manage = requirePermission("retail-payment-review:manage") as any;
const companyCode = (req: any) => retailScopeFromRequest(req.user || {}, { companyCode: req.query.companyCode }).companyCode;

retailPaymentReviewRoutes.get("/", read, async (req: any, res: any, next: any) => {
  try {
    const items = await RetailSePayTransactionModel.find({ companyCode: companyCode(req), status: "pending_review" }).sort({ transactionDate: -1, createdAt: -1 }).limit(100).lean();
    res.json({ success: true, data: items });
  } catch (error) { next(error); }
});

retailPaymentReviewRoutes.post("/:id/review", manage, async (req: any, res: any, next: any) => {
  try {
    if (!Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ success: false, error: "Mã giao dịch không hợp lệ." });
    const note = String(req.body?.note || "").trim();
    if (!note || note.length > 500) return res.status(400).json({ success: false, error: "Vui lòng nhập kết quả kiểm tra không quá 500 ký tự." });
    const item = await RetailSePayTransactionModel.findOneAndUpdate(
      { _id: req.params.id, companyCode: companyCode(req), status: "pending_review" },
      { $set: { status: "reviewed", reviewNote: note, reviewedBy: String(req.user.id), reviewedAt: new Date() } },
      { returnDocument: "after" },
    ).lean();
    if (!item) return res.status(409).json({ success: false, error: "Giao dịch đã được kiểm tra hoặc không thuộc công ty." });
    res.json({ success: true, data: item });
  } catch (error) { next(error); }
});
