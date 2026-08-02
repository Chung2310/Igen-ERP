import { Response, NextFunction } from "express";
import { NotificationService } from "../services/notification.service";
import { AuthRequest } from "../middlewares/auth.middleware";
import { getAllowedOwnerIds, resolveCreateOwnerId } from "../utils/auth.util";

export class NotificationController {
  static async create(req: AuthRequest, res: Response) {
    try {
      const ownerId = await resolveCreateOwnerId(
        req.user!,
        typeof req.body.companyCode === "string"
          ? req.body.companyCode
          : undefined,
      );
      const notification = await NotificationService.createNotification(
        ownerId,
        req.user!.branchId!,
        req.body,
      );
      res.status(201).json({ success: true, data: notification });
    } catch (error: unknown) {
      const msg =
        error instanceof Error ? error.message : "Lỗi không xác định.";
      res.status(400).json({ success: false, error: msg });
    }
  }

  static async getList(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const ownerId = await getAllowedOwnerIds(req.user!);
      const result = await NotificationService.getNotifications(
        ownerId,
        req.query,
        req.user!.branchId!,
      );
      res.json({ success: true, ...result });
    } catch (error: unknown) {
      next(error);
    }
  }

  static async delete(req: AuthRequest, res: Response) {
    try {
      const ownerId = await getAllowedOwnerIds(req.user!);
      const notification = await NotificationService.deleteNotification(
        ownerId,
        req.params.id,
        req.user!.branchId!,
      );
      if (!notification) {
        return res
          .status(404)
          .json({ success: false, error: "Không tìm thấy thông báo để xóa." });
      }
      res.json({ success: true, data: notification });
    } catch (error: unknown) {
      const msg =
        error instanceof Error ? error.message : "Lỗi không xác định.";
      res.status(400).json({ success: false, error: msg });
    }
  }
}
