import { Router } from "express";
import { requirePermission } from "../../../middleware/auth";
import { payrollPeriodController } from "../controllers/payroll-period.controller";
import { payrollAdjustmentController } from "../controllers/payroll-adjustment.controller";
import { PAYROLL_PERIOD_READ_PERMISSION, PAYROLL_PERIOD_MANAGE_PERMISSION } from "../permissions";

export const PAYROLL_PERIOD_ROUTE_PERMISSIONS = {
  "GET /periods/:periodKey/audit": PAYROLL_PERIOD_READ_PERMISSION,
  "GET /periods/:periodKey/results": PAYROLL_PERIOD_READ_PERMISSION,
  "POST /periods/:periodKey/snapshot": PAYROLL_PERIOD_MANAGE_PERMISSION,
  "POST /periods/:periodKey/lock": PAYROLL_PERIOD_MANAGE_PERMISSION,
  "POST /periods/:periodKey/run": PAYROLL_PERIOD_MANAGE_PERMISSION,
  "POST /periods/:periodKey/process": PAYROLL_PERIOD_MANAGE_PERMISSION,
  "GET /periods/:periodKey/run": PAYROLL_PERIOD_READ_PERMISSION,
  "DELETE /periods/:periodKey": PAYROLL_PERIOD_MANAGE_PERMISSION,
  "POST /periods/:periodKey/adjustments/:adjustmentId/approve": PAYROLL_PERIOD_MANAGE_PERMISSION,
  "POST /periods/:periodKey/adjustments/:adjustmentId/reject": PAYROLL_PERIOD_MANAGE_PERMISSION,
  "POST /periods/:periodKey/approve": PAYROLL_PERIOD_MANAGE_PERMISSION,
  "POST /periods/:periodKey/close": PAYROLL_PERIOD_MANAGE_PERMISSION,
  "GET /periods/:periodKey/adjustments": PAYROLL_PERIOD_READ_PERMISSION,
  "POST /periods/:periodKey/adjustments": PAYROLL_PERIOD_MANAGE_PERMISSION,
} as const;

export const payrollPeriodRoutes = Router();
const read = requirePermission(PAYROLL_PERIOD_READ_PERMISSION) as any;
const manage = requirePermission(PAYROLL_PERIOD_MANAGE_PERMISSION) as any;

payrollPeriodRoutes.get("/periods/:periodKey/audit", read, payrollPeriodController.listAudit as any);
payrollPeriodRoutes.get("/periods/:periodKey/results", read, payrollPeriodController.listResults as any);
payrollPeriodRoutes.post("/periods/:periodKey/snapshot", manage, payrollPeriodController.createSnapshot as any);
payrollPeriodRoutes.post("/periods/:periodKey/lock", manage, payrollPeriodController.lockResults as any);
payrollPeriodRoutes.post("/periods/:periodKey/run", manage, payrollPeriodController.createRun as any);
payrollPeriodRoutes.post("/periods/:periodKey/process", manage, payrollPeriodController.processPeriod as any);
payrollPeriodRoutes.get("/periods/:periodKey/run", read, payrollPeriodController.getRun as any);
payrollPeriodRoutes.delete("/periods/:periodKey", manage, payrollPeriodController.resetPeriod as any);
payrollPeriodRoutes.post("/periods/:periodKey/adjustments/:adjustmentId/approve", manage, payrollAdjustmentController.approveAdjustment as any);
payrollPeriodRoutes.post("/periods/:periodKey/adjustments/:adjustmentId/reject", manage, payrollAdjustmentController.rejectAdjustment as any);
payrollPeriodRoutes.post("/periods/:periodKey/approve", manage, payrollPeriodController.approveRun as any);
payrollPeriodRoutes.post("/periods/:periodKey/close", manage, payrollPeriodController.closeRun as any);
payrollPeriodRoutes.get("/periods/:periodKey/adjustments", read, payrollAdjustmentController.listAdjustments as any);
payrollPeriodRoutes.post("/periods/:periodKey/adjustments", manage, payrollAdjustmentController.createAdjustment as any);
