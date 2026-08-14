import { Router } from "express";
import { requireAuth, requirePermission } from "../middleware/auth";
import { validateRequest } from "../middleware/validation";
import { notificationController } from "../controller/notification.controller";
import {
  getNotificationsSchema,
  createNotificationSchema,
  notificationIdParamsSchema,
} from "../validation/notification.validation";

export const notificationRouter = Router();

// Lấy danh sách thông báo phân trang của user
notificationRouter.get(
  "/",
  requireAuth as any,
  validateRequest(getNotificationsSchema),
  notificationController.getList as any
);

// Tạo thông báo mới (Test/System)
notificationRouter.post(
  "/",
  requireAuth as any,
  requirePermission("chat:manage") as any,
  validateRequest(createNotificationSchema),
  notificationController.create as any
);

// Đánh dấu đọc tất cả thông báo
notificationRouter.patch(
  "/read-all",
  requireAuth as any,
  requirePermission("chat:read") as any,
  notificationController.markAllRead as any
);

// Đánh dấu đọc một thông báo
notificationRouter.patch(
  "/:id/read",
  requireAuth as any,
  requirePermission("chat:read") as any,
  validateRequest(notificationIdParamsSchema),
  notificationController.markRead as any
);

// Xóa thông báo
notificationRouter.delete(
  "/:id",
  requireAuth as any,
  requirePermission("chat:manage") as any,
  validateRequest(notificationIdParamsSchema),
  notificationController.delete as any
);
export default notificationRouter;
