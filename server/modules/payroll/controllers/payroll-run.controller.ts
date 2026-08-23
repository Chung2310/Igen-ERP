import type { Response } from "express";
import type { AuthenticatedRequest } from "../../../middleware/auth";
import { PayrollRunModel } from "../models/payroll-run.model";
import { PayrollAuditModel } from "../models/payroll-audit.model";
import {
  createRun as createOperationalPayrollRun,
  listIssues as listOperationalPayrollIssues,
  lockAttendance as lockOperationalPayrollAttendance,
  syncAttendance as syncOperationalPayrollAttendance,
} from "../services/payroll-run-operations.service";
import { calculateOperationalRun } from "../services/payroll-run-calculate-operations.service";
import { runPayrollWorkflowAction } from "../services/payroll-run-workflow-operations.service";
import type { PayrollWorkflowAction } from "../services/payroll-run-workflow.service";
import {
  auditQuerySchema,
  calculateRunSchema,
  createOperationalRunSchema,
  reopenRunSchema,
  workflowTransitionSchema,
  lockAttendanceSchema,
  syncAttendanceHeadersSchema,
  syncAttendanceSchema,
} from "../../../validation/payroll-run.validation";
import { operationalScope, validationFailure, operationFailure } from "./shared";

const workflowHandler = (action: PayrollWorkflowAction) => async (req: AuthenticatedRequest, res: Response) => {
  const scope = operationalScope(req);
  if (!scope) return validationFailure(res, "Authenticated company and branch are required");
  const schema = action === "reopen" ? reopenRunSchema : workflowTransitionSchema;
  const { error, value } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
  if (error) return validationFailure(res, error.message);
  try {
    const run = await runPayrollWorkflowAction(scope, req.params.id, req.user!.id, action, {
      expectedVersion: value.expectedVersion,
      reason: value.reason,
      correlationId: value.correlationId ?? (req.headers["x-correlation-id"] as string | undefined),
    });
    return res.json({ status: "success", data: run });
  } catch (operationError) {
    return operationFailure(res, operationError);
  }
};

export const payrollRunController = {
  async createOperationalRun(req: AuthenticatedRequest, res: Response) {
    const scope = operationalScope(req);
    if (!scope) return validationFailure(res, "Authenticated company and branch are required");
    const { error, value } = createOperationalRunSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) return validationFailure(res, error.message);
    try {
      const run = await createOperationalPayrollRun(scope, req.user!.id, value);
      return res.status(201).json({ status: "success", data: run });
    } catch (operationError) {
      return operationFailure(res, operationError);
    }
  },
  async syncAttendance(req: AuthenticatedRequest, res: Response) {
    const scope = operationalScope(req);
    if (!scope) return validationFailure(res, "Authenticated company and branch are required");
    const body = syncAttendanceSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (body.error) return validationFailure(res, body.error.message);
    const headers = syncAttendanceHeadersSchema.validate(req.headers, { abortEarly: false });
    if (headers.error) return validationFailure(res, headers.error.message);
    try {
      const result = await syncOperationalPayrollAttendance(
        scope,
        req.params.id,
        req.user!.id,
        body.value.expectedVersion,
        headers.value["idempotency-key"],
      );
      return res.json({ status: "success", data: result });
    } catch (operationError) {
      return operationFailure(res, operationError);
    }
  },
  async listRunIssues(req: AuthenticatedRequest, res: Response) {
    const scope = operationalScope(req);
    if (!scope) return validationFailure(res, "Authenticated company and branch are required");
    try {
      const issues = await listOperationalPayrollIssues(scope, req.params.id);
      return res.json({ status: "success", data: issues });
    } catch (operationError) {
      return operationFailure(res, operationError);
    }
  },
  async lockAttendance(req: AuthenticatedRequest, res: Response) {
    const scope = operationalScope(req);
    if (!scope) return validationFailure(res, "Authenticated company and branch are required");
    const { error, value } = lockAttendanceSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) return validationFailure(res, error.message);
    try {
      const result = await lockOperationalPayrollAttendance(scope, req.params.id, req.user!.id, value.expectedVersion);
      return res.json({ status: "success", data: result });
    } catch (operationError) {
      return operationFailure(res, operationError);
    }
  },
  async calculateRun(req: AuthenticatedRequest, res: Response) {
    const scope = operationalScope(req);
    if (!scope) return validationFailure(res, "Authenticated company and branch are required");
    const body = calculateRunSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (body.error) return validationFailure(res, body.error.message);
    const headers = syncAttendanceHeadersSchema.validate(req.headers, { abortEarly: false });
    if (headers.error) return validationFailure(res, headers.error.message);
    try {
      const result = await calculateOperationalRun(
        scope,
        req.params.id,
        req.user!.id,
        body.value.expectedVersion,
        headers.value["idempotency-key"],
      );
      return res.json({ status: "success", data: result });
    } catch (operationError) {
      return operationFailure(res, operationError);
    }
  },
  reviewOperationalRun: workflowHandler("review"),
  closeOperationalRun: workflowHandler("close"),
  reopenOperationalRun: workflowHandler("reopen"),
  markOperationalRunPaid: workflowHandler("markPaid"),
  async listRunAudit(req: AuthenticatedRequest, res: Response) {
    const scope = operationalScope(req);
    if (!scope) return validationFailure(res, "Authenticated company and branch are required");
    const { error, value } = auditQuerySchema.validate(req.query, { abortEarly: false });
    if (error) return validationFailure(res, error.message);
    const run: any = await PayrollRunModel.findOne({ _id: req.params.id, ...scope }).select("periodKey").lean();
    if (!run) return res.status(404).json({ status: "error", code: "PAYROLL_RUN_NOT_FOUND", message: "Payroll run not found" });
    const filter = { ...scope, periodKey: run.periodKey, ...(value.action ? { action: value.action } : {}) };
    const [items, total] = await Promise.all([
      PayrollAuditModel.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((value.page - 1) * value.limit)
        .limit(value.limit)
        .lean(),
      PayrollAuditModel.countDocuments(filter),
    ]);
    return res.json({
      status: "success",
      data: items,
      pagination: { page: value.page, limit: value.limit, total, totalPages: Math.ceil(total / value.limit) },
    });
  },
};
