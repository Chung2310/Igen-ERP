import { Router } from "express";
import { requirePermission } from "../../../middleware/auth";
import { payrollPaymentController } from "../controllers/payroll-payment.controller";
import { PAYROLL_PAYMENT_READ_PERMISSION, PAYROLL_PAYMENT_MANAGE_PERMISSION } from "../permissions";

export const PAYROLL_PAYMENT_ROUTE_PERMISSIONS = {
  "GET /runs/:id/payments": PAYROLL_PAYMENT_READ_PERMISSION,
  "POST /runs/:id/payments": PAYROLL_PAYMENT_MANAGE_PERMISSION,
  "POST /payments/:id/confirm": PAYROLL_PAYMENT_MANAGE_PERMISSION,
  "POST /payments/:id/cancel": PAYROLL_PAYMENT_MANAGE_PERMISSION,
  "POST /payments/:id/reverse": PAYROLL_PAYMENT_MANAGE_PERMISSION,
} as const;

export const payrollPaymentRoutes = Router();
const read = requirePermission(PAYROLL_PAYMENT_READ_PERMISSION) as any;
const manage = requirePermission(PAYROLL_PAYMENT_MANAGE_PERMISSION) as any;

payrollPaymentRoutes.get("/runs/:id/payments", read, payrollPaymentController.listPayments as any);
payrollPaymentRoutes.post("/runs/:id/payments", manage, payrollPaymentController.createPayment as any);
payrollPaymentRoutes.post("/payments/:id/confirm", manage, payrollPaymentController.confirmPayment as any);
payrollPaymentRoutes.post("/payments/:id/cancel", manage, payrollPaymentController.cancelPayment as any);
payrollPaymentRoutes.post("/payments/:id/reverse", manage, payrollPaymentController.reversePayment as any);
