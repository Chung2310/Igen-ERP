import { Router } from "express";
import { requirePermission } from "../../../middleware/auth";
import { payrollRunController } from "../controllers/payroll-run.controller";
import { payrollPeriodController } from "../controllers/payroll-period.controller";
import { PAYROLL_PERIOD_READ_PERMISSION, PAYROLL_PERIOD_MANAGE_PERMISSION } from "../permissions";

export const PAYROLL_RUN_ROUTE_PERMISSIONS = {
  "POST /runs": PAYROLL_PERIOD_MANAGE_PERMISSION,
  "POST /runs/:id/sync-attendance": PAYROLL_PERIOD_MANAGE_PERMISSION,
  "POST /runs/:id/lock-attendance": PAYROLL_PERIOD_MANAGE_PERMISSION,
  "POST /runs/:id/review": PAYROLL_PERIOD_MANAGE_PERMISSION,
  "POST /runs/:id/close": PAYROLL_PERIOD_MANAGE_PERMISSION,
  "POST /runs/:id/reopen": PAYROLL_PERIOD_MANAGE_PERMISSION,
  "GET /runs/:id/audit": PAYROLL_PERIOD_READ_PERMISSION,
  "POST /runs/:id/calculate": PAYROLL_PERIOD_MANAGE_PERMISSION,
  "POST /runs/:id/recalculate": PAYROLL_PERIOD_MANAGE_PERMISSION,
  "GET /runs/:id/issues": PAYROLL_PERIOD_READ_PERMISSION,
  "GET /runs/:id/lines/:employeeId": null,
} as const;

export const payrollRunRoutes = Router();
const read = requirePermission(PAYROLL_PERIOD_READ_PERMISSION) as any;
const manage = requirePermission(PAYROLL_PERIOD_MANAGE_PERMISSION) as any;

payrollRunRoutes.post("/runs", manage, payrollRunController.createOperationalRun as any);
payrollRunRoutes.post("/runs/:id/sync-attendance", manage, payrollRunController.syncAttendance as any);
payrollRunRoutes.post("/runs/:id/lock-attendance", manage, payrollRunController.lockAttendance as any);
payrollRunRoutes.post("/runs/:id/review", manage, payrollRunController.reviewOperationalRun as any);
payrollRunRoutes.post("/runs/:id/close", manage, payrollRunController.closeOperationalRun as any);
payrollRunRoutes.post("/runs/:id/reopen", manage, payrollRunController.reopenOperationalRun as any);
payrollRunRoutes.post("/runs/:id/mark-paid", requirePermission("payroll-payment:manage") as any, payrollRunController.markOperationalRunPaid as any);
payrollRunRoutes.get("/runs/:id/audit", read, payrollRunController.listRunAudit as any);
payrollRunRoutes.post("/runs/:id/calculate", manage, payrollRunController.calculateRun as any);
payrollRunRoutes.post("/runs/:id/recalculate", manage, payrollRunController.calculateRun as any);
payrollRunRoutes.get("/runs/:id/issues", read, payrollRunController.listRunIssues as any);
payrollRunRoutes.get("/runs/:id/lines/:employeeId", payrollPeriodController.getLineDetail as any);
