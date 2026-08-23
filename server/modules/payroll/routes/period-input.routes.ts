import { Router } from "express";
import { requirePermission } from "../../../middleware/auth";
import { payrollPeriodInputController } from "../controllers/payroll-period-input.controller";
import { payrollLineOverrideController } from "../controllers/payroll-line-override.controller";
import { PAYROLL_PERIOD_READ_PERMISSION, PAYROLL_PERIOD_MANAGE_PERMISSION } from "../permissions";

export const PAYROLL_PERIOD_INPUT_ROUTE_PERMISSIONS = {
  "GET /period-input-variables": PAYROLL_PERIOD_READ_PERMISSION,
  "POST /period-input-variables": PAYROLL_PERIOD_MANAGE_PERMISSION,
  "PATCH /period-input-variables/:id": PAYROLL_PERIOD_MANAGE_PERMISSION,
  "POST /period-input-variables/:id/activate": PAYROLL_PERIOD_MANAGE_PERMISSION,
  "POST /period-input-variables/:id/retire": PAYROLL_PERIOD_MANAGE_PERMISSION,
  "GET /periods/:periodKey/inputs": PAYROLL_PERIOD_READ_PERMISSION,
  "PUT /periods/:periodKey/inputs/:employeeId": PAYROLL_PERIOD_MANAGE_PERMISSION,
  "PUT /periods/:periodKey/inputs": PAYROLL_PERIOD_MANAGE_PERMISSION,
  "GET /periods/:periodKey/line-overrides": PAYROLL_PERIOD_READ_PERMISSION,
  "PUT /periods/:periodKey/line-overrides": PAYROLL_PERIOD_MANAGE_PERMISSION,
} as const;

export const payrollPeriodInputRoutes = Router();
const read = requirePermission(PAYROLL_PERIOD_READ_PERMISSION) as any;
const manage = requirePermission(PAYROLL_PERIOD_MANAGE_PERMISSION) as any;

payrollPeriodInputRoutes.get("/period-input-variables", read, payrollPeriodInputController.variables as any);
payrollPeriodInputRoutes.post("/period-input-variables", manage, payrollPeriodInputController.createVariable as any);
payrollPeriodInputRoutes.patch("/period-input-variables/:id", manage, payrollPeriodInputController.updateVariable as any);
payrollPeriodInputRoutes.post("/period-input-variables/:id/activate", manage, payrollPeriodInputController.activateVariable as any);
payrollPeriodInputRoutes.post("/period-input-variables/:id/retire", manage, payrollPeriodInputController.retireVariable as any);
payrollPeriodInputRoutes.get("/periods/:periodKey/inputs", read, payrollPeriodInputController.list as any);
payrollPeriodInputRoutes.put("/periods/:periodKey/inputs/:employeeId", manage, payrollPeriodInputController.save as any);
payrollPeriodInputRoutes.put("/periods/:periodKey/inputs", manage, payrollPeriodInputController.bulk as any);
payrollPeriodInputRoutes.get("/periods/:periodKey/line-overrides", read, payrollLineOverrideController.list as any);
payrollPeriodInputRoutes.put("/periods/:periodKey/line-overrides", manage, payrollLineOverrideController.bulk as any);
