import { Router } from "express";
import { requirePermission } from "../../../middleware/auth";
import { payrollFormulaController } from "../controllers/payroll-formula.controller";
import { PAYROLL_POLICY_READ_PERMISSION, PAYROLL_POLICY_MANAGE_PERMISSION } from "../permissions";

export const PAYROLL_FORMULA_ROUTE_PERMISSIONS = {
  "GET /formulas": PAYROLL_POLICY_READ_PERMISSION,
  "POST /formulas": PAYROLL_POLICY_MANAGE_PERMISSION,
  "PATCH /formulas/:id": PAYROLL_POLICY_MANAGE_PERMISSION,
  "POST /formulas/:id/activate": PAYROLL_POLICY_MANAGE_PERMISSION,
  "POST /formulas/:id/retire": PAYROLL_POLICY_MANAGE_PERMISSION,
  "POST /formulas/:id/clone": PAYROLL_POLICY_MANAGE_PERMISSION,
} as const;

export const payrollFormulaRoutes = Router();
const read = requirePermission(PAYROLL_POLICY_READ_PERMISSION) as any;
const manage = requirePermission(PAYROLL_POLICY_MANAGE_PERMISSION) as any;

payrollFormulaRoutes.get("/formulas", read, payrollFormulaController.list as any);
payrollFormulaRoutes.post("/formulas", manage, payrollFormulaController.create as any);
payrollFormulaRoutes.patch("/formulas/:id", manage, payrollFormulaController.update as any);
payrollFormulaRoutes.post("/formulas/:id/activate", manage, payrollFormulaController.activate as any);
payrollFormulaRoutes.post("/formulas/:id/retire", manage, payrollFormulaController.retire as any);
payrollFormulaRoutes.post("/formulas/:id/clone", manage, payrollFormulaController.clone as any);
