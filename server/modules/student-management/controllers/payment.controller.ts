import { Response, NextFunction } from "express";
import { PaymentService } from "../services/payment.service";
import { AuthRequest } from "../middlewares/auth.middleware";
import { getAllowedOwnerIds } from "../utils/auth.util";

export class PaymentController {
  static async create(req: AuthRequest, res: Response) {
    try {
      const ownerId = await getAllowedOwnerIds(req.user!);
      const payment = await PaymentService.createPayment(ownerId, req.body, req.user!.branchId);
      res.status(201).json({ success: true, data: payment });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Lỗi không xác định.";
      res.status(400).json({ success: false, error: msg });
    }
  }

  static async getList(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const ownerId = await getAllowedOwnerIds(req.user!);
      const filters = {
        page: typeof req.query.page === "string" ? req.query.page : undefined,
        limit: typeof req.query.limit === "string" ? req.query.limit : undefined,
        studentId: typeof req.query.studentId === "string" ? req.query.studentId : undefined,
        ownerFilter: typeof req.query.ownerFilter === "string" ? req.query.ownerFilter : undefined,
        startDate: typeof req.query.startDate === "string" ? req.query.startDate : undefined,
        endDate: typeof req.query.endDate === "string" ? req.query.endDate : undefined,
      };
      const result = await PaymentService.getPayments(ownerId, filters, req.user!.branchId);
      res.json({ success: true, ...result });
    } catch (error: unknown) {
      next(error);
    }
  }

  static async delete(req: AuthRequest, res: Response) {
    try {
      const ownerId = await getAllowedOwnerIds(req.user!);
      const payment = await PaymentService.deletePayment(ownerId, req.params.id, req.user!.branchId);
      if (!payment) {
        return res.status(404).json({ success: false, error: "Không tìm thấy giao dịch thanh toán để xóa." });
      }
      res.json({ success: true, data: payment });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Lỗi không xác định.";
      res.status(400).json({ success: false, error: msg });
    }
  }
}
