import { Router } from "express";
import { requirePermission } from "../../../middleware/auth";
import { remindOverdueRetailDebt, retailReportController } from "../controllers/retail-report.controller";
import { RETAIL_MANAGER_PERMISSION } from "../permissions";

export const retailReportRoutes = Router();
const read = requirePermission(["retail:read", RETAIL_MANAGER_PERMISSION]) as any;

retailReportRoutes.get("/summary", read, retailReportController.summary as any);
retailReportRoutes.get("/export", read, retailReportController.export as any);
retailReportRoutes.post("/debt-reminders/run", requirePermission(RETAIL_MANAGER_PERMISSION) as any, remindOverdueRetailDebt as any);
