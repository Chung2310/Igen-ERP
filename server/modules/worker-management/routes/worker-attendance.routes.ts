import { Router } from "express";
import { requirePermission } from "../../../middleware/auth";
import { validate } from "../middlewares/validate.middleware";
import { WorkerAttendanceController } from "../controllers/worker-attendance.controller";
import { WORKER_MANAGE_PERMISSION, WORKER_READ_PERMISSION } from "../permissions";
import { idParamSchema } from "../validations/worker-project.validation";
import {
  markAttendanceSchema,
  listAttendanceQuerySchema,
  adjustAttendanceSchema,
} from "../validations/worker-attendance.validation";

export const workerAttendanceRoutes = Router();

// Bấm chấm công
workerAttendanceRoutes.post(
  "/mark",
  requirePermission([WORKER_READ_PERMISSION, WORKER_MANAGE_PERMISSION]) as any,
  validate(markAttendanceSchema),
  WorkerAttendanceController.mark as any
);

// Xem bảng chấm công dự án (theo ngày hoặc khoảng ngày)
workerAttendanceRoutes.get(
  "/",
  requirePermission([WORKER_READ_PERMISSION, WORKER_MANAGE_PERMISSION]) as any,
  validate(listAttendanceQuerySchema, "query"),
  WorkerAttendanceController.list as any
);

// Quản lý sửa tay mốc công
workerAttendanceRoutes.patch(
  "/:id",
  requirePermission(WORKER_MANAGE_PERMISSION) as any,
  validate(idParamSchema, "params"),
  validate(adjustAttendanceSchema),
  WorkerAttendanceController.adjust as any
);
