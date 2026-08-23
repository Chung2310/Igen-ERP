import { Router } from "express";
import { requirePermission } from "../../../middleware/auth";
import { payrollPolicyController } from "../controllers/payroll-policy.controller";
import { PAYROLL_POLICY_READ_PERMISSION, PAYROLL_POLICY_MANAGE_PERMISSION } from "../permissions";

export const PAYROLL_POLICY_ROUTE_PERMISSIONS = {
  "GET /policies": PAYROLL_POLICY_READ_PERMISSION,
  "POST /policies": PAYROLL_POLICY_MANAGE_PERMISSION,
  "POST /policies/:id/activate": PAYROLL_POLICY_MANAGE_PERMISSION,
  "POST /policies/:id/retire": PAYROLL_POLICY_MANAGE_PERMISSION,
  "PATCH /policies/:id": PAYROLL_POLICY_MANAGE_PERMISSION,
  "POST /policies/:id/clone": PAYROLL_POLICY_MANAGE_PERMISSION,
  "DELETE /policies/:id": PAYROLL_POLICY_MANAGE_PERMISSION,
} as const;

export const payrollPolicyRoutes = Router();
const read = requirePermission(PAYROLL_POLICY_READ_PERMISSION) as any;
const manage = requirePermission(PAYROLL_POLICY_MANAGE_PERMISSION) as any;

payrollPolicyRoutes.get("/policies", read, payrollPolicyController.listPolicies as any);
payrollPolicyRoutes.post("/policies", manage, payrollPolicyController.createPolicy as any);
payrollPolicyRoutes.post("/policies/:id/activate", manage, payrollPolicyController.activatePolicy as any);
payrollPolicyRoutes.post("/policies/:id/retire", manage, payrollPolicyController.retirePolicy as any);
payrollPolicyRoutes.patch("/policies/:id", manage, payrollPolicyController.updatePolicy as any);
payrollPolicyRoutes.post("/policies/:id/clone", manage, payrollPolicyController.clonePolicy as any);
payrollPolicyRoutes.delete("/policies/:id", manage, payrollPolicyController.deletePolicy as any);
