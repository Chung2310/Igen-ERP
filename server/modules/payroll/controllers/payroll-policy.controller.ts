import type { Response } from "express";
import type { AuthenticatedRequest } from "../../../middleware/auth";
import {
  activatePayrollPolicy,
  createPayrollPolicy,
  listPayrollPolicies,
  retirePayrollPolicy,
  updatePayrollPolicy,
  clonePayrollPolicy,
  deletePayrollPolicy,
} from "../services/payroll-policy-operations.service";
import {
  createPolicySchema,
  updatePolicySchema,
  activatePolicySchema,
  clonePolicySchema,
} from "../../../validation/payroll-run.validation";
import { tenant, validationFailure, operationFailure } from "./shared";

export const payrollPolicyController = {
  async listPolicies(req: AuthenticatedRequest, res: Response) {
    return res.json({ status: "success", data: await listPayrollPolicies(tenant(req)) });
  },
  async createPolicy(req: AuthenticatedRequest, res: Response) {
    const { error, value } = createPolicySchema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) return validationFailure(res, error.message);
    try {
      return res.status(201).json({ status: "success", data: await createPayrollPolicy(tenant(req), req.user!.id, value) });
    } catch (operationError) {
      return operationFailure(res, operationError);
    }
  },
  async activatePolicy(req: AuthenticatedRequest, res: Response) {
    const { error, value } = activatePolicySchema.validate(req.body ?? {}, { abortEarly: false, stripUnknown: true });
    if (error) return validationFailure(res, error.message);
    try {
      return res.json({ status: "success", data: await activatePayrollPolicy(tenant(req), req.params.id, req.user!.id, value) });
    } catch (operationError) {
      return operationFailure(res, operationError);
    }
  },
  async retirePolicy(req: AuthenticatedRequest, res: Response) {
    try {
      return res.json({ status: "success", data: await retirePayrollPolicy(tenant(req), req.params.id, req.user!.id) });
    } catch (operationError) {
      return operationFailure(res, operationError);
    }
  },
  async updatePolicy(req: AuthenticatedRequest, res: Response) {
    const { error, value } = updatePolicySchema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) return validationFailure(res, error.message);
    const { expectedVersion, ...definition } = value;
    try { return res.json({ status: "success", data: await updatePayrollPolicy(tenant(req), req.params.id, req.user!.id, expectedVersion, definition) }); }
    catch (operationError) { return operationFailure(res, operationError); }
  },
  async clonePolicy(req: AuthenticatedRequest, res: Response) {
    const { error, value } = clonePolicySchema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) return validationFailure(res, error.message);
    try { return res.status(201).json({ status: "success", data: await clonePayrollPolicy(tenant(req), req.params.id, req.user!.id, value) }); }
    catch (operationError) { return operationFailure(res, operationError); }
  },
  async deletePolicy(req: AuthenticatedRequest, res: Response) {
    try { return res.json({ status: "success", data: await deletePayrollPolicy(tenant(req), req.params.id, req.user!.id) }); }
    catch (operationError) { return operationFailure(res, operationError); }
  },
};
