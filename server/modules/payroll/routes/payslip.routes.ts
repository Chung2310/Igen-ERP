import { Router } from "express";
import { requirePermission } from "../../../middleware/auth";
import { payrollPayslipController } from "../controllers/payroll-payslip.controller";
import { PAYROLL_PAYMENT_READ_PERMISSION, PAYROLL_PAYMENT_MANAGE_PERMISSION } from "../permissions";

export const PAYROLL_PAYSLIP_ROUTE_PERMISSIONS = {
  "POST /runs/:id/payslips/publish": PAYROLL_PAYMENT_MANAGE_PERMISSION,
  "GET /runs/:id/payslips/:employeeId/print": null,
  "POST /runs/:id/payslips/:employeeId/withdraw": PAYROLL_PAYMENT_MANAGE_PERMISSION,
  "GET /employee/me/payslips": null,
  "POST /runs/:id/exports": PAYROLL_PAYMENT_READ_PERMISSION,
} as const;

export const payrollPayslipRoutes = Router();
const manage = requirePermission(PAYROLL_PAYMENT_MANAGE_PERMISSION) as any;

payrollPayslipRoutes.post("/runs/:id/payslips/publish", manage, payrollPayslipController.publishPayslips as any);
payrollPayslipRoutes.get(
  "/runs/:id/payslips/:employeeId/print",
  payrollPayslipController.printPayslip as any,
);
payrollPayslipRoutes.post("/runs/:id/payslips/:employeeId/withdraw", manage, payrollPayslipController.withdrawPayslip as any);
payrollPayslipRoutes.get("/employee/me/payslips", payrollPayslipController.listEmployeePayslips as any);
payrollPayslipRoutes.post("/runs/:id/exports", requirePermission(PAYROLL_PAYMENT_READ_PERMISSION) as any, payrollPayslipController.exportPayroll as any);
