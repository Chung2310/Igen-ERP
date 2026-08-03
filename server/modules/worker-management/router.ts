import { Router } from "express";
import { workerRoutes } from "./routes/worker.routes";
import { sharedManagementRouter } from "../shared-management/router";
export const workerManagementRouter = Router();
workerManagementRouter.use("/workers", workerRoutes);
workerManagementRouter.use("/worker-management", sharedManagementRouter);
