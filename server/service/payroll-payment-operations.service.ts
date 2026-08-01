import { PayrollAuditModel } from "../model/payroll-audit.model";
import { PayrollCalculationRevisionModel } from "../model/payroll-calculation-revision.model";
import { PayrollPaymentModel } from "../model/payroll-payment.model";
import { PayrollRunModel } from "../model/payroll-run.model";
import { PayrollOperationError, type PayrollOperationScope } from "./payroll-run-operations.service";
import {
  buildSettlementLines,
  confirmedPaidByEmployee,
  deriveRunSettlementStatus,
  paymentActionRule,
  validatePaymentRequest,
  validatePaymentTransition,
  type PayrollPaymentAction,
} from "./payroll-payment.service";

const raise = (failure: { code: string; message: string; status: number }) => {
  throw new PayrollOperationError(failure.code, failure.message, failure.status);
};

/** Prefers the typed calculation revision; legacy runs still carry their lines inline. */
async function readRunLines(scope: PayrollOperationScope, run: any) {
  if (!run.activeRevisionId) return run.lines ?? [];
  const revision: any = await PayrollCalculationRevisionModel.findOne({ _id: run.activeRevisionId, ...scope }).lean();
  if (!revision || revision.status !== "completed") {
    raise({ code: "PAYROLL_REVISION_MISSING", message: "The active calculation revision is not available", status: 409 });
  }
  return revision.lines ?? [];
}

async function settlementFor(scope: PayrollOperationScope, run: any, runId: string) {
  const [lines, payments] = await Promise.all([
    readRunLines(scope, run),
    PayrollPaymentModel.find({ ...scope, runId, status: "confirmed" }).select("status lines").lean(),
  ]);
  return buildSettlementLines(lines, confirmedPaidByEmployee(payments as any[]));
}

async function requireRun(scope: PayrollOperationScope, runId: string) {
  const run: any = await PayrollRunModel.findOne({ _id: runId, ...scope }).lean();
  if (!run) raise({ code: "PAYROLL_RUN_NOT_FOUND", message: "Payroll run not found", status: 404 });
  return run;
}

export async function createPayrollPayment(
  scope: PayrollOperationScope,
  runId: string,
  actorId: string,
  input: {
    amount: number;
    idempotencyKey: string;
    lines: Array<{ employeeId: string; amount: number }>;
    note?: string;
    evidenceUrl?: string;
    paymentDate?: string;
    correlationId?: string;
  },
) {
  const existing: any = await PayrollPaymentModel.findOne({ ...scope, idempotencyKey: input.idempotencyKey }).lean();
  if (existing) {
    if (String(existing.runId) !== runId || Number(existing.amount) !== input.amount) {
      raise({ code: "PAYROLL_IDEMPOTENCY_CONFLICT", message: "Idempotency key was used for another payment", status: 409 });
    }
    return { payment: existing, replayed: true };
  }

  const run = await requireRun(scope, runId);
  const settlement = await settlementFor(scope, run, runId);
  const invalid = validatePaymentRequest(run, settlement, { amount: input.amount, lines: input.lines });
  if (invalid) raise(invalid);

  const payment: any = await PayrollPaymentModel.create({
    ...scope,
    runId,
    amount: input.amount,
    idempotencyKey: input.idempotencyKey,
    lines: input.lines,
    status: "draft",
    createdBy: actorId,
    ...(input.note ? { note: input.note } : {}),
    ...(input.evidenceUrl ? { evidenceUrl: input.evidenceUrl } : {}),
    ...(input.paymentDate ? { paymentDate: new Date(input.paymentDate) } : {}),
  });

  await PayrollAuditModel.create({
    ...scope,
    periodKey: run.periodKey,
    action: "payment",
    actorId,
    metadata: {
      operation: "create_payment",
      runId,
      paymentId: String(payment._id),
      amount: input.amount,
      employeeCount: input.lines.length,
      ...(input.evidenceUrl ? { evidenceUrl: input.evidenceUrl } : {}),
      ...(input.correlationId ? { correlationId: input.correlationId } : {}),
    },
  });

  return { payment, replayed: false };
}

export async function transitionPayrollPayment(
  scope: PayrollOperationScope,
  paymentId: string,
  actorId: string,
  action: PayrollPaymentAction,
  input: { paymentDate?: string; evidenceUrl?: string; note?: string; correlationId?: string } = {},
) {
  const rule = paymentActionRule(action);
  const current: any = await PayrollPaymentModel.findOne({ _id: paymentId, ...scope }).lean();
  const invalid = validatePaymentTransition(current, action);
  if (invalid) raise(invalid);

  const now = new Date();
  const changes: Record<string, unknown> = {
    status: rule.to,
    [rule.actorField]: actorId,
    [rule.atField]: now,
    ...(action === "confirm" ? { paymentDate: input.paymentDate ? new Date(input.paymentDate) : (current.paymentDate ?? now) } : {}),
    ...(input.evidenceUrl ? { evidenceUrl: input.evidenceUrl } : {}),
    ...(input.note ? { note: input.note } : {}),
  };
  const updated: any = await PayrollPaymentModel.findOneAndUpdate(
    { _id: paymentId, ...scope, status: rule.from },
    { $set: changes },
    { new: true },
  ).lean();
  if (!updated) {
    raise({ code: "PAYROLL_PAYMENT_INVALID_TRANSITION", message: `Cannot ${action} a payment that changed concurrently`, status: 409 });
  }

  const run = await requireRun(scope, String(current.runId));
  const settlement = await settlementFor(scope, run, String(current.runId));
  const nextStatus = deriveRunSettlementStatus(settlement);
  const runChanged = nextStatus !== run.status;
  if (runChanged) {
    await PayrollRunModel.findOneAndUpdate(
      { _id: current.runId, ...scope, status: run.status },
      { $set: { status: nextStatus }, $inc: { version: 1 } },
    );
  }

  await PayrollAuditModel.create({
    ...scope,
    periodKey: run.periodKey,
    action: "payment",
    actorId,
    metadata: {
      operation: `${action}_payment`,
      runId: String(current.runId),
      paymentId,
      amount: Number(current.amount),
      before: { paymentStatus: current.status, runStatus: run.status },
      after: { paymentStatus: rule.to, runStatus: nextStatus },
      ...(updated.evidenceUrl ? { evidenceUrl: updated.evidenceUrl } : {}),
      ...(input.correlationId ? { correlationId: input.correlationId } : {}),
    },
  });

  return { payment: updated, runStatus: nextStatus };
}
