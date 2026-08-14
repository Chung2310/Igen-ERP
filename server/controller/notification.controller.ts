import { Response } from "express";
import { AuthenticatedRequest } from "../middleware/auth";
import { notificationService } from "../service/notification.service";
import { NotifType } from "../interface/notification.interface";
import { UserModel } from "../model/user.model";

export const notificationController = {
  /**
   * GET /api/v1/notifications
   */
  async getList(req: AuthenticatedRequest, res: Response) {
    try {
      const recipientUid = req.user?.id;
      const companyCode = req.user?.companyCode;

      if (!recipientUid || !companyCode) {
        return res.status(401).json({
          status: "error",
          message: "Người dùng chưa xác thực hoặc thiếu mã công ty.",
        });
      }

      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 20;
      const read = req.query.read !== undefined ? req.query.read === "true" : undefined;
      const type = req.query.type as NotifType;

      const result = await notificationService.getNotifications(recipientUid, companyCode, {
        page,
        limit,
        read,
        type,
      });

      return res.status(200).json({
        status: "success",
        data: result.items,
        total: result.total,
        unreadCount: result.unreadCount,
        page: result.page,
        limit: result.limit,
      });
    } catch (error: any) {
      console.error("[notificationController.getList] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Lỗi khi tải danh sách thông báo.",
        details: error.message,
      });
    }
  },

  /**
   * POST /api/v1/notifications
   */
  async create(req: AuthenticatedRequest, res: Response) {
    try {
      const companyCode = req.user?.companyCode;
      if (!companyCode) {
        return res.status(401).json({
          status: "error",
          message: "Người dùng chưa xác thực hoặc thiếu mã công ty.",
        });
      }

      const recipient = await UserModel.findOne({
        _id: req.body.recipientUid,
        companyCode,
      }).select("_id").lean();

      if (!recipient) {
        return res.status(403).json({
          status: "error",
          message: "Nguoi nhan khong thuoc doanh nghiep cua ban hoac khong ton tai.",
        });
      }

      const payload = {
        ...req.body,
        companyCode,
      };

      const item = await notificationService.createNotification(payload);
      return res.status(201).json({
        status: "success",
        data: item,
      });
    } catch (error: any) {
      console.error("[notificationController.create] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Lỗi khi tạo mới thông báo.",
        details: error.message,
      });
    }
  },

  /**
   * PATCH /api/v1/notifications/:id/read
   */
  async markRead(req: AuthenticatedRequest, res: Response) {
    try {
      const recipientUid = req.user?.id;
      const { id } = req.params;

      if (!recipientUid) {
        return res.status(401).json({
          status: "error",
          message: "Người dùng chưa xác thực.",
        });
      }

      const item = await notificationService.markAsRead(id, recipientUid);
      return res.status(200).json({
        status: "success",
        data: item,
      });
    } catch (error: any) {
      console.error("[notificationController.markRead] Error:", error);
      return res.status(error.message.includes("Không tìm thấy") ? 404 : 500).json({
        status: "error",
        message: error.message || "Lỗi khi cập nhật trạng thái thông báo.",
      });
    }
  },

  /**
   * PATCH /api/v1/notifications/read-all
   */
  async markAllRead(req: AuthenticatedRequest, res: Response) {
    try {
      const recipientUid = req.user?.id;
      const companyCode = req.user?.companyCode;

      if (!recipientUid || !companyCode) {
        return res.status(401).json({
          status: "error",
          message: "Người dùng chưa xác thực hoặc thiếu mã công ty.",
        });
      }

      await notificationService.markAllAsRead(recipientUid, companyCode);
      return res.status(200).json({
        status: "success",
        message: "Đã đánh dấu đọc tất cả thông báo.",
      });
    } catch (error: any) {
      console.error("[notificationController.markAllRead] Error:", error);
      return res.status(500).json({
        status: "error",
        message: "Lỗi khi đánh dấu đọc tất cả thông báo.",
        details: error.message,
      });
    }
  },

  /**
   * DELETE /api/v1/notifications/:id
   */
  async delete(req: AuthenticatedRequest, res: Response) {
    try {
      const recipientUid = req.user?.id;
      const { id } = req.params;

      if (!recipientUid) {
        return res.status(401).json({
          status: "error",
          message: "Người dùng chưa xác thực.",
        });
      }

      const item = await notificationService.deleteNotification(id, recipientUid);
      return res.status(200).json({
        status: "success",
        message: "Xóa thông báo thành công.",
        data: item,
      });
    } catch (error: any) {
      console.error("[notificationController.delete] Error:", error);
      return res.status(error.message.includes("Không tìm thấy") ? 404 : 500).json({
        status: "error",
        message: error.message || "Lỗi khi xóa thông báo.",
      });
    }
  },
};
