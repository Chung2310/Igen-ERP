import { Router } from "express";
import { workerRoutes } from "./routes/worker.routes";
import { studentManagementRouter } from "../student-management/router";
export const workerManagementRouter = Router();
workerManagementRouter.use("/workers", workerRoutes);
workerManagementRouter.use("/worker-management", studentManagementRouter);
