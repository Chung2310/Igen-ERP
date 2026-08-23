import type { Response } from "express";
import type { AuthenticatedRequest } from "../../../middleware/auth";
import { PayrollPaymentModel } from "../models/payroll-payment.model";
import { createPayrollPayment, transitionPayrollPayment } from "../services/payroll-payment-operations.service";
import type { PayrollPaymentAction } from "../services/payroll-payment.service";
import { createPaymentSchema, paymentTransitionSchema } from "../../../validation/payroll-run.validation";
import { operationalScope, validationFailure, operationFailure } from "./shared";

const paymentTransitionHandler = (action: PayrollPaymentAction) => async (req: AuthenticatedRequest, res: Response) => {
  const scope = operationalScope(req);
  if (!scope) return validationFailure(res, "Authenticated company and branch are required");
  const { error, value } = paymentTransitionSchema.validate(req.body ?? {}, { abortEarly: false, stripUnknown: true });
  if (error) return validationFailure(res, error.message);
  try {
    const result = await transitionPayrollPayment(scope, req.params.id, req.user!.id, action, {
      ...value,
      correlationId: value.correlationId ?? (req.headers["x-correlation-id"] as string | undefined),
    });
    return res.json({ status: "success", data: result.payment, runStatus: result.runStatus });
  } catch (operationError) {
    return operationFailure(res, operationError);
  }
};

export const payrollPaymentController = {
  async listPayments(req: AuthenticatedRequest, res: Response) {
    const scope = operationalScope(req);
    if (!scope) return validationFailure(res, "Authenticated company and branch are required");
    const data = await PayrollPaymentModel.find({ ...scope, runId: req.params.id }).sort({ createdAt: -1 }).lean();
    return res.json({ status: "success", data });
  },
  async createPayment(req: AuthenticatedRequest, res: Response) {
    const scope = operationalScope(req);
    if (!scope) return validationFailure(res, "Authenticated company and branch are required");
    const { error, value } = createPaymentSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) return validationFailure(res, error.message);
    try {
      const { payment, replayed } = await createPayrollPayment(scope, req.params.id, req.user!.id, {
        ...value,
        correlationId: value.correlationId ?? (req.headers["x-correlation-id"] as string | undefined),
      });
      return res.status(replayed ? 200 : 201).json({ status: "success", data: payment });
    } catch (operationError) {
      return operationFailure(res, operationError);
    }
  },
  confirmPayment: paymentTransitionHandler("confirm"),
  cancelPayment: paymentTransitionHandler("cancel"),
  reversePayment: paymentTransitionHandler("reverse"),
};
