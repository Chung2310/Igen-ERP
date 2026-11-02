import { Router, type Request, type Response } from "express";
import { requirePermission } from "../../middleware/auth";
import { reverseManualOutbound } from "./stock-log-reversal.service";

export const stockLogReversalRouter = Router();
stockLogReversalRouter.post("/:id/reverse", requirePermission("inventory:manage") as any, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const data = await reverseManualOutbound({ companyCode: String(user?.companyCode || "").trim().toUpperCase(), branchId: String(user?.branchId || "") }, req.params.id, req.body, { id: String(user?.id || ""), name: String(user?.displayName || user?.email || user?.id || "") });
    return res.json({ status: "success", data });
  } catch (error: any) {
    return res.status(Number(error?.statusCode || error?.status) || 400).json({ status: "error", message: error?.message || "Không thể đảo phiếu kho." });
  }
});
