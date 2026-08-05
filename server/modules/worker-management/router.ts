import { Router } from "express";
import { workerRoutes } from "./routes/worker.routes";
import { workerProjectRoutes } from "./routes/worker-project.routes";
import { workerAttendanceRoutes } from "./routes/worker-attendance.routes";
import { workerQrAttendanceRoutes } from "./routes/worker-qr-attendance.routes";
import { sharedManagementRouter } from "../shared-management/router";

export const workerManagementRouter = Router();

workerManagementRouter.use("/workers", workerRoutes);
workerManagementRouter.use("/worker-management/workers", workerRoutes);
workerManagementRouter.use("/projects", workerProjectRoutes);
workerManagementRouter.use("/attendance", workerAttendanceRoutes);
workerManagementRouter.use("/qr-attendance", workerQrAttendanceRoutes);
workerManagementRouter.use("/worker-management", sharedManagementRouter);
