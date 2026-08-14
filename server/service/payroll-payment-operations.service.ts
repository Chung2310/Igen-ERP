import { PayrollAuditModel } from "../model/payroll-audit.model";
import { PayrollPaymentModel } from "../model/payroll-payment.model";
import { PayrollRunModel } from "../model/payroll-run.model";
import { PayrollOperationError, type PayrollOperationScope } from "./payroll-run-operations.service";
import { loadAuthoritativePayrollLines } from "./payroll-effective-line.service";
import { runPayrollAtomicTransaction } from "./payroll-transaction.service";
import type { ClientSession } from "mongoose";
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

const withSession = (query: any, session?: ClientSession) => (
  session ? query.session(session) : query
);

const writeOptions = (session?: ClientSession) => (
  session ? { new: true, session } : { new: true }
);

async function settlementFor(
  scope: PayrollOperationScope,
  run: any,
  runId: string,
  session?: ClientSession,
) {
  // MongoDB does not support parallel operations on one transaction session.
  const effective = await loadAuthoritativePayrollLines(scope, run, session);
  const payments = await withSession(
    PayrollPaymentModel.find({ ...scope, runId, status: "confirmed" }).select("status lines"),
    session,
  ).lean();
  return buildSettlementLines(effective.effectiveLines, confirmedPaidByEmployee(payments as any[]));
}

async function requireRun(scope: PayrollOperationScope, runId: string, session?: ClientSession) {
  const run: any = await withSession(
    PayrollRunModel.findOne({ _id: runId, ...scope }),
    session,
  ).lean();
  if (!run) raise({ code: "PAYROLL_RUN_NOT_FOUND", message: "Payroll run not found", status: 404 });
  return run;
}

async function claimRunSettlement(
  scope: PayrollOperationScope,
  run: any,
  session?: ClientSession,
) {
  const claimed: any = await PayrollRunModel.findOneAndUpdate(
    { _id: run._id, ...scope, status: run.status, version: run.version },
    { $inc: { version: 1 } },
    writeOptions(session),
  ).lean();
  if (!claimed) {
    raise({
      code: "PAYROLL_VERSION_CONFLICT",
      message: "Payroll settlement changed concurrently",
      status: 409,
    });
  }
  return claimed;
}

const applyPaymentLines = (
  settlement: Array<{ employeeId: string; netPay: number; confirmedPaid: number }>,
  lines: Array<{ employeeId: string; amount: number }>,
  direction: 1 | -1,
) => {
  const byEmployee = lines.reduce((amounts, line) => {
    const employeeId = String(line.employeeId);
    amounts.set(employeeId, (amounts.get(employeeId) ?? 0) + Number(line.amount));
    return amounts;
  }, new Map<string, number>());
  return settlement.map((line) => ({
    ...line,
    confirmedPaid: Math.max(
      0,
      line.confirmedPaid + direction * (byEmployee.get(line.employeeId) ?? 0),
    ),
  }));
};

async function createAudit(document: any, session?: ClientSession) {
  if (!session) return PayrollAuditModel.create(document);
  const [created] = await PayrollAuditModel.create([document], { session });
  return created;
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
  return runPayrollAtomicTransaction(async (session) => {
    const rule = paymentActionRule(action);
    const current: any = await withSession(
      PayrollPaymentModel.findOne({ _id: paymentId, ...scope }),
      session,
    ).lean();
    const invalid = validatePaymentTransition(current, action);
    if (invalid) raise(invalid);

    const run = await requireRun(scope, String(current.runId), session);
    if (action === "confirm" && run.status !== "closed") {
      raise({
        code: "PAYROLL_RUN_NOT_PAYABLE",
        message: `A payroll run in status ${run.status} cannot be paid`,
        status: 409,
      });
    }
    if (action === "reverse" && !["closed", "paid"].includes(run.status)) {
      raise({
        code: "PAYROLL_PAYMENT_RUN_STATE_INVALID",
        message: "A confirmed payment can only be reversed while its payroll run is closed or paid",
        status: 409,
      });
    }

    const claimedRun = action === "cancel"
      ? run
      : await claimRunSettlement(scope, run, session);
    const settlement = action === "cancel"
      ? []
      : await settlementFor(
          scope,
          claimedRun,
          String(current.runId),
          session,
        );
    if (action === "confirm") {
      const invalidRequest = validatePaymentRequest(claimedRun, settlement, {
        amount: Number(current.amount),
        lines: current.lines ?? [],
      });
      if (invalidRequest) raise(invalidRequest);
    }

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
      writeOptions(session),
    ).lean();
    if (!updated) {
      raise({ code: "PAYROLL_PAYMENT_INVALID_TRANSITION", message: `Cannot ${action} a payment that changed concurrently`, status: 409 });
    }

    const settledAfter = action === "confirm"
      ? applyPaymentLines(settlement, current.lines ?? [], 1)
      : action === "reverse"
        ? applyPaymentLines(settlement, current.lines ?? [], -1)
        : settlement;
    const nextStatus = action === "cancel"
      ? run.status
      : deriveRunSettlementStatus(settledAfter);
    const runChanged = nextStatus !== claimedRun.status;
    if (runChanged) {
      const transitioned = await PayrollRunModel.findOneAndUpdate(
        {
          _id: current.runId,
          ...scope,
          status: claimedRun.status,
          version: claimedRun.version,
        },
        { $set: { status: nextStatus } },
        writeOptions(session),
      ).lean();
      if (!transitioned) {
        raise({
          code: "PAYROLL_VERSION_CONFLICT",
          message: "Payroll settlement changed concurrently",
          status: 409,
        });
      }
    }

    await createAudit({
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
    }, session);

    return { payment: updated, runStatus: nextStatus };
  });
}
