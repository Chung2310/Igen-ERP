import { Router } from "express";
import { workerRoutes } from "./routes/worker.routes";
export const workerManagementRouter = Router();
workerManagementRouter.use("/workers", workerRoutes);
