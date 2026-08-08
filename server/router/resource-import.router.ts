import { Router } from "express";
import { resourceImportController } from "../controller/resource-import.controller";
import { requirePermission } from "../middleware/auth";

export const resourceImportRouter = Router();
resourceImportRouter.use(requirePermission("stock:manage") as any);
resourceImportRouter.post("/complete", resourceImportController.complete as any);
