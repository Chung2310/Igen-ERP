import { Router } from "express";
import { workerRoutes } from "./routes/worker.routes";
import { workerProjectRoutes } from "./routes/worker-project.routes";
import { workerAttendanceRoutes } from "./routes/worker-attendance.routes";
import { workerQrAttendanceRoutes, workerQrAttendancePublicRoutes } from "./routes/worker-qr-attendance.routes";
import { workerDashboardRoutes } from "./routes/worker-dashboard.routes";
import { workerNotificationRoutes } from "./routes/worker-notification.routes";
import { workerStandardFieldRoutes } from "./routes/worker-standard-field.routes";

export const workerManagementRouter = Router();

workerManagementRouter.use("/worker-management/workers", workerRoutes);
workerManagementRouter.use("/worker-management/projects", workerProjectRoutes);
workerManagementRouter.use("/worker-management/attendance", workerAttendanceRoutes);
workerManagementRouter.use("/worker-management/qr-attendance", workerQrAttendanceRoutes);
workerManagementRouter.use("/worker-management/dashboard", workerDashboardRoutes);
workerManagementRouter.use("/worker-management/notifications", workerNotificationRoutes);
workerManagementRouter.use("/worker-management/standard-fields", workerStandardFieldRoutes);