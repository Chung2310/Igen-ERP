import { Router } from "express";
import { WorkerAttendanceController } from "../controllers/worker-attendance.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { requireAnyPermission } from "../../../middleware/auth";
import { STUDENT_AREA_PERMISSIONS } from "../permissions";

const router = Router();

router.use(authMiddleware);

// Xem bảng chấm công cần quyền đọc; ghi/sửa cần quyền quản lý — giống các luồng
// điểm danh khác của module.
router.get(
  "/",
  requireAnyPermission([...STUDENT_AREA_PERMISSIONS.assignment.read]) as never,
  WorkerAttendanceController.list
);
router.post(
  "/mark",
  requireAnyPermission([...STUDENT_AREA_PERMISSIONS.assignment.manage]) as never,
  WorkerAttendanceController.mark
);
router.patch(
  "/:id",
  requireAnyPermission([...STUDENT_AREA_PERMISSIONS.assignment.manage]) as never,
  WorkerAttendanceController.adjust
);

export default router;
