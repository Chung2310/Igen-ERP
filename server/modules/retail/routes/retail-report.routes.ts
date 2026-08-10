import { Router } from "express";
import { requirePermission } from "../../../middleware/auth";
import { retailReportController } from "../controllers/retail-report.controller";
import { RETAIL_MANAGER_PERMISSION, RETAIL_OPERATE_PERMISSION } from "../permissions";

export const retailReportRoutes = Router();
const operate = requirePermission([RETAIL_OPERATE_PERMISSION, RETAIL_MANAGER_PERMISSION]) as any;

retailReportRoutes.get("/summary", operate, retailReportController.summary as any);
retailReportRoutes.get("/export", operate, retailReportController.export as any);
